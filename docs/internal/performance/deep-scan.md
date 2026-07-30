ask: Deep Performance & Code Quality Audit of Alma SMS

Objective: Perform a comprehensive audit of the Alma codebase (Next.js 14 App Router frontend + NestJS backend + Supabase/PostgreSQL) to identify performance bottlenecks, code smells, duplication, unnecessary API calls, and multi-tenant scaling risks. Produce a detailed report with numerical scores per category and prioritized fixes.

Context: Alma is a school management SaaS with many tenants (schools) sharing infrastructure. We recently optimized compute usage. Now preparing for wider go-live where noisy-neighbor issues, unindexed queries, and inefficient rendering will hit hard. Do not break existing business logic. Assume production traffic patterns: bursty during school hours, quiet at night, high concurrency during exam/result publication.

Deliverable: A markdown report file at docs/audits/performance-audit-YYYY-MM-DD.md with scores, findings, and proposed fixes.

Scoring Rubric (Apply Per Category)

Score each category from 0-100:

90–100 — Production-ready at scale, no critical issues
75–89 — Good, minor improvements available
60–74 — Fair, moderate refactoring needed before scaling
40–59 — Poor, significant issues that will bite at 50+ tenants
0–39 — Critical, must fix before go-live

Also assign an Overall Score (weighted average, with critical categories weighted higher).

Categories to Audit
1. Database & Supabase Layer (Weight: 25%)

Scan for:

Missing indexes on: branch_id, tenant_id, foreign keys, columns used in WHERE/ORDER BY/JOIN
Composite indexes missing for common query patterns (e.g., (branch_id, created_at DESC), (branch_id, status))
Partial indexes opportunities for hot predicates (e.g., WHERE is_active = true)
N+1 query patterns: loops with .from().select(), nested selects without proper joins, .forEach with awaits
RLS policy performance: policies with subqueries, missing indexes on policy columns, overly complex USING clauses
SELECT * usage where specific columns would suffice
Missing pagination on list endpoints (any .select() without .range() or .limit())
Sequential scans on large tables (check EXPLAIN plans if migrations touch big tables)
Realtime subscription overhead: unbounded subscriptions, missing filters
Storage bucket access patterns: unnecessary re-uploads, missing signed URL caching
PostgreSQL functions: any function marked VOLATILE that could be STABLE/IMMUTABLE
Missing NOT NULL constraints that PostgreSQL could use for optimization
Unused indexes (indexes that exist but are never used based on query patterns in code)
Data types: TEXT where VARCHAR(n) or enums would be better, TIMESTAMP vs TIMESTAMPTZ inconsistency
Missing ON DELETE CASCADE where it would prevent orphan cleanup jobs

For each finding: quote the file path, line number, current code, and proposed fix with expected impact.

2. Backend / NestJS (Weight: 20%)

Scan for:

Guard/interceptor overhead: guards doing DB calls on every request, interceptors with N+1 patterns
Missing caching layer: repeat DB calls for the same data within a request or across requests (branch settings, user roles, permissions matrix)
Missing pagination on any list controller
Unbatched DB operations: loops calling .insert() one-by-one instead of .insert([...])
Missing Promise.all where sequential awaits could parallelize
Blocking synchronous operations (heavy CPU work not offloaded)
Memory leaks: subscribers/listeners not cleaned up, growing in-memory caches without TTL
Missing per-tenant rate limiting (critical for multi-tenant)
Circular dependencies between modules
Dead endpoints (routes not referenced by frontend)
Overly broad DTOs: returning fields that clients don't need
Missing async job queues for: PDF generation, bulk imports, email sends, report generation, Puppeteer operations
Puppeteer instances not pooled or reused
Missing request-scoped context for tenant isolation
Guards executing multiple DB queries where one would suffice
Missing @Cacheable or equivalent on hot read paths
Duplicate service methods across modules doing the same thing
3. Frontend / Next.js 14 App Router (Weight: 20%)

Scan for:

Excessive 'use client' directives at root of components that could be server components
'use client' on entire pages when only a small interactive part needs it (should push down)
Server component vs client component ratio — flag pages that are 90%+ client
Bundle size: run next build output analysis, flag routes > 300KB First Load JS
Duplicate dependencies in package.json (multiple date libs, multiple HTTP clients, etc.)
Missing dynamic imports for heavy components (charts, PDF viewers, editors)
Waterfall API calls: useEffect chains, sequential fetch where Promise.all would work
Missing Suspense boundaries around async server components
Excessive re-renders: components that re-render on unrelated state changes
Missing memoization: expensive computations without useMemo, callbacks without useCallback, large components without React.memo
Large components (>300 lines) that should be split
Missing skeleton/loading states causing layout shift
Unoptimized images: <img> tags instead of next/image, missing priority on LCP images
Custom fonts not using next/font (causes FOUT/CLS)
Missing route prefetching on navigation-heavy pages
Polling instead of subscriptions/webhooks where possible
Missing debouncing on search inputs (should be 300-500ms)
Zustand/context store bloat: entire app state in one store
Client-side data fetching for data that could be server-rendered
Missing revalidate on ISR pages
Mantine UI: check for unused imports (Mantine has good tree-shaking but only when imported correctly)
4. Multi-Tenant Isolation & Scaling (Weight: 15%)

CRITICAL — score this harshly.

Scan for:

Missing branch_id in queries (any .from('table').select() without .eq('branch_id', ...) where the table has branch_id) — potential data leak
Global in-memory caches without tenant key (e.g., Map<id, data> without tenant scoping)
Cross-tenant data leaks in service methods (parameters not validated against current tenant)
Missing per-tenant rate limits at API gateway or middleware
Noisy neighbor risks: unbounded operations one tenant can trigger (bulk exports, large PDF generation, unbounded queries)
Background jobs missing tenant context — cron jobs that iterate all tenants without isolation
Shared resources without isolation: shared Puppeteer instances, shared queues
Missing partition strategy for large tables (student_grades, attendance, audit_logs) — flag tables that will exceed 10M rows
BranchGuard bypasses: any endpoint missing the guard
Client-side tenant switching: localStorage.currentBranchId mutations that could be exploited
Missing tenant validation in edge functions / Supabase functions
Aggregations across tenants without explicit admin scope (data leak risk)
5. API Performance & Network (Weight: 10%)

Scan for:

Oversized response payloads (>100KB for list endpoints)
Unnecessary fields in responses (returning entire objects when only 3 fields used)
Missing HTTP caching headers (Cache-Control, ETag) on static-ish endpoints
Duplicate API calls from same page mount (multiple components fetching the same data)
Missing request deduplication in TanStack Query / SWR configs
Missing batch endpoints for bulk operations (e.g., marking attendance for a whole class = 30 API calls)
Missing pagination on list endpoints
Over-fetching: components requesting full objects when they display 2 fields
Under-fetching: components making 5 sequential calls that could be one endpoint
Missing compression (gzip/brotli) on API responses
Long-polling instead of WebSockets where realtime matters
API calls in tight loops on the frontend
6. Code Smells & Duplication (Weight: 5%)

Scan for:

Duplicated code blocks (>5 lines repeated in 3+ places) — use structural similarity, not just text match
Long functions (>50 lines of logic)
Deep nesting (>4 levels of if/for/try)
any type usage in TypeScript (count instances)
Unused imports and variables
console.log / console.error left in code (should use logger)
TODO / FIXME / HACK comments (list all with file:line)
Dead code: exported functions never imported, files never referenced
Circular dependencies between files/modules
Inconsistent error handling (some places try/catch, others .catch(), others nothing)
Missing input validation at controller layer (class-validator DTOs incomplete)
Hardcoded values that should be env vars or config (URLs, timeouts, magic numbers)
Magic strings for status/enum values instead of constants
God services: NestJS services with >20 methods or >800 lines
God components: React components with >500 lines
7. Monitoring & Observability (Weight: 5%)

Scan for:

Missing performance monitoring (any Sentry, Datadog, New Relic hooks?)
Missing error tracking on critical paths (auth, payments, exports)
Missing structured logging (using console.log instead of a logger with metadata)
Missing request tracing (no request IDs propagated across services)
Missing tenant tags on logs (can't filter logs by tenant during incidents)
Missing SLO definitions (no p95/p99 latency targets)
Missing health check endpoints or overly simple health checks
Missing DB query performance logs
Output Report Structure

Create the audit report as:

markdown
# Alma Performance Audit — [Date]

## Executive Summary
- **Overall Score: XX/100**
- **Recommendation:** [Safe to scale / Fix critical issues first / Major refactor needed]
- **Top 3 Risks Before Go-Live:** [list]
- **Estimated Effort to Reach 85+ Score:** [X person-weeks]

## Category Scores
| Category | Score | Status |
|----------|-------|--------|
| Database & Supabase | XX/100 | 🟢/🟡/🔴 |
| Backend / NestJS | XX/100 | 🟢/🟡/🔴 |
| Frontend / Next.js | XX/100 | 🟢/🟡/🔴 |
| Multi-Tenant Isolation | XX/100 | 🟢/🟡/🔴 |
| API Performance | XX/100 | 🟢/🟡/🔴 |
| Code Smells | XX/100 | 🟢/🟡/🔴 |
| Monitoring | XX/100 | 🟢/🟡/🔴 |

## Critical Issues (Must Fix Before Go-Live)
For each:
### C1: [Issue title]
- **Category:** [category]
- **Severity:** Critical
- **File:** `path/to/file.ts:line`
- **Current Code:**
```typescript
  // problematic code
```
- **Problem:** [explanation]
- **Impact at Scale:** [what happens at 50+ tenants]
- **Proposed Fix:**
```typescript
  // fixed code
```
- **Estimated Effort:** [X hours]
- **Expected Impact:** [e.g., "Reduces DB load 40% on assessment listing"]

## Major Issues (Fix Within 30 Days)
[Same format]

## Minor Issues (Nice to Fix)
[Bulleted list, less detail]

## Duplication Report
- **Total duplicated blocks found:** N
- **Top 10 duplication hotspots:**
  1. `[snippet]` — appears in [files]
  2. ...

## Unused Code Report
- **Unused exports:** N
- **Unused files:** N
- **Files list:** [...]

## Bundle Analysis (Frontend)
- **Largest routes by First Load JS:**
  | Route | Size | Recommendation |
  | ... | ... | ... |
- **Heaviest dependencies:**
  | Package | Size | Used In | Alternative |
  | ... | ... | ... | ... |

## Multi-Tenant Risk Register
List of specific noisy-neighbor or isolation risks that could impact other tenants.

## Recommended Roadmap
### Week 1 (Critical fixes)
- [ ] Fix #1: ...
- [ ] Fix #2: ...

### Week 2-4 (Major fixes)
- [ ] ...

### Ongoing improvements
- [ ] ...

## Tools & Scripts to Add
Suggestions for CI checks, linters, or monitoring to prevent regression.

## Metrics Baseline
Snapshot of current metrics so we can measure improvement:
- DB query count per typical page load
- Avg API response time by endpoint (from logs if available)
- Bundle sizes
- TypeScript `any` count
- Test coverage
How to Scan Efficiently
Start with structural analysis:
Read package.json (both frontend and backend) — flag heavy deps
Read tsconfig files — check strict mode settings
Run next build if possible and capture bundle sizes
List all files in backend/src/modules and frontend/src/app
Then do pattern searches:
grep-style search for anti-patterns (I've listed specific ones above)
Check every .from('table') for .eq('branch_id', ...)
Check every controller method for auth guards
Check every list endpoint for pagination
Then read representative files deeply:
Pick 5 heaviest backend modules — read fully
Pick 5 most complex frontend pages — read fully
Read all migration files for schema issues
Read auth guards and interceptors
Cross-reference findings:
If a pattern is bad in one place, search for it everywhere
Group findings by root cause when possible
Rules & Constraints
Do NOT modify any code. This is a read-only audit. Only create the report file.
Cite specific file paths and line numbers for every finding.
Quote the actual problematic code (short snippets, not entire files).
Prioritize ruthlessly — 200 minor issues is less useful than 20 critical ones properly explained.
Explain the "at scale" impact for each critical/major issue.
Don't include theoretical issues if you can't find them in the code — this is a real audit, not a checklist parroting.
Estimate effort in hours/days for each fix based on complexity.
Group related findings — if 15 endpoints all miss pagination, that's one finding with 15 examples, not 15 findings.
Verify multi-tenant claims — before flagging a query as missing branch_id, check if it's inside a service that already scopes by tenant upstream.
Success Criteria

The report is successful if:

A developer reading it can start fixing issues immediately without further investigation.
Each finding has: location, current state, proposed fix, expected impact.
Scores are defensible — not arbitrary, backed by count of issues and severity.
Top 5 fixes would demonstrably improve production performance.
Nothing in the report is speculative or generic advice — everything ties to actual code in Alma.

Begin the audit now. Take your time. Read broadly before scoring. The report is more valuable than speed.