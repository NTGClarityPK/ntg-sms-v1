# Alma Deep Scan Phase 2 — Frontend + Multi-Tenant

**Date:** 24 Jul 2026  
**Scope:** Categories 3 (Frontend / Next.js) and 4 (Multi-Tenant Isolation) only  
**Method:** Read-only audit — frontend codebase, Nest controllers/guards, crons; cross-link Phase 1 noisy-neighbour findings  
**Instructions:** [docs/performance/deep-scan.md](deep-scan.md)  
**Prior:** [DEEP_SCAN_1(DB-BACKEND)_Report.md](DEEP_SCAN_1(DB-BACKEND)_Report.md), [memory-load-reasons.md](memory-load-reasons.md)

Phase 3 will cover Code smells and Monitoring.

---

## Executive Summary

- **Phase-2 composite score: 51/100** (Frontend 57% + Multi-tenant 43%)
- **Recommendation:** Fix critical isolation holes on `branches` APIs and guardian IDOR **before** wider go-live; frontend is usable but almost entirely client-rendered with dashboard/API chatter that will amplify Nano load at 50+ tenants.
- **Top 3 risks before go-live:**
  1. Authenticated `GET/PUT /api/v1/branches` without tenant/membership scope (cross-tenant metadata leak / mutation)
  2. Guardians-by-student IDOR (`studentId` only; branch context unused)
  3. Email-domain privileged bypass + FE-triggered heavy ops (export / PDF zips / challans) with no client throttle
- **Estimated effort to reach Phase-2 ~85+:** ~2–3 person-weeks (isolation fixes are highest priority; FE splits/dynamic imports parallelisable)

### Already mitigated (do not reopen)

| Item | Status |
|------|--------|
| Middleware Auth on anonymous landing | Fix 8 — `getUser` only with `sb-*-auth-token*` cookie |
| Dashboard widget `limit: 1` + `meta.total` | Fix 4 |
| Messages unfiltered Realtime list | Sprint 1 — 20s poll remains (see M5) |
| Results ZIP Chromium storm | Fix 6 (backend); FE still triggers ZIP (noisy neighbour) |

### Bundle analysis note

`next build` was **not** run in this pass (long CI-style build; portal already client-heavy). Evidence instead: **0** `next/dynamic` usages; static `recharts` on all role dashboards; mega client pages (settings/messages >1500 lines). Treat First Load JS as **likely over 300KB** on dashboard/settings until a build artefact is captured in CI.

---

## Category Scores

| Category | Score | Status |
|----------|-------|--------|
| Frontend / Next.js | **58/100** | Fair — moderate refactoring before scale |
| Multi-Tenant Isolation | **42/100** | Poor — significant isolation issues (scored harshly) |
| **Phase-2 overall** | **51/100** | Poor–Fair |

**Formula:** `0.57 × Frontend + 0.43 × Multi-tenant`.

---

## Critical Issues (Must Fix Before Go-Live)

### C1: Global branches list — any JWT user can page all branches

- **Status:** Fixed (scan-section-1 — 24 Jul 2026)
- **Category:** Multi-Tenant
- **Severity:** Critical
- **File:** `backend/src/modules/branches/branches.controller.ts:23-30` + `branches.service.ts:98-110`
- **Current code:**
```typescript
@Get()
async list(@Query() query: QueryBranchesDto) {
  return this.branchesService.list(query);
}
// service:
.from('branches').select('*', { count: 'exact' }).range(from, to)
// no tenant_id / user_branches filter
```
- **Problem:** Controller uses `JwtAuthGuard` only — **no `BranchGuard`**, no membership filter.
- **Impact at scale:** Every school admin (or any logged-in user who discovers the route) can enumerate platform branches (names, codes, phones) — classic SaaS data leak under multi-tenant load and probing.
- **Proposed fix:** Scope list to `user_branches` for normal users; platform list only for `super_admin` / admin portal roles.
- **Estimated effort:** 4–8 hours
- **Expected impact:** Closes highest-severity enumeration hole.
- **Fix:** `list` now filters at DB by `user_branches` (members), `tenant_id` (`tenant_owner`), or unfiltered (`super_admin`).

### C2: Get/update branch by ID without membership check

- **Status:** Fixed (scan-section-1 — 24 Jul 2026)
- **Category:** Multi-Tenant
- **Severity:** Critical
- **File:** `backend/src/modules/branches/branches.controller.ts` (`@Get(':id')`, `@Put(':id')`) + service `eq('id', id)` only
- **Problem:** Knowing/guessing a UUID (from C1) allows cross-tenant read/update of branch metadata.
- **Impact at scale:** Integrity + confidentiality failure across all tenants sharing the API.
- **Proposed fix:** Require `user_branches` membership or admin role; use `BranchGuard` + ownership checks.
- **Estimated effort:** 4–8 hours
- **Fix:** `getById` / `update` require `user_branches` membership or `super_admin`; non-members get **403** + deny audit log.

### C3: `updatePublicStats` — role check only, no branch membership

- **Status:** Fixed (scan-section-1 — 24 Jul 2026)
- **Category:** Multi-Tenant
- **Severity:** Critical
- **File:** `backend/src/modules/branches/branches.controller.ts:45-65`
- **Current code:**
```typescript
const canEdit = roleNames.includes('school_admin') || ... || 'super_admin';
await this.branchesService.updatePublicStats(id, ...);
```
- **Problem:** A `school_admin` of tenant A can mutate public-stats fields for branch B’s `id`.
- **Impact at scale:** Cross-tenant vandalism of public statistics pages.
- **Proposed fix:** Verify caller’s `user_branches` includes `id` (or same `tenant_id`); reject otherwise.
- **Estimated effort:** 2–4 hours
- **Fix:** Role check retained; membership (or `super_admin`) asserted before mutate.
### C4: Guardians-by-student IDOR

- **Status:** Fixed (scan-section-2 — 27 Jul 2026)
- **Category:** Multi-Tenant
- **Severity:** Critical
- **File:** `backend/src/modules/parents/parents.controller.ts:175-182` + `parents.service.ts:366-373`
- **Current code:**
```typescript
@Get('students/:studentId/guardians')
@UseGuards(BranchGuard)
async getGuardiansForStudent(@Param('studentId') studentId: string, @CurrentBranch() branch?) {
  const data = await this.parentsService.getGuardiansForStudent(studentId); // branch unused
}
// service: .from('parent_students').select('*').eq('student_id', studentId)
```
- **Problem:** BranchGuard only proves the caller has *some* branch; student is not verified to belong to that branch.
- **Impact at scale:** Cross-branch/tenant PII (guardian names/contacts) if `studentId` leaks (URLs, logs, exports).
- **Proposed fix:** Assert student `branch_id === CurrentBranch.branchId` (or enrolment) before hydrate.
- **Estimated effort:** 2–4 hours
- **Fix:** HTTP path passes `GuardiansAccessContext`; service asserts `students.branch_id === CurrentBranch` (super_admin bypass); mismatch → 403 + deny audit. Internal callers omit access.

### C5: Email-domain privileged bypass in BranchGuard

- **Status:** Fixed (scan-section-3 — 27 Jul 2026)
- **Category:** Multi-Tenant
- **Severity:** Critical (policy / production risk)
- **File:** `backend/src/common/guards/branch.guard.ts:36-40`, `197-202`
- **Current code:**
```typescript
const isPrivileged =
  roles.includes('super_admin') ||
  email.endsWith('@ntg.com') ||
  email.endsWith('@example.com') ||
  email.endsWith('@ntgclarity.com');
if (isPrivileged) { /* attach branch; return true — skips inactive checks */ }
```
- **Problem:** Hardcoded email suffixes grant elevated behaviour; inactive tenant/branch checks skipped for privileged path.
- **Impact at scale:** Accidental or compromised `@ntg.com` accounts bypass operational safety rails; confusing for true multi-tenant ops.
- **Proposed fix:** Privileges only via DB role (`super_admin`); remove domain shortcuts from production builds (or gate behind explicit env).
- **Estimated effort:** 2–4 hours (+ QA)
- **Fix:** Email-domain privilege removed from BranchGuard, auth, JWT, tenants/branches/academic-years controllers. Privilege via `super_admin` (or temporary `ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION`). Inactive checks apply to everyone. See `docs/security/privileged-access-migration.md`.

---

## Major Issues (Fix Within 30 Days)

### M1: Admin dashboard — ~10 parallel API queries + static recharts ×4 role bundles

- **Category:** Frontend
- **Severity:** Major
- **File:** `frontend/src/components/features/dashboard/AdminDashboardOverview.tsx:78-96` + `dashboard/page.tsx:18-21`
- **Current code:**
```typescript
useStudents({ limit: 1, page: 1 });
useStaff({ limit: 1, page: 1 });
useLeaveRequests({ status: 'pending', page: 1, limit: 1 });
useEarlyDepartures({ status: 'pending', page: 1, limit: 1 });
useStorageOverview(); useLowStock(); useUnreadCount();
useConflicts(); useUpcomingEventsConflictCount();
useAttendanceSummary(...);
// page statically imports Admin + Teacher + Parent + Student overviews
```
- **Problem:** Login landing still multiplies Auth/BranchGuard/DB (Phase 1 M1). All four dashboards ship in one client chunk; recharts imported statically.
- **Impact at scale:** Every concurrent login spikes Nano + Nest; worst on Monday morning.
- **Proposed fix:** Single `/dashboard/summary` aggregator; `next/dynamic` per role overview + chart; keep Fix 4 limits.
- **Estimated effort:** 2–3 days

### M2: Zero `next/dynamic` — heavy libs always in graph

- **Category:** Frontend
- **Severity:** Major
- **Evidence:** **0** `next/dynamic` matches; `recharts` statically imported in 5 dashboard/substitution files; `pdfjs-dist` / `react-pdf` / `xlsx` in package.json for client features.
- **Problem:** Portal JS payload stays large even when user never opens charts/PDF viewers.
- **Impact at scale:** Slower TTI on school devices; more memory on shared demos.
- **Proposed fix:** Dynamic-import charts, PDF viewers, bulk-import Excel UI, onboarding tour.
- **Estimated effort:** 1–2 days

### M3: Almost all App Router pages are `'use client'`

- **Category:** Frontend
- **Severity:** Major (architecture)
- **Evidence:** ~**102 / 108** `page.tsx` files are client; ~6 server (redirects / legal / some landing).
- **Problem:** No meaningful RSC boundary for portal; all data via client hooks → more API chatter.
- **Impact at scale:** Harder to cut waterfalls; every navigation hydrates large trees.
- **Proposed fix:** Push `'use client'` down into interactive islands; keep shells as server components where safe.
- **Estimated effort:** Ongoing (start with dashboard, reports, settings shell) — 1 week initial

### M4: `DynamicThemeProvider` — DOM polling every 300ms

- **Category:** Frontend
- **Severity:** Major
- **File:** `frontend/src/components/providers/DynamicThemeProvider.tsx` (~1256 lines; intervals ~1076, ~1159, ~1244)
- **Current code:**
```typescript
const interval = setInterval(applyHeaderStyles, 300);
```
- **Problem:** Three global intervals + MutationObservers on every portal session.
- **Impact at scale:** Main-thread tax × open tabs × users; worsens low-end school PCs.
- **Proposed fix:** Apply styles once on theme change / Mantine theme tokens; remove interval loops.
- **Estimated effort:** 1 day

### M5: Messages — 20s polling + verbose `console.log` in Realtime path

- **Category:** Frontend
- **Severity:** Major
- **File:** `frontend/src/app/(portal)/messages/page.tsx:104-107`, ~147–187 (~1529 lines; **16** `console.log` hits)
- **Problem:** Polling every 20s per open Messages tab (Sprint 1 trade-off) plus debug logging in production builds.
- **Impact at scale:** Steady Nest/Auth/DB drip; console noise hides real errors.
- **Proposed fix:** Prefer filtered Realtime for conversation list metadata; strip debug logs; raise interval if poll kept.
- **Estimated effort:** 4–8 hours

### M6: Undebounced API search (assessments, id-cards, fee payments)

- **Category:** Frontend
- **Severity:** Major (pattern)
- **Files:** `assessments/page.tsx:80-135`, `id-cards/page.tsx:40-79`, `components/fees/PaymentsTab.tsx:112-131`
- **Problem:** Each keystroke (or immediate state update) refetches lists. Students/library already use `useDebouncedValue(..., 300)`.
- **Impact at scale:** Search box storms across concurrent users.
- **Proposed fix:** Standardise 300–500ms debounce on all list `search` query params.
- **Estimated effort:** 2–4 hours

### M7: Reports / Results / Settings eager or waterfall fetches

- **Category:** Frontend
- **Severity:** Major
- **Files:** `reports/page.tsx:103-122` (students limit 100 + class sections + public counts regardless of tab); `results/page.tsx:95-120` (staff → sections → results/cards/readiness); `settings/page.tsx` (**1530** lines, static tab imports + debug `console.log` ~891–898)
- **Problem:** Inactive tabs still cost network; settings ships all tab modules up front.
- **Impact at scale:** Admin “Reports/Settings” clicks amplify Phase 1 backend costs.
- **Proposed fix:** `enabled: activeTab === ...`; dynamic import tab panels; remove debug logs.
- **Estimated effort:** 1–2 days

### M8: Settings-import apply trusts in-memory token only

- **Category:** Multi-Tenant
- **Severity:** Major
- **File:** `settings-import.controller.ts` + `settings-import.service.ts` (`preparedImports` Map)
- **Problem:** Apply uses `validationToken` → stored `prepared.branchId`; not rebound to `@CurrentBranch()`. Stolen token writes another branch.
- **Impact at scale:** Cross-branch config overwrite if token leaks (logs, XSS, shared machines).
- **Proposed fix:** Re-validate token’s `branchId === CurrentBranch`; short TTL; single-use tokens.
- **Estimated effort:** 4–6 hours

### M9: Late-fee + subscription crons — cross-tenant, little backpressure

- **Category:** Multi-Tenant / noisy neighbour
- **Severity:** Major
- **Files:** `fees/late-fee.service.ts` (`LATE_FEE_JOB_ENABLED`, production default on); `subscription.service.ts` end-of-period (`SUBSCRIPTION_END_OF_PERIOD_JOB_ENABLED`)
- **Problem:** Selects all due rows across tenants; serial/N+1 processing without hard concurrency caps (Phase 1 noted `.env.prod` intent — verify live DO env).
- **Impact at scale:** Nightly jobs tip Nano while schools sleep; fee day + cron overlap is worse.
- **Proposed fix:** Confirm prod flags; batch with limits; per-tenant isolation / queue.
- **Estimated effort:** 1–2 days

### M10: FE noisy-neighbour triggers (no client throttle)

- **Category:** Multi-Tenant (FE) — backend severity already Phase 1 C1–C3
- **Severity:** Major
- **Evidence:** Data export tab; ID-cards bulk ZIP (`useIdCards.ts`); Results `handleBulkZip`; fee `ChallansTab` generate
- **Problem:** One click starts backend-critical work; UI only sets local loading flags.
- **Impact at scale:** Demo or fee day recreates 21 Jul tip pattern even after backend optimisations.
- **Proposed fix:** Confirm dialogs + disable re-entry; optional FE cooldown; rely on server rate limits (Phase 1 M6).
- **Estimated effort:** 4–8 hours FE + server limits

### M11: BranchGuard inactive fallback may attach stale branch context

- **Category:** Multi-Tenant
- **Severity:** Major
- **File:** `backend/src/common/guards/branch.guard.ts:205-249`
- **Problem:** After inactive fallback updates `branchId`, request may still attach original `branchRow` in some paths.
- **Impact at scale:** Writes/reads against wrong branch after admin deactivates a branch.
- **Proposed fix:** Re-load branch row after fallback before attaching `request['branch']`.
- **Estimated effort:** 2–3 hours

---

## Minor Issues

- Raw `<img>` in ID card UI (~2) vs `next/image` (~6 imports) — prefer `next/image` with sizes.
- `next/font` correctly used in root layout (Saira / Audiowide / JetBrains Mono) — good.
- QueryClient defaults are sound (`staleTime` 5m, no refetch on focus) — `frontend/src/lib/query-client.ts`.
- Zustand stores are small (auth/theme/branding/onboarding/student-session) — no god-store.
- Dual icon packs (`@tabler/icons-react` + `react-icons`) — bundle cost; prefer one.
- `tailwindcss` in frontend `devDependencies` while project rules ban Tailwind in app UI — dead weight / confusion.
- `tenant_owner` can list all tenants (`tenants` admin path) — confirm intentional.
- Substitution reminder cron capped at 100 — acceptable residual.
- Partition strategy still needed when attendance/grades/audit_logs grow (Phase 1 sizes still demo-scale).

---

## Multi-Tenant Risk Register

| ID | Risk | Blast radius | Trigger |
|----|------|--------------|---------|
| MT-1 | Unscoped branches list/get/update | All tenants’ branch metadata | Any JWT + `/api/v1/branches` |
| MT-2 | Public-stats cross-branch mutate | Public pages / reputation | School admin + foreign branch UUID |
| MT-3 | Guardians IDOR | Parent PII | Auth user + foreign `studentId` |
| MT-4 | Email-domain privilege | Ops safety rails | `@ntg.com` / `@ntgclarity.com` accounts |
| MT-5 | Import validation token | Branch config integrity | Stolen UUID apply |
| MT-6 | `localStorage` → `X-Branch-Id` | Own-branch mix-ups (spoof of *other* tenants blocked by `user_branches`) | Client LS edit |
| MT-7 | Late-fee / subscription crons | Shared DB/Nest | Nightly jobs if enabled |
| MT-8 | Export / ID ZIP / Results ZIP / challan generate | Nest RAM + Supabase | Admin UI clicks (Phase 1 C1–C3) |
| MT-9 | Assessment publish fan-out | Notifications table | Publish button (Phase 1 C4) |
| MT-10 | ~15 controllers without BranchGuard | Must self-scope | Public/auth OK; `branches` not OK |

**Spoofability verdict:** Client can set any `currentBranchId`; backend **does not** trust header alone when `BranchGuard` is present (`user_branches` check + fallback). Controllers **without** BranchGuard must self-scope — `branches` currently fails that test.

**Coverage:** ~**58 / 73** controllers reference `BranchGuard`; notable gaps include `branches`, plus intentional public/auth/webhook/student-self paths.

---

## Frontend Metrics Baseline

| Metric | Value (24 Jul 2026) |
|--------|---------------------|
| `page.tsx` with `'use client'` | ~102 / ~108 |
| `next/dynamic` usages | **0** |
| Static `recharts` imports | 5 files |
| Admin dashboard parallel queries on mount | ~10 |
| Messages `refetchInterval` | 20_000 ms |
| Theme DOM poll interval | 300 ms × 3 |
| Largest UI files | settings 1530; messages 1529; DynamicThemeProvider 1256; ChallansTab 1133 |
| QueryClient default `staleTime` | 5 minutes |
| First Load JS (build) | **Not measured this pass** |

---

## Recommended Roadmap (FE + Multi-tenant)

### Week 1 (Critical isolation)

- [ ] C1–C3 — Scope `branches` APIs + public-stats membership
- [ ] C4 — Guardians require student-in-branch
- [ ] C5 — Remove/env-gate email-domain privilege
- [ ] M11 — BranchGuard inactive fallback re-fetch

### Week 2–4

- [ ] M8 — Import apply rebound to CurrentBranch
- [ ] M9 — Cron flags + batching (align with live DO env)
- [ ] M10 — FE confirmations + server rate limits on export/PDF/challan
- [ ] M1–M3 — Dashboard aggregator + dynamic imports + start RSC push-down
- [ ] M4 — Kill theme 300ms intervals
- [ ] M5–M7 — Messages logs/poll; debounce searches; tab-gated reports/settings

### Ongoing

- [ ] Capture `next build` First Load JS in CI for top 10 routes
- [ ] Consolidate icon library; remove unused Tailwind if confirmed unused
- [ ] Partition plan when hot tables approach multi-million rows

---

## Phase boundary

| Phase | Status |
|-------|--------|
| Phase 1 — DB + Backend | Done — overall **62** |
| **Phase 2 — Frontend + Multi-tenant** | **This report — overall 51** |
| Phase 3 — Code smells + Monitoring | Next |

---

## Appendix — Score derivation

**Frontend 58:** − client-page dominance (−8); − no dynamic + recharts (−8); − dashboard fan-out (−7); − theme intervals (−7); − undebounced search (−5); − eager reports/settings/messages logging (−7); + QueryClient / next/font / small Zustand (+6).

**Multi-tenant 42 (harsh):** − branches enumeration/mutation (−15); − public-stats IDOR (−10); − guardians IDOR (−8); − email privilege (−8); − import token (−5); − crons (−6); − FE noisy triggers (−5); + BranchGuard coverage on most modules (+7).

**Overall:** `0.57 × 58 + 0.43 × 42 = 33.06 + 18.06 = 51.1` → **51**.
