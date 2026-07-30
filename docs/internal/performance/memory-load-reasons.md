# Memory / Compute Load Reasons (Supabase Nano)

**Date:** 22 Jul 2026  
**Project:** `hpqpdeysaoxtfouksvcw` (School Management System / Alma)  
**Compute:** Free **Nano** (`t4g.nano`, **0.5 GB RAM**) — Singapore  
**Trigger event:** Demo day 21 Jul 2026 — app worked during demo, then Auth/REST returned **522**, dashboard showed **Unhealthy**, DB queries timed out.

---

## 1. Executive verdict

| Question | Answer |
|----------|--------|
| Did we “go to production”? | **No.** A short demo on Alma is enough to stress Nano. |
| Is this only a Supabase outage? | **No.** Nano is undersized; **our app patterns** push it over the edge. |
| Did zip downloads alone cause it? | **Results “Download All ZIP” / repeated basic+detailed PDFs are a high-confidence demo burst** (see §4.1b / Fix 6). Full school data-export is still worse if used. Timetable alone is unlikely. |
| What most likely tipped RAM on demo day? | **Auth Admin list storms + Results PDF/ZIP (O(N²) class recompute + Chromium) + Administrative reports fan-out + Realtime + middleware Auth**, on a box already ~**45% RAM idle**. |

**Chart evidence (Supabase Memory report):**

- **14–20 Jul:** max memory ≈ **45%** of 0.5 GB every day (stable baseline).
- **21 Jul:** max memory ≈ **80%** (single-day spike → Unhealthy → 522s).

So this was not a weeks-long leak. Something on **demo day** pushed past the ~250 MB free headroom.

---

## 1b. Sprint 1 implemented (22 Jul 2026) — optimisation without upgrade

| Fix | Change | Expected measurable win |
|-----|--------|-------------------------|
| Auth list storms | Students / Staff / Parents lists use `profiles.email` only — no `auth.admin.getUserById` fan-out | Students list: **~25–50 Auth Admin calls → 0** |
| Report concurrency | `mapWithConcurrency(..., 4)` in attendance summary + low-attendance | Cap concurrent class-section report queries at **4** |
| Messages Realtime | Removed unfiltered `messages` INSERT channel; 20s polling on conversation list | No tenant-wide Realtime fan-out while Messages is open |

**Files touched:**
- `backend/src/modules/students/students.service.ts`
- `backend/src/modules/staff/staff.service.ts`
- `backend/src/modules/parents/parents.service.ts`
- `backend/src/common/utils/map-with-concurrency.util.ts`
- `backend/src/modules/reports/reports.service.ts`
- `frontend/src/hooks/api/useMessages.ts`
- `frontend/src/app/(portal)/messages/page.tsx`

### Boss verification (after deploy)

1. Supabase → **Logs → Auth**: open Students (and Staff) list — `/admin/users/{id}` should **not** flood for list loads.
2. Supabase → **Reports → Memory**: scripted demo (login → students → staff → one timetable → **no** full school export). Peak should stay nearer the ~45% baseline.
3. Edge success rate during that demo should stay high (no 522 wave).
4. Optional: open Administrative reports — should still work; load may be slightly slower but without a connection spike.

**Note:** Detail endpoints may still call `getUserById` once (acceptable). Blank emails on list = `profiles.email` null for that user (backfill later if needed).

---

## 2. What “memory” means here

Supabase **Nano RAM** is shared by:

1. Postgres  
2. PostgREST (REST API)  
3. GoTrue (Auth)  
4. Realtime  
5. Storage  
6. Other platform sidecars  

Supabase’s own UI note: elevated memory is normal even with little load.

**Implication:** ~45% idle ≈ **~225 MB used / ~275 MB free**. Any burst of concurrent Auth Admin calls, parallel report queries, Realtime connections, or large exports can tip the instance. When Postgres/Auth stop responding, Cloudflare returns **522** (browser shows CORS / “Failed to fetch”).

**This is not frontend JS heap.** NestJS PDF/zip generation uses **app-server RAM** (DigitalOcean), which can still stress Supabase via many DB/Auth/Storage reads during generation.

---

## 3. Demo-day timeline (from logs + metrics)

| Time (approx, PKT) | What we saw |
|--------------------|-------------|
| Earlier 21 Jul | Alma working: `admin@alahmar.edu` token refresh, `/auth/v1/user`, REST profiles/roles/branches **200** |
| Mid-demo window | Normal portal traffic: session checks, list hydration, Realtime websockets, Storage school logos |
| ~15:40 | Postgres: `unexpected EOF on standby connection` (`08P01`) |
| Shortly after | Many `could not receive data from client: Connection timed out` |
| ~16:00–16:21+ | Edge: Auth `/token` **522**, REST **522**, Storage **544** |
| After | Dashboard: DB schema/tables **connection timeout**; project **Unhealthy**; RAM **81%** |

**Conclusion:** Demo traffic loaded the box; the box tipped; Auth then failed even for simple login. You did not need a full school rollout.

---

## 4. Direct answers: zip? timetable? what?

### 4.1 Zip / download features

| Feature | Path | Hits Supabase how? | Demo risk |
|---------|------|--------------------|-----------|
| **School data export (encrypted backup zip)** | `backend/src/modules/data-export/` | Pages **entire branch/tenant tables** into memory (`EXPORT_ROW_PAGE_SIZE = 1000`), then encrypts + zips. Worst case for **both** Nest and Postgres. | **CRITICAL if used in demo** |
| **ID cards bulk zip** | `id-cards.service.ts` `getBulkPdfArchive` — max **60**, chunk **3** | Many DB reads + PDF buffers; zip on Nest | **HIGH if demo’d bulk download** |
| **Results cards bulk zip** | `results.service.ts` `getBulkResultCardPdfStream` — max **60**, chunk **3** | **Per PDF** re-runs full class results for rank + launches Chromium → **O(N²) DB** + up to **3 browsers** | **CRITICAL if demo’d** (confirmed demo script) |
| **Results single basic/detailed PDF** | `generateResultCardPdf` | Same rank bug once per download; detailed also hits `get_detailed_result` (+ 2× for final/annual) | **HIGH** (long spinner; Nano medium–high) |
| **Certificate / library download** | certificates, library | Storage download + counters | **LOW–MED** |
| **Fee / attendance Excel export** | fees/attendance | Up to **2k–5k** rows from DB | **MED–HIGH if export opened** |

**If the demo included Settings → Data export (full school backup):** that alone can explain an 80% RAM spike on Nano.

**If the demo used Results → basic/detailed + Download All ZIP:** treat as a **primary** contributor (see §4.1b). Auth storms / admin reports / Realtime can still tip Nano even without ZIP.

### 4.1b Results tab PDFs — critical finding (23 Jul 2026)

Demo feedback: Results tab **basic + detailed** downloads and **Download All ZIP** spun for a long time (“loading and loading”). Code review confirms why.

| Mechanism | Detail |
|-----------|--------|
| **Class-rank O(N²)** | `getClassRank` → `getResultsForClassSection` (whole class). Every single/basic PDF and every ZIP member does this. ZIP of N students ≈ **1 + N** full class recomputes. |
| **Per-PDF Chromium** | `printResultCardHtmlToPdf` calls `puppeteer.launch` / `browser.close` **per PDF**. ZIP chunks **3** → up to **3 Chromiums** (~150–300 MB each) on Nest (DigitalOcean), not on Nano — but UI hangs and Nest can thrash. |
| **Repeated per-student DB** | ZIP also calls `getResultForStudent` per student even though batch already loaded class results. |
| **Detailed extras** | `get_detailed_result` RPC + `getSchoolRank`; final/annual may fetch mid+final in parallel. |

**Who hurts what:** long spinner ≈ Nest Chromium + repeated work; login **522** ≈ Nano Postgres/Auth tipping from the DB storm (plus other demo traffic).

**Research: how to fix (industry + our code)**

1. **Data once (highest Nano ROI):** In bulk ZIP, call `getResultsForClassSection` **once**, build a `studentId → rank` map from sorted percentages, feed each PDF from the batch DTO — **never** call `getClassRank` / `getResultForStudent` inside the loop. Apply the same for single PDF: compute rank from one class batch (or cache for the request) instead of N-student recompute for one student.  
2. **One browser per bulk job (Nest ROI):** Industry standard — do **not** launch Chromium per document. For ZIP: `launch` once → `newPage` → `setContent` → `pdf` → `page.close` per student → `browser.close` in `finally`. Prefer **serial** pages (concurrency 1) on small DO boxes; optionally 1–2 pages max. Recycle browser after a fixed job count if shared later.  
3. **Chunk policy:** Drop `BULK_PDF_CHUNK` from 3→1 while each PDF still launches its own browser; after shared browser, keep serial or max 2 pages.  
4. **Detailed PDF:** Keep RPC; still use cached class batch for class rank; school rank RPC once per student is OK short-term.  
5. **Later (not Fix 6):** shared app-wide Puppeteer pool / async ZIP job queue (Sprint 4); same pattern for ID-card bulk (same launch-per-PDF smell).

**Expected win (class of ~30):** ~31 full class recomputes → **1**; ~30 Chromium launches → **1**; ZIP wall-clock and Nano query pressure both drop sharply.

### 4.2 Timetable

| Finding | Detail |
|---------|--------|
| Main read path | `timetable.service.ts` `getClassTimetable` — slots with nested joins; several paths use `.select('*')` (~12 `select('*')` hits in module) |
| Typical size | One class-section’s week of slots — **small** result set |
| Substitutions | `buildCandidatePool` loads **all active staff** + their slots/assignments for the branch — heavier if substitution UI was opened |

**Verdict:** Opening timetable for a few classes is **unlikely** to be the primary cause. Substitution candidate building is worse but still usually secondary to Auth storms / reports.

### 4.3 What *is* enough to tip Nano during a “light” demo

Even without zip:

1. Login + navigate a few pages → middleware `auth.getUser()` every request  
2. Open **Students** or **Staff** list → N parallel `auth.admin.getUserById`  
3. Open **Reports → Administrative** → `Promise.all` over **all** class sections  
4. Stay logged in → notifications Realtime channel  
5. Optionally open **Messages** → unfiltered `messages` INSERT Realtime  

That combination matches “demo looked fine, then suddenly login died.”

---

## 5. Root causes ranked (codebase evidence)

### P0 — Auth Admin `getUserById` storms — FIXED Sprint 1 (22 Jul 2026)

**Was:** List endpoints fan out one Auth Admin HTTP call **per user on the page**.

| Module | Status |
|--------|--------|
| Students list | Fixed — `profiles.email` |
| Staff list | Fixed — `profiles.email` |
| Parents associations | Fixed — `profiles.email` |
| Users list | Already preferred profiles.email |

Detail/create paths may still use Auth Admin (acceptable).

---

### P0 — Administrative reports parallel fan-out — MITIGATED Sprint 1 (concurrency 4)

**Was:** Unbounded `Promise.all` over all class sections.

**Now:** `mapWithConcurrency(allowed, 4, ...)` in `getAttendanceSummaryBranch` and `getLowAttendanceStudents`.

**Remaining:** SQL/RPC aggregation (Sprint 2) to remove N queries entirely.

---

### P1 — Always-on Realtime — Messages list FIXED Sprint 1

| Subscription | Status |
|--------------|--------|
| Notifications (`user_id` filter) | Kept (filtered) |
| Messages list unfiltered INSERT | **Removed** — 20s polling instead |
| Messages thread (`conversation_id` filter) | Kept |
| Dev test channel | Still prod-guarded |

---

### P1 — Middleware Auth on every navigation — MITIGATED Fix 8 (23 Jul 2026)

**Was:** `middleware.ts` called `getUser()` on almost every matched route (including anonymous landing).

**Now:** `getUser()` only when an `sb-*-auth-token*` cookie is present. JwtAuthGuard also short-TTL caches successful validations (30s).

**Remaining:** further matcher narrowing optional; measure Auth log volume after deploy.

---

### P2 — `select('*')` proliferation

**Count:** ~**150+** backend `.select('*')` occurrences across services (timetable, schedule, core-lookups, academic-years, grades, events, etc.).

**Impact:** Larger row payloads → more PostgREST/Postgres memory per query. Rarely fatal alone; stacks with fan-out.

**Optimisation direction:** Explicit columns on hot list/detail paths first (students, staff, attendance, notifications, timetable slots).

---

### P2 — Heavy exports / zip (conditional on demo script) — Results elevated 23 Jul 2026

| Path | Behaviour |
|------|-----------|
| `school-data-collector.service.ts` | Accumulates **all** rows for many tables into `all[]`, then `JSON.stringify` + encrypt + zip |
| ID cards / results bulk zip | Up to 60 PDFs in Nest memory; DB/Auth/Storage churn during render |
| **Results ZIP / PDF (critical)** | O(N²) `getClassRank` + Chromium per PDF — see §4.1b; **queued as Fix 6** |

**Optimisation direction:**

- Stream export to Storage; never hold full tenant JSON in one buffer on Free tier.  
- Harder rate limits; block tenant-scope export on Nano.  
- Results: cache class batch + one browser per ZIP (§4.1b / Fix 6).  
- Generate PDFs async (job queue) with low concurrency (later).

---

### P2 — Messages list conversation IDs

**File:** `messages.service.ts` `listConversations`  
Loads **all** `conversation_id`s for the user (no limit) into `allConversationIds` for Realtime client filtering.

**Impact:** Grows with chat history; feeds the unfiltered Realtime listener.

---

### P3 — Substitutions candidate pool

**File:** `substitutions.service.ts` `buildCandidatePool`  
All active staff + slots for days + monthly substitution counts.

**Impact:** Noticeable if substitution feature was demo’d; not continuous.

---

### P3 — Crons (ruled out for current `.env.prod`)

`.env.prod` disables invitation expiry, substitution reminders, tenant deletion, late fee, subscription jobs.

**Caveat:** Several schedulers default to **ON in production** if env keys are missing on the deploy. Verify live DigitalOcean env matches `.env.prod`.

---

## 6. What is *not* the primary cause

| Suspect | Why not primary |
|---------|-----------------|
| Billing “grace period over” banner | Present since **7 Jul**; errors were **522/544**, not **402**; memory was flat until **21 Jul** |
| Wrong password / missing API key | Auth worked earlier same day; browser “No API key” is from opening Auth URL without headers |
| User’s local internet | Edge logs show Cloudflare 522 from origin timeout |
| Timetable page alone | Small per-section reads |
| “We went live to all schools” | You didn’t — demo load was enough |

---

## 7. Architecture mismatch (why this keeps biting)

```
Alma demo (multi-feature SMS)
  → Nest API (DO)
  → Supabase Nano 0.5 GB (Auth + DB + Realtime + Storage)

App patterns assume "plenty of concurrent Auth/DB"
Nano assumes "hobby / light API"
```

Documented earlier in `docs/performance/performancemetricsv3.md` (reports N+1, Realtime, pooler). The **Promise.all “fix”** for reports likely **increased** peak concurrent pressure on Nano vs sequential.

---

## 8. Optimisation roadmap (focus order)

### Immediate (stability)

1. **Upgrade compute Nano → Micro** (or take Supabase “Upgrade for free” to Micro if still offered). Doubles RAM; buys time.  
2. Confirm project recovers (DB SQL works; login succeeds).  
3. Verify production env cron flags are all `false` as in `.env.prod`.

### Sprint 1 — stop Auth storms (biggest app win) — DONE 22 Jul 2026

1. ~~Remove list-page `getUserById` fan-out (students/staff/parents).~~  
2. ~~Prefer `profiles` email.~~  
3. Keep Auth Admin for create/update/delete/detail only.

### Sprint 2 — reports safe for small compute — partial DONE

1. Replace multi-section fan-out with SQL aggregation or RPC *(remaining)*.  
2. ~~Until then: **concurrency limit 4**.~~  
3. Frontend: enable admin report queries only when tab active *(remaining)*.

### Sprint 3 — Realtime / middleware — partial DONE

1. ~~Replace unfiltered messages-list Realtime with 20s polling.~~  
2. Reduce middleware Auth frequency where safe *(remaining)*.  
3. Audit Realtime connection count after navigating away from Messages/Notifications *(remaining)*.

### Sprint 4 — payload & export hygiene

1. Kill `select('*')` on hot paths.  
2. Cap/stream school data export; never full-tenant JSON in one shot on Free/Nano.  
3. ~~Results bulk PDF: fix O(N²) rank + one Chromium per ZIP~~ → **sequential Fix 6** (below).  
4. ID-card bulk: same shared-browser pattern (follow-on).  
5. Prefer async jobs for very large zips (later).

### Sprint 5 — measure

1. Supabase Reports: Memory, CPU, Database connections, Realtime connections — during a scripted demo.  
2. Capture before/after for Students list and Administrative reports.  
3. Keep this file updated when items are fixed.

---

## 8b. Sequential fix list (one-at-a-time; easy revert)

Boss-preferred order. Deploy/check after each.

| # | Fix | Status | Check |
|---|-----|--------|-------|
| 1 | Users list: no Auth Admin fallback for emails | Done | Login email + search on Users |
| 2 | Early departure list: prefetch timetable once per distinct student | Done | List + conflict flags; filters/year |
| 3 | Leaves list: batch quota context | Done | Used/total days still correct |
| 4 | Dashboard widgets: `limit: 1` + `meta.total` | Done | Pending badges match lists |
| 5 | Certificates history: lean list (no snapshot/row) | Done | History / CSV / PDF revoke |
| **6** | **Results PDF/ZIP: cache class batch + one Chromium per bulk job** | **Done (23 Jul 2026)** | Basic / detailed / Download All ZIP |
| 7 | Subject academic report: batch DB queries (not N× per section) | **Done (23 Jul 2026)** | Reports → Academic → pick subject |
| 8 | JwtAuthGuard / middleware Auth caching | **Done (23 Jul 2026)** | Login, logout, deactivate ≤30s, fewer `GET /user` |

### Fix 6 — Results basic / detailed / Download All ZIP (CRITICAL) — DONE 23 Jul 2026

**Implemented:**

1. **Bulk ZIP** (`getBulkResultCardPdfStream`): one `getResultsForClassSection`, precomputed ranks, HTML from batch DTOs — no per-student `generateResultCardPdf` / `getClassRank` loop.  
2. **One Chromium** for the whole ZIP (serial `newPage` → pdf → `page.close`).  
3. **Single basic PDF:** one class-section batch for marks + rank (no parallel `getResultForStudent` + full-class `getClassRank`).  
4. **Detailed PDF:** unchanged content path; class rank still uses one class batch via `getClassRank` (not O(N²) ZIP).  

**Out of scope (follow-on):** app-wide Puppeteer pool, async ZIP job queue, ID-card bulk shared browser.

**Check:** Results → basic + detailed for one student; Download All ZIP for a section; ranks/names match previous behaviour.

### Fix 7 — Subject academic report batched queries — DONE 23 Jul 2026

**Was:** `getAcademicReportBySubject` looped every allowed class section with ~6–8 DB round-trips each (N× query storm; sequential but still heavy on Nano).

**Now:** Load class_sections, classes, sections, enrolments, assessments, students, grades, and profiles in a few batched queries, then assemble `byClass` in memory. Same averages / top5 / struggling maths.

**Check:** Reports → Administrative → Academic → select a subject — class rows, averages, top/struggling look correct; export PDF/Excel if used.

### Fix 8 — JwtAuthGuard / middleware Auth caching (safe) — DONE 23 Jul 2026

**Backend:** Short-TTL (30s, max 2 min via `AUTH_USER_CACHE_TTL_MS`) in-memory cache of successful Auth validation keyed by SHA-256(token). Cache hit skips `auth.getUser` + roles + active checks. Never caches failures. Drops entry if JWT `exp` passed. Caps at 500 entries.

**Frontend middleware:** Call `getUser()` only when an `sb-*-auth-token*` cookie exists — anonymous landing traffic no longer hits Auth every navigation.

**Trade-off (documented):** deactivate / forced revoke may take up to ~30s to apply on Nest if the old access token is still sent. Normal logout clears the client token → immediate 401.

**Check:** Login → dashboard (Auth logs: fewer repeated `/user` for same second). Logout → cannot use API. Landing pages as anonymous: no Auth flood. Optional: deactivate user → blocked within ~30s.

---

## 9. Suggested demo-safe checklist (after Sprint 1)

Avoid on Nano / Free during live demos (until Fix 6+):

- [ ] School **data export** (full backup zip)  
- [ ] Bulk **results** ZIP / many detailed PDFs (mitigated by Fix 6 — still prefer modest sections on Nano)  
- [ ] Bulk **ID card** zip for large sections  
- [ ] Rapid-fire navigation that hammers middleware Auth (still open)  

Safer now (Sprint 1 + sequential 1–5):

- [x] Opening **Students / Staff / Parents** lists (Auth storms removed)  
- [x] **Administrative reports** (concurrency capped at 4)  
- [x] Leaving **Messages** open (no unfiltered Realtime)  
- [x] Certificates **history** list (lean mapper)  
- [ ] Single class timetable view  
- [ ] Single student/staff detail  
- [ ] Small attendance take for one section  
- [ ] One PDF at a time (still OK; avoid ZIP until Fix 6)  

---

## 10. File index (primary offenders)

| Area | Paths |
|------|--------|
| Auth storms | `backend/src/modules/students/students.service.ts`, `staff/staff.service.ts`, `parents/parents.service.ts` |
| Reports fan-out | `backend/src/modules/reports/reports.service.ts` |
| Realtime | `frontend/src/hooks/useNotificationsRealtime.ts`, `frontend/src/app/(portal)/messages/page.tsx` |
| Middleware Auth | `frontend/src/middleware.ts` |
| School zip export | `backend/src/modules/data-export/school-data-collector.service.ts`, `data-export.service.ts` |
| Bulk PDF zips | `backend/src/modules/id-cards/id-cards.service.ts`, `results/results.service.ts` (`getBulkResultCardPdfStream`, `generateResultCardPdf`, `getClassRank`, `printResultCardHtmlToPdf`) |
| Timetable | `backend/src/modules/timetable/timetable.service.ts` (secondary) |
| Substitutions | `backend/src/modules/substitutions/substitutions.service.ts` `buildCandidatePool` |
| Prior audits | `docs/performance/performancemetricsv3.md`, `performancereportv2.md`, `performancefindings.md` |

---

## 11. Bottom line

**You did not need full production traffic.** On Nano, a normal Alma demo that touches lists, reports, Realtime, and Results PDF/ZIP is enough to drive RAM from ~45% → ~80%, drop the standby connection, and leave Auth returning 522.

- **Results tab PDFs / Download All ZIP:** **high-confidence demo burst** (O(N²) class recompute + Chromium per PDF) — **Fix 6 next** after Fix 5.  
- **School data-export zip:** still worst-case if used.  
- **Timetable:** minor contributor.  
- **Other main causes:** Auth Admin per-row fetches (Sprint 1 fixed) + unbounded report parallelism (capped) + Realtime + Auth-on-every-nav, on **0.5 GB** shared compute.

**Next engineering focus:** measure under a scripted demo; optional Micro upgrade for idle floor. Remaining roadmap: SQL-aggregated attendance reports, export guards, shared Puppeteer pool later.
