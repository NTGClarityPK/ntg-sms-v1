# Performance Metrics & Audit Report v3

**Date:** February 2026  
**Scope:** Full-stack audit based on `performancefindings.md`, `performancereport.md`, `performancereportv2.md`, and current codebase.  
**User-reported issues:** Administrative reports take a long time to load; initial loading of pages is slow.

---

## Executive Summary

| Severity | Count | Focus |
|----------|--------|--------|
| **CRITICAL** | 3 | Administrative reports N+1, heavy report endpoint, (optional) select('*') in hot paths |
| **HIGH** | 8 | Duplicate fetches, select('*'), indexes, timeout, **compression**, **pooler**, **realtime cleanup**, **bundle/cache/RLS** |
| **MEDIUM** | 9 | Leave stats, virtualisation, debounce, **lazy load**, **Image**, **background jobs**, **parallel fetch audit** |
| **LOW** | 9 | Slim DTOs, setup wizard, monitoring, **preconnect**, **PWA tune**, **fonts**, **refetch** (done), **parameterized** |

**Root cause of “Administrative reports loads and loads”:** The backend runs **one request per class section** in a **sequential loop** for both the attendance summary and the low-attendance report. With 20–40 class sections, that is 20–40 sequential backend operations per report, so the page waits many seconds.

**Root cause of “Initial loading takes time”:** Auth and branch switcher are already optimised (parallel auth, targeted invalidation). Remaining cost is (1) first-time auth + dashboard/widgets/preferences in sequence, and (2) heavy pages (e.g. Reports) that trigger multiple slow endpoints at once.

---

## CRITICAL

### C1. Administrative reports – N+1 by class section (backend)

**Location:** `backend/src/modules/reports/reports.service.ts`  
**Methods:** `getAttendanceSummaryBranch` (lines ~1265–1351), `getLowAttendanceStudents` (lines ~1353–1427).

**What happens:**

- `getAttendanceSummaryBranch` gets a list of allowed class-section IDs, then loops:
  - `for (const csId of allowed) { const raw = await this.attendanceService.getAttendanceReportByClassSection(csId, ...); ... }`
- `getLowAttendanceStudents` does the same loop, and inside the loop also fetches students and profiles **per class section**.

So for **N** class sections:

- Summary: **N sequential** calls to `getAttendanceReportByClassSection` (each does 4 DB queries in parallel internally, but the N calls are one-after-another).
- Low attendance: **N sequential** calls to `getAttendanceReportByClassSection` plus **N** student fetches and **N** profile fetches (can be batched per call but still N rounds).

**Impact:** With 30 class sections, the summary alone is ~30 sequential backend operations. At ~50–150 ms per operation, total is **~1.5–4.5 s** for one summary request. Low-attendance is similar or worse. The Administrative tab triggers both (summary + low attendance) in parallel, so the user waits for the slower of the two; combined with list loading (class sections, subjects), the page “just loads and loads”.

**Fix (pattern):**

- **Summary:** Fetch all class-section reports in **one parallel batch**, then aggregate in memory.
  - `const raws = await Promise.all(allowed.map(csId => this.attendanceService.getAttendanceReportByClassSection(csId, branchId, yearId, startDate, endDate)));`
  - Then loop over `raws` to build `byClass`, `totalPresent`, etc. (no `await` inside loop).
- **Low attendance:** Same: `Promise.all(allowed.map(...))` for all class-section reports. Then collect all `studentId`s and all `user_id`s, and do **two batched lookups** (students by ids, profiles by user ids) once, then map names in memory.

**Effort:** Medium (1–2 hours). No change to API contract or business logic.

---

### C2. Attendance “full report” endpoint – 10,000 rows and Node-side aggregation

**Location:** `backend/src/modules/attendance/attendance.service.ts` – `generateAttendanceReport` (and any caller that uses it with a high limit).

**What happens (from performancefindings.md / performancereport.md):**

- Calls `listAttendance` with `page: 1, limit: 10000`, pulling up to 10,000 fully hydrated rows.
- Then computes summary (present/absent/late/excused) and date range in Node with `.filter` / `.map`.

**Impact:** Very large payload, long response time, risk of client timeout (e.g. 10 s) and high memory/CPU on backend.

**Fix (pattern):**

- Prefer a **summary endpoint** that uses DB aggregation (e.g. `GROUP BY status`, `COUNT(*)`, min/max date) and returns a small payload.
- If a full record list is required, cap the limit (e.g. 2,000), paginate, or offer a separate “export” flow (streaming/async job).

**Effort:** Medium. Depends on who calls `generateAttendanceReport` (reports module vs attendance controller); align with C1 so admin reports don’t depend on this heavy path.

---

### C3. (Optional) select('*') in hot paths

**From performancereportv2:** Many services use `.select('*')`, increasing payload size and memory. **Critical** only where the table or result set is large or the endpoint is called very often (e.g. notifications list, profiles in auth). Else treat as HIGH.

**Recommendation:** Replace with explicit column lists in:

- Notifications list (and any unread-count related query).
- Profiles in any hot path (auth already uses explicit fields).
- Attendance list/report-related queries.

**Effort:** Low–medium (systematic pass).

---

## HIGH

### H1. Duplicate / redundant fetches on Reports page

**Location:** Reports page + `AdministrativeReportContent.tsx`.

**What happens:**

- Reports page uses `useClassSections({ limit: 100 })` for student/class report tabs.
- When the Administrative tab is active, `AdministrativeReportContent` uses `useClassSections({ limit: 200, minimal: true })` with a **different** query key, so React Query does **not** dedupe: two class-section requests (100 and 200) can run.
- Both summary and low-attendance run as soon as the Administrative tab is visible (Mantine Tabs keeps panels in DOM).

**Impact:** Extra class-section request and two heavy report calls at once; user waits for the slowest.

**Fix:**

- Prefer a single `useClassSections` at report page level (e.g. limit 200, minimal where needed) and pass data into `AdministrativeReportContent`, or use the same params so the same cache key is used.
- Consider **lazy** loading of administrative data: only run `useAttendanceSummary` and `useLowAttendance` when the administrative tab is **active** (e.g. conditional `enabled` based on `activeTab === 'administrative'`), so switching to Administrative doesn’t refetch if already loaded, and other tabs don’t pay the cost.

**Effort:** Low.

---

### H2. Remaining select('*') across services

**From performancereportv2:** 100+ instances. Not all are in hot paths, but they add unnecessary transfer and memory.

**Recommendation:** Replace with explicit selects in list/detail endpoints (attendance, staff, students, leave-requests, notifications, etc.). Use backend rules and performance-pattern skill.

**Effort:** Medium (batch over a few sessions).

---

### H3. Database indexes for reports and attendance

**From performancefindings.md (Batch 3):**

- Attendance: composite indexes for list/summary/report filters, e.g.  
  `(branch_id, academic_year_id, date, class_section_id)`,  
  `(student_id, branch_id, academic_year_id, date, status)`.
- Notifications: e.g. `(user_id, is_read, created_at)`.

**Impact:** Without these, large report and summary queries can do full scans and get slower as data grows.

**Effort:** Low (migrations). Verify in Supabase that these (or equivalent) exist; add if missing.

---

### H4. Timeout policy for heavy endpoints

**From performancefindings.md:** Global 10 s timeout; only bulk attendance overrides (e.g. 30 s). Heavy report/summary endpoints can succeed on the server after the client has timed out.

**Recommendation:**

- Keep 10 s for normal CRUD.
- Use a longer timeout (or async job) for: attendance full report, administrative summary/low-attendance if still slow after C1, and any export (PDF/Excel).
- Optionally show UX: “Report is taking longer than usual; you can wait or try narrowing the date range.”

**Effort:** Low.

---

### H5. Response compression disabled (NestJS)

**Location:** `backend/src/main.ts` – no compression middleware.

**Impact:** JSON payloads (reports, large lists) compress 70–90% with gzip. A 500 KB report becomes ~50–150 KB; faster transfer and lower bandwidth.

**Fix:**

```typescript
import * as compression from 'compression';
// ...
const app = await NestFactory.create(AppModule);
app.use(compression());
```

Install: `npm i compression` and add types if needed: `npm i -D @types/compression`.

**Effort:** ~5 minutes.

---

### H6. Next.js bundle size – no analysis

**Check:** Run bundle analyzer to find bloat. Frontend uses `recharts`, `pdfjs-dist`, `react-pdf` – ensure heavy libs are lazy-loaded where possible.

**Fix:**

- Install: `npm i -D @next/bundle-analyzer`
- In `next.config.js`: wrap config with `withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })`
- Run: `ANALYZE=true npm run build`

**Target:** Initial JS bundle &lt;200 KB where feasible; flag if &gt;300 KB. Prefer dynamic import for charts, PDF viewer, and export libs (see M6).

**Effort:** Low (one-time analysis); then address findings (M6).

---

### H7. API response cache – HTTP headers (and optional Redis)

**Problem:** Rarely-changing data (roles, academic years, system settings, class sections) is refetched on every request with no browser or server cache.

**Fix (low effort):**

- Add `Cache-Control` headers to stable GET endpoints, e.g.  
  `@Header('Cache-Control', 'public, max-age=300')` for academic years list, roles, or system settings.  
  Use shorter `max-age` (e.g. 60) for data that changes occasionally.

**Optional (medium effort):** Redis (or in-memory) cache for hot paths (e.g. settings by key, active academic year per branch) if profiling shows repeated identical queries.

**Effort:** Low for headers; medium for Redis.

---

### H8. Supabase connection pooler and RLS policy cost

**H8a – Connection pooler:** Backend `.env` uses direct Supabase URL. For server-side API calls, using the **pooler** URL (e.g. port **6543** in Supabase) avoids exhausting Postgres connection limits under concurrency. Direct connections are limited (~60); pooler supports far more. **Verification:** If `SUPABASE_URL` is the default project URL (no `:6543`), consider adding `SUPABASE_POOLER_URL` and using it for the NestJS Supabase client where appropriate (Supabase docs: use pooler for short-lived transactional queries; direct for long-running or migrations if needed).

**H8b – RLS policy complexity:** Policies that use heavy subqueries or JOINs in `USING`/`WITH CHECK` can cause sequential scans or high cost per row. Run `EXPLAIN ANALYZE` in Supabase SQL Editor on slow queries (e.g. admin reports, messages by conversation). Prefer simpler predicates (e.g. `column IN (SELECT ...)` with indexed columns) and ensure indexes align with RLS filters.

**Effort:** Low (verify pooler docs and RLS); medium if policy rewrites are needed.

---

### H9. Realtime subscription cleanup (Supabase channels)

**Status:** `useNotificationsRealtime` and messages page both clean up in `useEffect` return: `if (channel) supabase.removeChannel(channel)`. Messages page also removes a **test channel** in cleanup.

**Recommendation:** (1) Ensure any **new** `supabase.channel()` usage follows the same pattern: store channel reference and call `supabase.removeChannel(channel)` in the effect cleanup. (2) Remove or guard the messages-page **test channel** (e.g. `test-all-${Date.now()}`) so it does not run in production – it creates a new channel name every mount and is for debugging only.

**Verification:** Open Messages, navigate away, repeat several times; check Supabase Dashboard → Realtime. Connection count should not grow indefinitely.

**Effort:** Low (audit + remove test channel in prod).

---

## MEDIUM

### M1. Frontend – staleTime already applied on key hooks

**Status:** `useAuth`, `useTenantMe`, `useDashboard`, `useClassSections`, `useStudents`, `useStaff`, `useReports`, etc. already have sensible `staleTime`. No critical missing ones for initial load; optional pass to align with performance skill table (e.g. 5 min for lookups, 2 min for lists).

---

### M2. Leave stats – three requests for counts

**From performancereportv2:** `useStudentLeaveStats` (or equivalent) issues three API calls (pending/approved/rejected) to get counts.

**Recommendation:** Single backend endpoint, e.g. `GET /api/v1/leave-requests/stats/:studentId` returning `{ pending, approved, rejected }`, and one frontend call.

**Effort:** Low.

---

### M3. Large lists – virtualisation and pagination

**From performancefindings.md:** Very large lists (e.g. 500+ rows) without virtualisation can slow the UI. Ensure list endpoints and UI use pagination; add virtualisation (e.g. Mantine or react-window) where large tables are displayed.

**Effort:** Low–medium per page.

---

### M4. Search inputs – debounce

**From performance skill:** Search that triggers API on every keystroke should use a debounced value (e.g. 300 ms) and optional min length (e.g. 2 characters) before calling the API.

**Effort:** Low.

---

### M5. Dashboard and first paint

**Current:** Dashboard uses `useAuth` → then `useDashboardPreferencesQuery` and `useDashboardWidgets` with `enabled: !!branchId`, so there is a short waterfall: auth → dashboard data. Auth is already parallelised and cached (5 min).

**Optional:** If a “skeleton” or layout is shown immediately, perceived initial load is mostly dominated by the slowest data (dashboard payload or, on Reports, the administrative endpoints). Fixing C1 reduces the worst case when users open Reports → Administrative.

---

### M6. Code splitting – lazy load heavy libraries

**Check:** Frontend uses `recharts`, `pdfjs-dist`, `react-pdf`. These should be loaded only when the feature is used, not in the main bundle.

**Fix:** Use Next.js `dynamic()` for chart pages, PDF viewer, and any route that uses these libs:

```typescript
const LineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  { ssr: false, loading: () => <Skeleton height={300} /> }
);
```

**Candidates:** Recharts, PDF viewer components, Excel/PDF export UI (if any heavy client-side lib). Backend PDF/Excel generation is server-side; lazy load applies to frontend-only bundles.

**Effort:** Low per route/component.

---

### M7. Next.js Image component

**Check:** Use `<Image>` from `next/image` for images (logos, avatars, uploads) so Next.js can optimize (WebP/AVIF), size correctly, and lazy-load. Replace raw `<img>` where it makes sense.

**Effort:** Low (systematic replacement).

---

### M8. Background jobs for heavy exports

**Current:** PDF and Excel exports in `reports.service.ts` run **synchronously** (Puppeteer PDF, ExcelJS). Long-running exports can hit the client timeout even when the server eventually succeeds.

**Fix (medium effort):** Move export generation to a background job (e.g. BullMQ or similar). API returns a `jobId` and status; frontend polls `GET /reports/export/:jobId` or uses polling/SSE until the file is ready, then downloads. Alternatively, extend timeout only for export endpoints and show “Generating report…” with a longer wait.

**Effort:** Medium (queue + worker + poll endpoint). Short-term: longer timeout + UX message (see H4).

---

### M9. Parallel fetches audit (remaining pages)

**Check:** Any page that does multiple independent `useQuery` or backend `await` calls in sequence could be parallelised. Dashboard already depends on auth then branchId; Reports page fires summary + low-attendance in parallel (good). Audit other pages (e.g. settings, multi-tab views) for unnecessary `enabled: !!x` chains that create waterfalls.

**Effort:** Low (review + small hook/param changes).

---

## LOW

### L1. Slim DTOs for list vs detail

**From performancereportv2:** Attendance (and similar) DTOs could be split into list vs detail to reduce payload for tables.

**Effort:** Medium; do after H2.

---

### L2. useSetupWizard – invalidateQueries() with no key

**Location:** `frontend/src/hooks/useSetupWizard.ts` – `queryClient.invalidateQueries()` with no arguments.

**Impact:** After setup, all queries are invalidated; next navigation refetches everything. Only runs once per user lifecycle.

**Fix:** Invalidate only the keys that depend on “setup completed” (e.g. tenant, auth, dashboard).

**Effort:** Low.

---

### L3. Monitoring and observability

**Recommendation:** Log or metric for endpoints > 1 s; optional APM/tracing for slow queries; Supabase dashboard for slow queries. Alerts for regressions.

**Effort:** Low–medium (ops).

---

### L4. Students / Staff – listUsers

**From performancereportv2:** Students and Staff services previously used `supabase.auth.admin.listUsers()` and filtered in memory. If any code path still does that, replace with batched `getUserById` or store email in profiles. Current `users.service.ts` already uses `getUserById` for the list page; confirm students and staff do not call `listUsers`.

**Effort:** Low (verification + fix if any remain).

---


### L5. Preconnect / DNS-prefetch hints

Add in layout or `_document` for API and Supabase: preconnect and dns-prefetch links. Saves ~100-300 ms. **Effort:** Low.

### L6. Service worker / PWA

**Status:** Already using next-pwa. Optional: tune cache. **Effort:** Low.

### L7. Font loading strategy

Use `next/font` with display swap. **Effort:** Low.

### L8. Critical CSS extraction

**Effort:** Medium.

### L9. React Query refetchOnWindowFocus

**Status:** Already false in query-client. **Effort:** N/A.

### L10. Parameterized queries (Supabase)

Verify raw SQL/RPC use params. **Effort:** Low.

---
## What’s already in good shape

- **Auth:** `getCurrentUser` uses two-wave `Promise.all`; no sequential 6 calls.
- **useAuth / useTenantMe:** `staleTime: 5 * 60 * 1000` (and gcTime) set; no refetch on every nav.
- **Branch switcher:** Targeted invalidation (students, staff, attendance, class-sections, etc.); no global `invalidateQueries()`.
- **Attendance per-student / per-class summary:** Uses DB-level count (`count: 'exact', head: true`) and parallel status counts; no “fetch all rows and count in Node”.
- **Bulk attendance save:** Single upsert, non-blocking notifications, extended timeout, good UX.
- **Unread count:** Dedicated endpoint; no “two list calls and subtract”.
- **Dashboard hooks:** Have `staleTime`; widgets/preferences load after branch is known.
- **Realtime channels:** Notifications and messages both clean up in `useEffect` return (`removeChannel`). Query client has `refetchOnWindowFocus: false` globally.
- **PWA:** next-pwa already configured (runtimeCaching: [] so API is not cached).

---

## Priority matrix (what to do first)

| Priority | Item | Severity | Impact | Effort |
|----------|------|----------|--------|--------|
| **P0** | C1 – Batch administrative report class-section calls | CRITICAL | Removes “loads and loads” on Administrative tab | Medium |
| **P0** | C2 – Replace 10k report with aggregation / cap | CRITICAL | Prevents timeouts and heavy load | Medium |
| **P1** | H1 – Single class-sections fetch + lazy admin data | HIGH | Fewer requests, faster Reports page | Low |
| **P1** | H3 – Indexes for attendance/notifications | HIGH | Faster queries as data grows | Low |
| **P1** | H4 – Timeout policy for reports/exports | HIGH | Fewer “timed out but saved” confusions | Low |
| **P2** | H2 – Explicit select() in hot paths | HIGH | Lower payload and memory | Medium |
| **P2** | M2 – Leave stats single endpoint | MEDIUM | Fewer round-trips | Low |
| **P2** | M3 / M4 – Virtualisation, debounce | MEDIUM | Smoother UX on large lists/search | Low |
| **P1** | H5 – Response compression (NestJS) | HIGH | 70–90% smaller JSON payloads | ~5 min |
| **P1** | H6 – Bundle analyzer + M6 lazy load | HIGH / MEDIUM | Smaller initial bundle | Low |
| **P2** | H7 – Cache-Control headers; H8 – Pooler/RLS | HIGH | Fewer DB hits; scale under load | Low–medium |
| **P2** | H9 – Realtime cleanup (remove test channel in prod) | HIGH | No channel leak | Low |
| **P2** | M8 – Background jobs for exports (or longer timeout) | MEDIUM | No export timeouts | Medium |
| **P3** | C3 / L1–L4, L5–L10 | LOW–MEDIUM | Clean-up, preconnect, fonts, etc. | As needed |

---

## Summary: Critical vs not

**Critical (must fix for “Administrative reports loads and loads” and “initial/slow pages”):**

1. **C1** – Administrative reports: replace the **sequential loop** over class sections with **parallel** `Promise.all(getAttendanceReportByClassSection(...))` and batched student/profile lookups in low-attendance. This is the main cause of the long load on the Administrative tab.
2. **C2** – Avoid pulling 10,000 attendance rows for a single report; use DB aggregation and/or pagination/export flow.

**High (should fix soon):**

- H1: One class-sections source for Reports; lazy-load administrative tab data.
- H2: Replace `select('*')` in hot paths.
- H3: Indexes for attendance and notifications.
- H4: Timeout policy for heavy/export endpoints.

**Not critical for your two symptoms (but still valuable):**

- M2–M5, M6–M9, L1–L4, L5–L10: Leave stats, virtualisation, debounce, lazy load, Image, background jobs, slim DTOs, setup invalidation, monitoring, listUsers, preconnect, PWA, fonts, refetch (done), parameterized. Do these after P0/P1.

**Extended audit (infrastructure & stack):** This v3 report incorporates 15 additional items from a follow-up review: response compression (H5), bundle analysis (H6), cache headers/pooler/RLS (H7–H8), realtime cleanup (H9), lazy load/Image/background jobs (M6–M8), parallel fetch audit (M9), and preconnect/PWA/fonts/refetch/parameterized (L5–L10). **Quick wins:** H5 (compression, ~5 min), H6 (bundle analyzer), H8 (verify pooler URL), H9 (remove messages test channel in prod). refetchOnWindowFocus is already false (L9).

Implementing **C1** and **C2** will directly address the administrative report slowness. **C1** gives the largest immediate gain for “it just loads and loads” on Administrative reports. Initial page load is already helped by auth and branch-switcher optimisations; the remaining noticeable delay on “first load” is largely from heavy pages (e.g. Reports) and will improve once C1 and H1 are in place.

---

*References: performancefindings.md, performancereport.md, performancereportv2.md, .cursor/skills/performance-pattern/SKILL.md. Extended audit (H5–H9, M6–M9, L5–L10) merged from follow-up review: compression, pooler, realtime cleanup, bundle/cache/RLS, lazy load, Image, background jobs, preconnect, PWA, fonts, refetch, parameterized.*
