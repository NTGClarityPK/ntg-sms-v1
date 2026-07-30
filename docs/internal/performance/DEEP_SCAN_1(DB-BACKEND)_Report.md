# Alma Deep Scan Phase 1 — Database + Backend

**Date:** 24 Jul 2026  
**Scope:** Categories 1 (Database & Supabase) and 2 (Backend / NestJS) only  
**Method:** Read-only audit — codebase, migrations, prior optimisation notes, live Supabase MCP (`get_advisors`, `execute_sql`)  
**Instructions:** [docs/performance/deep-scan.md](deep-scan.md)  
**Prior context:** [docs/performance/memory-load-reasons.md](memory-load-reasons.md) (Sprint 1 + sequential Fixes 1–8)

Phases 2–3 will cover Frontend, Multi-tenant isolation score, Code smells, and Monitoring.

---

## Executive Summary

- **Phase-1 composite score: 62/100** (weighted: Database 56% + Backend 44%)
- **Recommendation:** Fix critical noisy-neighbour backend paths before wider go-live; database hot paths are indexed but advisor debt and payload habits will hurt at 50+ tenants.
- **Top 3 risks before go-live:**
  1. School data export materialising entire tenant sections in Nest memory
  2. Puppeteer `launch` per PDF (ID cards, fee challans; Results ZIP already mitigated in Fix 6)
  3. Unbounded notification / grade-update fan-out under exam / fee-day load
- **Estimated effort to reach Phase-1 ~85+:** ~2.5–3.5 person-weeks (DB hygiene + export streaming + PDF pool + BranchGuard cache + concurrency caps)

### Already mitigated (do not reopen as open criticals)

| Item | Status |
|------|--------|
| Auth Admin `getUserById` list storms | Fixed Sprint 1 |
| Attendance report unbounded `Promise.all` | Capped `mapWithConcurrency(4)` |
| Messages unfiltered Realtime | Fixed Sprint 1 |
| Results ZIP O(N²) ranks + Chromium-per-PDF | Fixed Fix 6 |
| Subject academic report N× queries | Batched Fix 7 |
| JwtAuthGuard every-request Auth | Short-TTL cache Fix 8 |
| Middleware Auth on anonymous traffic | Cookie-gated Fix 8 |

---

## Category Scores

| Category | Score | Status |
|----------|-------|--------|
| Database & Supabase | **70/100** | Fair — moderate work before scaling |
| Backend / NestJS | **52/100** | Poor — significant issues at 50+ tenants |
| **Phase-1 overall** | **62/100** | Fair |

**Scoring notes:** Started at 100 per category; deducted for critical (−8 to −15), major (−3 to −7), and systemic patterns (−5 to −10 once). Credited recent Fixes 1–8 on Backend (+8). Nest uses the **service role** client, so many RLS advisor items affect Realtime/client paths more than Nest queries — weighted accordingly on Database.

---

## Live DB snapshot (MCP)

### Hot table sizes (approx)

| Table | Approx rows | Total size |
|-------|-------------|------------|
| attendance | 17,425 | 9.9 MB |
| audit_logs | 3,932 | 4.1 MB |
| student_grades | 5,522 | 1.8 MB |
| notifications | 1,583 | 1.4 MB |
| timetable_slots | 745 | 1.1 MB |
| students | 423 | 480 kB |
| messages | 372 | 392 kB |
| assessments | 867 | 384 kB |

Data volume is still demo-scale; patterns that are “fine” now become critical when rows grow 50–100× per tenant.

### Index health (hot paths)

- **Good:** `idx_attendance_branch_year_date_class_section` heavily used (`idx_scan` ~11k). Notifications user indexes heavily used.
- **Performance indexes already shipped:**  
  - `supabase/migrations/20260223100000_performance_indexes_reports_attendance_notifications.sql`  
  - `supabase/migrations/20260428120000_performance_indexes_auth_settings_status.sql`  
  - `supabase/migrations/20260407120000_messages_list_performance.sql`
- **Student grades:** unique `(assessment_id, student_id)` + branch/year + student indexes present.
- **Suspicious:** `idx_attendance_marked_by` — high `idx_scan` with `idx_tup_read = 0` (candidate for review / drop later). Duplicate-style notification indexes (`idx_notifications_user` vs `idx_notifications_user_read_created`).

### Supabase advisors (live)

| Advisor type | Count | Top themes |
|--------------|-------|------------|
| Performance | **295** (137 INFO / 158 WARN) | Unindexed FKs **88**, Auth RLS init plan **83**, Multiple permissive policies **70**, Unused index **49**, Duplicate index **5** |
| Security | **77** (6 ERROR / 61 WARN) | Mutable search_path on functions, SECURITY DEFINER execute grants, RLS enabled with no policy, etc. |

Remediation hub: [Supabase database linter](https://supabase.com/docs/guides/database/database-linter).

---

## Critical Issues (Must Fix Before Go-Live)

### C1: School data export holds full tenant payload in memory

- **Category:** Backend (also DB I/O storm)
- **Severity:** Critical
- **File:** `backend/src/modules/data-export/school-data-collector.service.ts:45-97`
- **Current code:**
```typescript
const sections: Record<string, unknown[]> = {};
// ...
for (const table of BRANCH_SCOPED_TABLES) {
  sections[key] = await this.fetchBranchScopedTable(...);
}
```
- **Problem:** Rows are paged (1000) but **all tables accumulate** into one object, then JSON.stringify + encrypt + zip in Nest.
- **Impact at scale:** One large school export can spike Nest RAM; concurrent tenant exports can OOM the API box and flood Postgres/Storage.
- **Proposed fix:** Stream per-table JSONL/chunks into zip; never hold full `sections` + plaintext simultaneously; hard-cap concurrent exports (already partial rate limit — extend).
- **Estimated effort:** 2–3 days
- **Expected impact:** Removes largest Nest memory spike from admin “backup” demos.

### C2: ID-card PDF launches Chromium per render (bulk ×3 concurrent)

- **Category:** Backend
- **Severity:** Critical
- **File:** `backend/src/modules/id-cards/id-card-pdf.service.ts:56-61` (+ bulk `id-cards.service.ts` ~1011–1015, `BULK_CHUNK = 3`)
- **Current code:**
```typescript
const browser = await puppeteer.launch({
  headless: true,
  executablePath: getPuppeteerExecutablePath(),
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
```
- **Problem:** Same anti-pattern Results had before Fix 6. Bulk ZIP fans out 3 launches at once, up to 60 cards.
- **Impact at scale:** Fee/ID-card demo week across tenants saturates Nest CPU/RAM; secondary pressure on DB while building card payloads.
- **Proposed fix:** One browser per bulk job (serial `newPage`); prefer single-launch multi-page HTML where possible; concurrency 1 on Nano-sized hosts.
- **Estimated effort:** 1–2 days
- **Expected impact:** Matches Results Fix 6 win for ID cards.

### C3: Fee challan generate — per-student loops + Chromium each

- **Category:** Backend
- **Severity:** Critical
- **File:** `backend/src/modules/fees/challan.service.ts` (~629–639, ~882–901); `backend/src/modules/fees/fee-pdf.service.ts:269-273`
- **Current code:**
```typescript
for (const studentId of input.studentIds) {
  const coveredChecks = await Promise.all(months.map((m) => this.isMonthCovered(...)));
  const previews = await Promise.all(months.map((m) => this.feeCalculationService.calculatePreview(...)));
}
// generateChallanPdf → puppeteer.launch
```
- **Problem:** Class-wide generation = N × (month queries + PDF process). No shared browser / job queue.
- **Impact at scale:** Fee day across 50 tenants is a classic noisy-neighbour event (DB + Nest).
- **Proposed fix:** Batch coverage/preview queries; queue PDF generation; reuse browser; hard caps on class size / concurrency.
- **Estimated effort:** 3–4 days
- **Expected impact:** Cuts peak DB calls and Nest RAM on fee runs by large factors.

### C4: Assessment publish — unbounded notification fan-out

- **Category:** Backend (+ notifications table write amplification)
- **Severity:** Critical
- **File:** `backend/src/modules/assessments/assessments.service.ts:363-376`
- **Current code:**
```typescript
await Promise.allSettled(
  recipientUserIds.map((userId) =>
    this.notificationsService.createNotification({ userId, type, title, body, data }),
  ),
);
```
- **Problem:** One publish triggers one insert (+ push) per student/parent in parallel with no concurrency cap.
- **Impact at scale:** Exam week × many classes × tenants stamps notifications and Auth/DB; compounds with Fix 8 residual cold-path Auth.
- **Proposed fix:** Batch insert notifications; queue push delivery; `mapWithConcurrency(4–8)`.
- **Estimated effort:** 1 day
- **Expected impact:** Removes publish-time connection storms.

---

## Major Issues (Fix Within 30 Days)

### M1: BranchGuard still hits DB on every authenticated request

- **Category:** Backend
- **Severity:** Major
- **File:** `backend/src/common/guards/branch.guard.ts:150-222`
- **Current code:**
```typescript
.from('user_branches').select('branch_id').eq('user_id', userId).eq('branch_id', branchId)
.from('branches').select('id, tenant_id, is_active')
.from('tenants').select('id, is_active') // when tenant_id set
```
- **Problem:** Fix 8 caches JWT user/roles only. Dashboard multi-API bursts still pay 2–4+ DB round-trips per request via BranchGuard.
- **Impact at scale:** Linear with API fan-out × concurrent users × tenants — dominant steady-state DB cost after Auth storm fixes.
- **Proposed fix:** Short-TTL cache keyed by `(userId, branchId)` (same safety model as Fix 8: 15–30s, never cache failures).
- **Estimated effort:** 4–6 hours
- **Expected impact:** Large drop in PostgREST QPS on portal navigation.

### M2: Grades bulk save — unbounded parallel updates + `select('*')`

- **Category:** Backend / Database
- **Severity:** Major
- **File:** `backend/src/modules/grades/grades.service.ts:327-359`
- **Current code:**
```typescript
const updatePromises = toUpdate.map(async ({ gradeId, gradeDto, submissionStatus }) => {
  return await supabase.from('student_grades').update({...}).eq('id', gradeId).select('*').single();
});
const updatedGrades = await Promise.all(updatePromises);
```
- **Problem:** Full-class save opens dozens of parallel writes; each returns wide rows.
- **Impact at scale:** Concurrent marking across tenants stresses pooler/connections (Nano tip pattern).
- **Proposed fix:** `mapWithConcurrency(4)` or single RPC/`upsert` batch; return explicit columns.
- **Estimated effort:** 4–8 hours

### M3: Systemic `.select('*')` on hot Nest services

- **Category:** Database / Backend
- **Severity:** Major (pattern)
- **Evidence:** ~150+ backend hits excluding scripts; densest in `core-lookups.service.ts` (~21), `schedule.service.ts` (~13), `timetable.service.ts` (~12), `academic-years.service.ts` (~10), `events.service.ts` (~8).
- **Example:** `core-lookups.service.ts` paginated subjects/classes/sections still use `select('*', { count: 'exact' })`.
- **Problem:** Larger PostgREST payloads and cache pressure; violates project database rules.
- **Impact at scale:** Every settings/timetable screen multiplies bytes × tenants.
- **Proposed fix:** Explicit DTO columns on list/detail hot paths first (lookups, timetable, grades, events).
- **Estimated effort:** 3–5 days (phased)

### M4: Parents associations preload all branch student IDs

- **Category:** Backend / Database
- **Severity:** Major
- **File:** `backend/src/modules/parents/parents.service.ts:472-489`
- **Current code:**
```typescript
let dbQuery = supabase.from('parent_students').select('*', { count: 'exact' });
const { data: branchStudents } = await supabase
  .from('students')
  .select('id')
  .eq('branch_id', branchId);
dbQuery = dbQuery.in('student_id', studentIds);
```
- **Problem:** List pagination is undermined by loading the entire student ID set first.
- **Impact at scale:** Large schools make every associations page scan + large `.in()` filters.
- **Proposed fix:** Join/RPC filter; avoid materialising all IDs.
- **Estimated effort:** 4–8 hours

### M5: Timetable — `select('*')` with nested joins; unbounded slot updates

- **Category:** Backend / Database
- **Severity:** Major
- **File:** `backend/src/modules/timetable/timetable.service.ts:250-268`, `1041-1049`
- **Problem:** Full slot graph with nested `*` payloads; renumber uses `Promise.all` of single-row updates.
- **Impact at scale:** Many concurrent timetable views + generate/replicate operations amplify DB writes.
- **Proposed fix:** Explicit columns; batched SQL update; concurrency cap.
- **Estimated effort:** 1–2 days

### M6: No global / per-tenant API rate limiting

- **Category:** Backend
- **Severity:** Major
- **Evidence:** Only ad-hoc limits found (`invitations.service` `enforceRateLimit`, `data-export.service` export rate limits). No Nest `ThrottlerModule` / gateway tenant quotas.
- **Problem:** One tenant can saturate Auth/DB/Nest with exports, PDFs, bulk saves.
- **Impact at scale:** Classic noisy neighbour on shared Supabase + shared Nest.
- **Proposed fix:** Per-tenant (and global) throttles on heavy routes: export, bulk PDF, challan generate, bulk grades.
- **Estimated effort:** 1–2 days

### M7: Unindexed foreign keys (advisor) + unused/duplicate indexes

- **Category:** Database
- **Severity:** Major (hygiene; prioritise hot FKs)
- **Evidence:** Performance advisors — **88** unindexed FKs, **49** unused indexes, **5** duplicate indexes.
- **Problem:** FK checks / joins without covering indexes; unused indexes waste write/RAM budget on Nano.
- **Impact at scale:** Write-heavy paths (grades, attendance, enrolments) slow as children grow; unused indexes steal Nano memory.
- **Proposed fix:** Index FKs used in Nest filters/joins first; drop confirmed unused duplicates (e.g. review notification dual indexes) after `pg_stat_user_indexes` confirmation in prod window.
- **Estimated effort:** 1–2 days (batched migrations)

### M8: Auth RLS Initialization Plan (advisor) ×83

- **Category:** Database
- **Severity:** Major for Realtime/client; lower for Nest service-role paths
- **Problem:** Policies re-evaluate `auth.uid()` per row instead of `(SELECT auth.uid())`.
- **Impact at scale:** Any client/Realtime path with RLS pays extra CPU as tables grow.
- **Proposed fix:** Rewrite hot policies per Supabase guidance; Nest remains service-role but Realtime still matters.
- **Estimated effort:** 2–3 days (careful policy QA)

### M9: Reports academic comparison still chains heavy per-entity loads

- **Category:** Backend
- **Severity:** Major
- **File:** `backend/src/modules/reports/reports.service.ts` (~2195–2236)
- **Problem:** Attendance summary already concurrency-capped; comparison still `await`s full `getClassReport` / `getAcademicReportBySubject` per selected id (subject path improved by Fix 7 batching, but multi-subject compare still sequential×heavy).
- **Proposed fix:** Cap concurrency; reuse cached class aggregates.
- **Estimated effort:** 4–6 hours

### M10: Assessment draft commit — serial storage download/upload/insert

- **Category:** Backend
- **Severity:** Major
- **File:** `backend/src/modules/assessments/assessments.service.ts:2567-2601` (approx.)
- **Problem:** Per-file download → upload → insert holds buffers and serialises Storage IOPS.
- **Proposed fix:** Prefer server-side copy; batch attachment inserts; stream.
- **Estimated effort:** 1 day

---

## Minor Issues (Nice to Fix)

- JwtAuth cache miss still loads roles + `profiles.is_active` (+ students for student role) before cache write — acceptable residual; optionally fold active flag into cache entry (`jwt-auth.guard.ts`).
- Grades-by-assessment / by-student return `select('*')` without pagination (`grades.service.ts` ~606–653).
- Schedule holidays/vacations: `select('*')`, no soft limit (`schedule.service.ts`).
- Tenant-scoped export helper without `.range()` (`school-data-collector.service.ts` ~384–393).
- Multiple Puppeteer call sites beyond ID/fees (certificates, reports PDF, subscription invoice, assessments) — each still launch-per-call; consolidate into shared PDF helper after ID/fees.
- Security advisors: SECURITY DEFINER execute grants, RLS enabled with no policy on several tables — track in Phase 2 multi-tenant / security pass.
- `idx_attendance_marked_by` usage anomaly (`idx_tup_read = 0`) — verify then consider drop.

---

## Duplication Report (Phase 1 slice)

- **Total notable duplicated performance patterns:** 4 families
- **Top hotspots:**
  1. `puppeteer.launch` → close — appears in id-cards, fees, certificates, reports, results (Results bulk fixed), assessments, subscription invoice
  2. Unbounded `Promise.all` over per-row DB writes — grades bulk, timetable renumber, assessment notify
  3. `.select('*')` list/detail — core-lookups, timetable, schedule, academic-years, events, grades
  4. Guard multi-query bootstrap — JwtAuth (cached) + BranchGuard (uncached)

---

## Metrics Baseline (Phase 1)

| Metric | Value (24 Jul 2026) |
|--------|---------------------|
| Backend `.select('*')` occurrences (excl. noise) | ~150+ across modules |
| `puppeteer.launch` call sites | 9 files / ~20 launches |
| Supabase performance advisors | 295 |
| Supabase security advisors | 77 |
| Attendance approx rows | ~17k |
| Student grades approx rows | ~5.5k |
| Nest global rate limiting | Not present |
| Job queue (Bull/etc.) for PDF/export | Not present |
| JwtAuth short-TTL cache | Present (Fix 8, 30s) |
| BranchGuard short-TTL cache | Absent |

---

## Recommended Roadmap (DB + Backend only)

### Week 1 (Critical)

- [ ] C1 — Stream school data export (or hard-block large exports on Free/Nano)
- [ ] C2 — ID-card bulk: one Chromium per job (mirror Results Fix 6)
- [ ] C4 — Cap/batch assessment publish notifications
- [ ] M1 — BranchGuard short-TTL cache

### Week 2–4 (Major)

- [ ] C3 — Fee challan batching + PDF queue/pool
- [ ] M2 — Grades bulk concurrency / batch upsert
- [ ] M3 — Kill `select('*')` on lookups + timetable + grades
- [ ] M4 — Parents associations without full student ID preload
- [ ] M6 — Per-tenant throttles on heavy endpoints
- [ ] M7 — Index hot unindexed FKs; drop confirmed unused duplicates
- [ ] M8 — Fix Auth RLS init-plan on hottest Realtime tables

### Ongoing

- [ ] Shared Puppeteer pool / disposable browser recycle across modules
- [ ] SQL/RPC aggregation for remaining admin reports
- [ ] Partition strategy review when `attendance` / `student_grades` / `audit_logs` approach multi-million rows

---

## Tools & Scripts to Add

- CI grep fail (or warn) on new `.select('*')` in `backend/src/modules/**`
- Periodic `get_advisors` performance/security snapshot into `docs/performance/`
- `pg_stat_user_indexes` unused-index report before dropping indexes
- Optional: Nest middleware metrics — count BranchGuard DB calls vs cache hits

---

## Phase boundary

| Later phase | Will cover |
|-------------|------------|
| **Phase 2** | Frontend / Next.js + Multi-tenant isolation score (BranchGuard bypasses, client branch switching, noisy-neighbour register) |
| **Phase 3** | Code smells / duplication depth + Monitoring & observability |

---

## Appendix — Score derivation

**Database 70:** + solid hot-path indexes and prior performance migrations; − systemic unindexed FKs / unused indexes (−8); − Auth RLS init-plan & permissive policies for Realtime (−6); − app `select('*')` / parents ID preload patterns (−8); − remaining N+1-ish report/export I/O (−8). Floor not applied.

**Backend 52:** − export memory (−12); − ID-card/fee Puppeteer (−12); − notification fan-out (−8); − BranchGuard uncached (−7); − grades/timetable unbounded writes (−5); − no global rate limit / queues (−5); − select(*) habits (−5); + Fixes 1–8 credit (+8).

**Overall:** `0.56 × 70 + 0.44 × 52 = 62.1` → **62**.
