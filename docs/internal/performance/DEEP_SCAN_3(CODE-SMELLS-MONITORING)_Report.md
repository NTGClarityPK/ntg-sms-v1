# Alma Deep Scan Phase 3 — Code Smells + Monitoring

**Date:** 24 Jul 2026  
**Scope:** Categories 6 (Code Smells & Duplication) and 7 (Monitoring & Observability) only  
**Method:** Read-only audit — quantitative greps over `backend/src` + `frontend/src`, deep-read of god files / health / exception filter; no madge dependency graph  
**Instructions:** [docs/performance/deep-scan.md](deep-scan.md)  
**Prior:** [DEEP_SCAN_1(DB-BACKEND)_Report.md](DEEP_SCAN_1(DB-BACKEND)_Report.md), [DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md](DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md)

API Performance (Category 5) is synthesised in the [overall rollup](DEEP_SCAN_OVERALL_Report.md), not re-scored as a deep scan here.

---

## Executive Summary

- **Phase-3 composite score: 44/100** (Code smells 50% + Monitoring 50%)
- **Recommendation:** Observability is a go-live gap (no APM, shallow health, no correlation IDs); code-quality debt is concentrated in god services/components and duplicated Puppeteer / `select('*')` patterns already flagged in Phases 1–2.
- **Top 3 risks before go-live:**
  1. Blind production incidents — no Sentry/Datadog, no request/tenant tags on logs, `/health` does not touch the DB
  2. God Nest services (`reports` ~3.7k lines, `assessments` ~3.0k) — high change risk and hard to reason about under load
  3. Dual logging culture (`console.*` in hot modules vs sparse Nest `Logger`) — noisy FE (messages) and unfilterable BE output
- **Estimated effort to reach Phase-3 ~85+:** ~1.5–2 person-weeks (Sentry + request ID middleware + health readiness + ESLint budgets; god-file splits are multi-sprint)

### Already mitigated (do not reopen)

| Item | Status |
|------|--------|
| Global `ValidationPipe` (whitelist / forbid) | Present in `main.ts` |
| Nest `HttpExceptionFilter` with `Logger` | Present; no tenant/request ID yet |
| Response compression | `compression()` in `main.ts` |
| Portal `error.tsx` boundary | Exists; only `console.error` today |

---

## Category Scores

| Category | Score | Status |
|----------|-------|--------|
| Code Smells & Duplication | **50/100** | Poor — significant debt in size/duplication/`any` |
| Monitoring & Observability | **38/100** | Critical — must fix before confident go-live ops |
| **Phase-3 overall** | **44/100** | Poor |

**Formula:** `0.50 × Smells + 0.50 × Monitoring`.

---

## Quantitative inventory (Code smells)

| Metric | Backend (`src`, excl. scripts) | Frontend (`src`) | Notes |
|--------|--------------------------------|------------------|-------|
| TS files scanned | 592 | 537 | — |
| Explicit `any` usages | **115** | **58** | Pattern: `: any` / `as any` / `Promise<any>` / `Record<string, any>` |
| `console.(log\|error\|warn\|debug\|info)` | **36** | **54** | Scripts excluded on BE; FE hotspots include messages/grades |
| `TODO` / `FIXME` / `HACK` | **2** | **0** | Both in subject-templates controller |
| `new Logger(` | **7** modules | — | Sparse vs console |
| `this.logger.(log\|error\|…)` calls | **~25** | — | Mostly filter + a few services/schedulers |

### Top `any` hotspots

| Location | Count |
|----------|------:|
| `backend/.../assessments/assessments.service.ts` | 41 |
| `backend/.../fees/late-fee.service.ts` | 12 |
| `frontend/.../lib/utils/createDynamicTheme.ts` | 13 |
| `backend/.../fees/payment.service.ts` | 9 |
| `frontend/.../hooks/api/useGrades.ts` | 6 |

### God services (Nest `*.service.ts`, flag >800 lines)

| Lines | File |
|------:|------|
| 3657 | `backend/src/modules/reports/reports.service.ts` |
| 2993 | `backend/src/modules/assessments/assessments.service.ts` |
| 2340 | `backend/src/modules/timetable/timetable.service.ts` |
| 2165 | `backend/src/modules/results/results.service.ts` |
| 1992 | `backend/src/modules/events/events.service.ts` |
| 1992 | `backend/src/modules/students/students.service.ts` |
| 1838 | `backend/src/modules/attendance/attendance.service.ts` |
| 1406 | `backend/src/modules/fees/challan.service.ts` |
| 1374 | `backend/src/modules/bulk-import/bulk-import.service.ts` |
| 1347 | `backend/src/modules/messages/messages.service.ts` |
| 1318 | `backend/src/modules/core-lookups/core-lookups.service.ts` |
| 1200 | `backend/src/modules/auth/auth.service.ts` |

Twelve services exceed the deep-scan **800-line** god threshold; several also exceed **20 public methods** by inspection (reports, assessments, timetable, students).

### God components / pages (FE >500 lines)

| Lines | File |
|------:|------|
| 1529 | `frontend/src/app/(portal)/settings/page.tsx` |
| 1528 | `frontend/src/app/(portal)/messages/page.tsx` |
| 1255 | `frontend/src/components/providers/DynamicThemeProvider.tsx` |
| 1132 | `frontend/src/components/fees/ChallansTab.tsx` |
| 1103 | `frontend/src/components/assessments/AssessmentForm.tsx` |
| 930 | `frontend/src/components/layout/Sidebar.tsx` |
| 891 | `frontend/src/app/(auth)/signup/page.tsx` |
| 878 | `frontend/src/app/(portal)/students/bulk-import/page.tsx` |
| 826 | `frontend/src/components/features/timetable/ClassTimetableContent.tsx` |
| 806 | `frontend/src/app/(portal)/parent/pin-management/page.tsx` |
| 724 | `frontend/src/app/(portal)/assessments/page.tsx` |
| 698 | `frontend/src/app/(auth)/login/page.tsx` |

Aligns with Phase 2 top mega-pages; expands the same smell family.

### TODO / FIXME list (complete — only 2)

| File:line | Text |
|-----------|------|
| `backend/src/modules/subject-templates/subject-templates.controller.ts:91` | `// TODO: Get active academic year if not provided` |
| `backend/src/modules/subject-templates/subject-templates.controller.ts:105` | Same TODO (duplicate call sites) |

Low TODO count is positive; incomplete behaviour still hides behind comments rather than tracked tickets.

### Magic strings / hardcoded privilege domains

Cross-link Phase 2 C5:

- `backend/src/common/guards/branch.guard.ts:36-40` — `@ntg.com` / `@example.com` / `@ntgclarity.com` email suffix privilege
- Also mirrored in `branches.controller.ts`, `academic-years.controller.ts`, `tenants.controller.ts`, `auth.service.ts`

### Nest Logger vs console

| Pattern | Evidence |
|---------|----------|
| Structured Nest Logger | `HttpExceptionFilter`, Jwt/Student guards, tenants service/scheduler, invitations, substitutions reminder |
| `console.*` in app modules | `notifications.service.ts` (12), `main.ts` (9), `push.service.ts` (5), `registration.service.ts` (4), plus library/attendance/audit-log |
| FE console | `messages/page.tsx` (19), `useGrades.ts` (11), `useFileUpload.ts` (7), portal `error.tsx` |

**Verdict:** Logger adoption is patchy; operational paths still print to stdout without metadata.

---

## Critical Issues (Must Fix Before Go-Live)

### C1: No APM / error tracking in application code

- **Category:** Monitoring
- **Severity:** Critical
- **Evidence:** No matches for Sentry, Datadog, New Relic, or app-level OpenTelemetry SDK usage under `backend/src` / `frontend/src` (transitive `@opentelemetry/api` in lockfiles only). No `@sentry/*` in workspace `package.json` files.
- **Problem:** Auth failures, Stripe/webhook errors, export OOMs, and Puppeteer crashes are invisible except via host logs / user reports.
- **Impact at scale:** Multi-tenant incidents cannot be sliced by school; MTTR stays high during exam/fee bursts.
- **Proposed fix:** Add Sentry (or equivalent) to Nest + Next; tag `tenantId` / `branchId` / `userId` (hashed if needed); sample transactions on PDF/export/auth.
- **Estimated effort:** 1–2 days
- **Expected impact:** First real production error signal + release health.

### C2: `/health` is liveness-only (no dependency check)

- **Category:** Monitoring
- **Severity:** Critical
- **File:** `backend/src/app.controller.ts:19-22`, `backend/src/app.service.ts:5-7`
- **Current behaviour:** Returns `{ status: 'ok' }` with **no** Supabase/Postgres ping, disk, or queue check.
- **Problem:** Load balancers and DigitalOcean health probes can mark the API healthy while Auth/DB is 522 (as on demo day).
- **Impact at scale:** False greens during Nano Unhealthy / connection storms; traffic continues into a dying dependency.
- **Proposed fix:** Split `GET /health` (liveness) vs `GET /health/ready` (DB `select 1` / Auth reachability with short timeout).
- **Estimated effort:** 2–4 hours
- **Expected impact:** Correct orchestration failovers.

### C3: No request / correlation IDs; logs lack tenant tags

- **Category:** Monitoring
- **Severity:** Critical
- **File:** `backend/src/common/filters/http-exception.filter.ts:95-99` (logs `method` + `url` + stack only)
- **Problem:** No middleware sets `x-request-id`; exception filter and services do not attach `tenantId` / `branchId`. Grep for correlation/`AsyncLocalStorage` request tracing found no framework usage.
- **Impact at scale:** Cannot reconstruct a single parent’s failing payment or export across Nest + Supabase logs.
- **Proposed fix:** Request-ID middleware → AsyncLocalStorage / CLS; include id + branch in every `Logger` call and error JSON (optional `requestId` field).
- **Estimated effort:** 1 day
- **Expected impact:** Debuggable multi-tenant incidents.

---

## Major Issues (Fix Within 30 Days)

### M1: God Nest services (>800 lines, multi-concern)

- **Category:** Code smells
- **Severity:** Major
- **Files:** See god-service table (`reports`, `assessments`, `timetable`, `results`, …)
- **Problem:** PDF, queries, notifications, and business rules co-located; high regression risk; hard to unit-test hot paths.
- **Proposed fix:** Extract PDF helpers, query repositories, and notification side-effects per module (start with `reports` + `assessments`).
- **Estimated effort:** Multi-sprint; Week 1 can carve PDF + notify only.

### M2: God React pages/components (>500 lines)

- **Category:** Code smells
- **Severity:** Major
- **Files:** settings / messages / DynamicThemeProvider / ChallansTab / AssessmentForm (see table)
- **Problem:** Same as Phase 2 mega-client pages — re-render cost, review friction, impossible tree-shaking of tabs.
- **Proposed fix:** Tab-level code splitting + `next/dynamic`; push presentational chunks out of pages.

### M3: Duplicated Puppeteer launch family

- **Category:** Code smells (duplication) — cross-link Phase 1 criticals
- **Severity:** Major
- **Evidence:** `puppeteer.launch(` in id-cards (×5), reports (×5), results, fees, certificates, assessments, subscription invoice, revenue reports
- **Problem:** Copy-pasted browser args/lifecycle; no shared pool; each call site drifts.
- **Proposed fix:** Single `PdfBrowserService` with reuse/concurrency cap; delete per-module launch blocks.

### M4: Systemic `select('*')` duplication

- **Category:** Code smells / API payload — cross-link Phase 1
- **Severity:** Major
- **Evidence:** Widespread `.select('*')` across core-lookups, schedule, timetable, academic-years, branches, events, grades, users, etc.
- **Problem:** Same anti-pattern family; over-fetch + schema-coupling.
- **Proposed fix:** Column lists per DTO; CI grep warn on new `select('*')` in `modules/**`.

### M5: `console.*` in production paths + sparse Logger

- **Category:** Code smells + Monitoring
- **Severity:** Major
- **Files:** `notifications.service.ts`, `push.service.ts`, `messages/page.tsx`, `useGrades.ts`, `main.ts` CORS logs
- **Proposed fix:** ESLint `no-console` (error in app code, allow scripts); migrate to Nest `Logger` / FE logger facade that can forward to Sentry.

### M6: Explicit `any` concentration

- **Category:** Code smells
- **Severity:** Major
- **Count:** ~173 explicit `any` usages (BE 115 + FE 58); assessments service alone 41
- **Proposed fix:** `@typescript-eslint/no-explicit-any` warn → error with baseline budget; type Supabase row helpers for fees/assessments first.

### M7: Hardcoded email-domain privilege (smell + security)

- **Status:** Fixed (scan-section-3 — 27 Jul 2026)
- **Category:** Code smells (magic strings) — Phase 2 C5
- **File:** `branch.guard.ts:36-40`
- **Proposed fix:** Env allow-list or `super_admin` role only; remove domain suffix checks from production builds.
- **Fix:** Shared `privileged-access.util.ts`; magic domain checks removed from guards/controllers; optional env flag for migration. Docs: `docs/security/privileged-access-migration.md`.

### M8: Frontend errors only logged to console

- **Category:** Monitoring
- **File:** `frontend/src/app/(portal)/error.tsx:14-18`
- **Problem:** Portal boundary catches crashes but does not report to a backend/APM.
- **Proposed fix:** Report `digest` + route to Sentry inside `useEffect`.

### M9: No documented SLOs (p95/p99)

- **Category:** Monitoring
- **Evidence:** No `p95` / `p99` / `SLO` targets in `docs/` performance set (grep empty)
- **Proposed fix:** Document targets (e.g. auth/me p95 <200ms, list endpoints p95 <500ms, PDF job async) in `docs/performance/` and wire to APM alerts.

### M10: Critical-path coverage gaps

- **Category:** Monitoring
- **Paths:** Auth (`auth.service` / guards), Stripe/subscription, school data export, PDF/bulk jobs
- **Problem:** These are the highest blast-radius paths from Phases 1–2; none have dedicated error budgets or structured success/failure metrics.
- **Proposed fix:** Explicit spans + failure counters per path once APM lands.

---

## Minor Issues (Nice to Fix)

- Subject-templates TODOs for default academic year (`subject-templates.controller.ts:91,105`) — finish or ticket.
- Incomplete typing on some controller bodies (prefer dedicated DTOs everywhere; global ValidationPipe helps but `any` in services bypasses intent).
- Best-effort unused-code: no madge run; likely dead helpers inside god files — run `knip`/`ts-prune` in CI later.
- `main.ts` still uses `console.log` for CORS bootstrap instead of Nest Logger.
- Audit-log service uses `console` in places — should be Logger for consistency.
- Duplicate privilege-domain checks across multiple controllers (DRY + single policy module).

---

## Duplication Report

- **Total duplicated families called out:** 4 primary (not exhaustive AST clone detection)
- **Top hotspots:**
  1. **Puppeteer launch + PDF pipeline** — id-cards, reports, results, fees, certificates, assessments, subscription, revenue
  2. **`.select('*')` list/detail queries** — core-lookups, schedule, timetable, academic-years, branches, events, grades, users, …
  3. **Email-domain `isDev` / privileged checks** — BranchGuard + branches/academic-years/tenants/auth
  4. **Unbounded / wide `Promise.all` fan-out** — cited Phase 1 (grades, notifications); pattern smell remains in large services
- **Cross-link:** Do not re-score Phase 1 severity here; treat as maintainability debt amplifying those criticals.

---

## Unused Code Report (best-effort)

- **Method:** Grep + file-size inventory only; **no** madge/knip executed this pass.
- **Unused exports / files:** Not quantified.
- **Note:** God files almost certainly contain unreachable private helpers and alternate PDF paths; recommend `knip` after first split of `reports.service.ts`.

---

## Monitoring evidence scan (detail)

| Check | Result |
|-------|--------|
| APM / error tracking | **Absent** in app source |
| Health endpoint | `GET /health` → `{ status: 'ok' }` only |
| Structured logging | Partial Nest `Logger`; many `console.*` |
| Request ID / tracing | **Absent** |
| Tenant/branch log tags | **Absent** on exception filter |
| Exception filter | Logs status, message, stack, `METHOD url` |
| FE error boundary | Portal `error.tsx` → `console.error` only |
| SLO docs | **None** found |
| DB slow-query logging | **None** in Nest; rely on Supabase dashboard/advisors |
| Rate-limit metrics | No `@nestjs/throttler` / app rate limiter found |

---

## Tools to Add

| Tool | Purpose |
|------|---------|
| ESLint `no-console` (app) | Stop new console noise |
| `@typescript-eslint/no-explicit-any` with baseline | Budget down from ~173 |
| Sentry (Nest + Next) | Errors + optional performance |
| Request-ID middleware + CLS | Correlate logs |
| CI grep on `select('*')` / `puppeteer.launch` | Prevent duplication growth |
| `knip` or `ts-prune` | Unused exports after god splits |
| Documented SLOs + alert rules | Ops contract |

---

## Phase-3 roadmap

### Week 1

- [ ] C1 — Sentry (or equivalent) on API + portal; tag tenant/branch
- [ ] C2 — Readiness health with DB ping
- [ ] C3 — Request ID middleware + enrich `HttpExceptionFilter`
- [ ] M5 — ESLint `no-console`; replace hottest FE/BE consoles
- [ ] M7 — Remove/env-gate email-domain privilege (with Phase 2 C5)

### Week 2–4

- [ ] M8–M10 — Error boundary reporting; SLO doc; spans on auth/export/PDF/Stripe
- [ ] M3–M4 — Shared PDF browser service; start `select('*')` eradication on hot lists
- [ ] M1–M2 — Split `reports` / `assessments` and settings/messages pages
- [ ] M6 — `any` budget: assessments + fees + `createDynamicTheme`

### Ongoing

- [ ] knip/madge unused-code pass
- [ ] Logger coverage ≥ hot modules (notifications, push, registration, PDF)
- [ ] Slow-query sampling via Supabase + optional Nest timing interceptor on `/api/v1/**`

---

## Phase boundary

| Phase | Status |
|-------|--------|
| Phase 1 — DB + Backend | Done — **62** |
| Phase 2 — Frontend + Multi-tenant | Done — **51** |
| **Phase 3 — Smells + Monitoring** | **This report — 44** |
| Overall rollup | [DEEP_SCAN_OVERALL_Report.md](DEEP_SCAN_OVERALL_Report.md) |

---

## Appendix — Score derivation

**Code smells 50:** − god services (−12); − god components (−6); − `any` volume (−8); − console in app paths (−7); − weak Logger adoption (−5); − magic privilege domains (−5); − Puppeteer/`select('*')` duplication families (−8); − residual TODO/validation gaps (−3); + global ValidationPipe + very few TODOs (+4).

**Monitoring 38:** − no APM (−15); − shallow health (−10); − no request ID / tenant tags (−12); − no SLOs (−5); − FE errors console-only (−5); − no slow-query / critical-path metrics (−8); + Nest exception `Logger` + portal error UI (+8); + compression present (ops hygiene, small) (+2). Floor not applied.

**Phase-3 overall:** `0.50 × 50 + 0.50 × 38 = 44`.
