# Alma Post-Scan Fix Plan

**Created:** 24 Jul 2026
**Scope:** All fixes from three deep scan reports (Phase 1 DB/Backend, Phase 2 Frontend/Multi-tenant, Phase 3 Smells/Monitoring)
**Executor:** Cursor (solo dev workflow)
**Suggested location in repo:** `docs/audits/scan_fix.md`

---

## How to Use This File

1. Pick the next unchecked section (start from Section 1, top down).
2. Copy the entire Cursor prompt inside its triple-backtick block.
3. Paste into a fresh Cursor chat. Use **Plan Mode** if available so you can review the plan before it executes.
4. Let Cursor plan → review the plan → approve → let it execute.
5. Follow the **Manual Verification** checklist. Cursor's tests can pass while the fix is still broken. Verify yourself.
6. Check the boxes under **Success Criteria**.
7. Commit with format: `fix(scan-section-N): <short description>`.
8. Update the referenced audit report file marking the item as "Fixed".
9. Move to the next section.

---

## Priority Order (Work Top to Bottom)

- **Part A — Security (5 sections):** Real vulnerabilities. Do first. Non-negotiable.
- **Part B — Platform Safety (4 sections):** Protects everything else while you fix it.
- **Part C — Monitoring (2 sections):** You're blind without this. Custom, no external tools.
- **Part D — Noisy Neighbor Fixes (4 sections):** Biggest performance wins.
- **Part E — Frontend Polish (4 sections):** User-visible improvements.
- **Part F — Data Layer Hygiene (3 sections):** Query performance and index cleanup.
- **Part G — Prevention Layer (2 sections):** Stop new debt. Do once, benefit forever.
- **Part H — Ongoing (1 section):** Opportunistic. No deadline.

**Do not skip ahead.** A later section may depend on infrastructure a previous one adds.

---

## Rules That Apply To Every Section

Read once. Applies to every Cursor prompt below.

1. **ONE fix per commit.** Do not bundle unrelated changes.
2. **Do NOT touch business logic.** Only fix what the section describes.
3. **Preserve existing patterns.** Match codebase style. Reuse existing utilities (e.g. `mapWithConcurrency`, existing service-role Supabase client).
4. **Preserve existing Fixes 1–8.** They were done carefully. Do not undo them.
5. **Test what you changed.** Don't rewrite unrelated tests.
6. **If a fix requires changing an API response shape, STOP and flag it.** Requires frontend coordination.
7. **Update audit reports** in `docs/audits/` marking items as "Fixed" after each section.
8. **New migrations only.** Do not modify migrations that ran in production.
9. **Preserve `super_admin` role behavior** throughout.
10. **Do not add external services** without checking with the maintainer first.

---

# PART A — SECURITY (Do First)

These are real vulnerabilities. Every day they exist is exposure. Do this part before anything else.

---

## Section 1: Scope the `branches` Controller (Phase 2 C1, C2, C3)

- [x] Complete
- **Fixes:** Phase 2 C1 (unscoped list), C2 (unscoped get/update), C3 (updatePublicStats no membership)
- **Estimated:** 4–6 hours
- **Depends on:** none

### Context
Any logged-in user can currently list, read, and mutate branches across every tenant on the platform. This is a data leak plus a cross-tenant mutation vector.

### Cursor Prompt

```
Task: Fix cross-tenant data leak in the branches controller.

References:
- docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md — C1, C2, C3
- backend/src/modules/branches/branches.controller.ts
- backend/src/modules/branches/branches.service.ts

Current problem:
- @Get() returns all branches on the platform to any authenticated JWT holder
- @Get(':id') and @Put(':id') do not verify caller's membership
- @Post(':id/public-stats') checks role name but not branch membership

Required behavior:
1. List endpoint (@Get()):
   - super_admin: return all branches (or all for their tenant if tenant_owner)
   - all other roles: return only branches the caller is a member of via user_branches
   - filter at the DB level, not in JS
2. Get by ID (@Get(':id')):
   - Verify caller is a member of user_branches for that branch id, OR has super_admin
   - Return 403 on mismatch (not 404 — we tell them access denied, not that resource does not exist)
3. Update by ID (@Put(':id')):
   - Same membership check as get
   - Return 403 on mismatch, no mutation
4. Update public stats (@Post(':id/public-stats')):
   - Keep existing role check
   - ADD membership check — school_admin of Branch A cannot update Branch B stats

Implementation notes:
- Look at how other modules resolve user_branches membership — reuse the pattern
- Do NOT add BranchGuard if the controller does not use branch context from headers; instead do explicit membership check in service or a dedicated guard
- Log denied attempts to audit_logs so we can spot probing later

Tests:
- Add integration test: user with membership only in Branch A calls list → response contains Branch A only
- Add integration test: user tries GET /branches/{otherTenantBranchId} → 403
- Add integration test: user tries PUT /branches/{otherTenantBranchId} with body → 403 AND no DB mutation
- Add integration test: user tries POST /branches/{otherBranchId}/public-stats → 403
- Add integration test: super_admin sees all branches on list

Do NOT:
- Add new environment flags
- Change response shape for legitimate callers (frontend depends on the current shape for their own branches)
- Modify anything outside the branches module

After done:
- Update docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md marking C1, C2, C3 as Fixed
- Commit as: fix(scan-section-1): scope branches controller to member/super_admin only
```

### Success Criteria
- [x] List endpoint filters by user_branches for non-privileged roles
- [x] Get/Put by ID return 403 for non-members
- [x] updatePublicStats requires membership + role
- [x] Integration tests exist and pass for all 4 cross-tenant scenarios
- [x] super_admin behavior preserved

### Manual Verification
Create two test users, `admin_a@test.com` in Branch A and `admin_b@test.com` in Branch B. Log in as A, hit `GET /api/v1/branches` — you should see only Branch A. Hit `GET /api/v1/branches/{branch_b_id}` — should be 403. Repeat for PUT and public-stats. **Actually do this, don't skip.**

---

## Section 2: Fix Guardians-by-Student IDOR (Phase 2 C4)

- [x] Complete
- **Fixes:** Phase 2 C4
- **Estimated:** 2–4 hours
- **Depends on:** Section 1 (unrelated code, but do security together)

### Context
Anyone with a valid session can currently fetch guardian PII by guessing a student UUID from another branch. Student UUIDs leak in URLs, exports, and logs — this is a matter of when, not if.

### Cursor Prompt

```
Task: Fix IDOR in guardians-by-student endpoint.

References:
- docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md — C4
- backend/src/modules/parents/parents.controller.ts:175-182
- backend/src/modules/parents/parents.service.ts:366-373

Current problem:
- BranchGuard confirms caller has SOME branch, but studentId may belong to a different branch
- Service does .from('parent_students').select('*').eq('student_id', studentId) without cross-checking student branch

Required behavior:
- In getGuardiansForStudent (both controller and service):
  - Fetch the student's branch_id first
  - Assert student.branch_id === CurrentBranch.branchId
  - If mismatch: return 403 AND log to audit_logs with caller user_id, requested student_id, caller branch_id, student branch_id
  - Only then hydrate guardians

Tests:
- Integration test: user in Branch A requests guardians for student in Branch B → 403
- Integration test: user in Branch A requests guardians for student in Branch A → 200 with data
- Integration test: super_admin can access any student (preserve this)

Do NOT:
- Change the endpoint URL or response shape
- Modify guardian fetch logic beyond adding the branch assertion
- Touch anything outside parents module

After done:
- Update docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md marking C4 as Fixed
- Commit as: fix(scan-section-2): assert student-in-branch for guardians endpoint
```

### Success Criteria
- [x] Endpoint asserts student.branch_id matches CurrentBranch
- [x] 403 returned on mismatch with audit log entry
- [x] Integration tests exist and pass
- [x] super_admin bypass preserved

### Manual Verification
Same two test users from Section 1. Log in as user A, note a student ID from Branch B, hit `GET /api/v1/parents/students/{studentBId}/guardians` — should return 403. Check audit_logs table for a corresponding entry.

---

## Section 3: Remove Email Domain Privilege Bypass (Phase 2 C5)

- [x] Complete
- **Fixes:** Phase 2 C5, Phase 3 M7 (magic strings)
- **Estimated:** 2–4 hours + QA
- **Depends on:** none

### Context
Hardcoded email suffixes `@ntg.com`, `@ntgclarity.com`, `@example.com` currently grant elevated privileges and skip inactive tenant/branch checks. This is the kind of shortcut that becomes an incident later.

### Cursor Prompt

```
Task: Remove hardcoded email-domain privilege bypass from BranchGuard.

References:
- docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md — C5
- docs/audits/DEEP_SCAN_3(SMELLS-MONITORING)_Report.md — M7
- backend/src/common/guards/branch.guard.ts:36-40, 197-202
- Also grep for these domain strings across: branches.controller.ts, academic-years.controller.ts, tenants.controller.ts, auth.service.ts

Current problem:
- Guard grants elevated behavior to emails ending in @ntg.com / @ntgclarity.com / @example.com
- Privileged path also SKIPS inactive tenant/branch checks
- Same pattern duplicated across multiple controllers

Required behavior:
1. Remove all email-domain checks from privilege logic
2. Privileged access ONLY via database role 'super_admin'
3. Add optional env flag ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION (default: false) for backwards-compat migration
   - When enabled, log a WARN on every use with the offending email
   - This lets you migrate accounts to proper super_admin roles without breaking anything today
4. Update every file that has this pattern: BranchGuard, branches controller, academic-years controller, tenants controller, auth service
5. Inactive tenant/branch checks must NOT be skipped for super_admin either — they should apply universally (an inactive tenant is inactive for everyone)

Migration path (document in a comment):
- Step A (this PR): env flag defaults false, add super_admin role via DB migration to real ops accounts
- Step B (future PR): remove env flag entirely once no accounts rely on it

Tests:
- Integration test: user with @ntg.com email but no super_admin role → normal permissions only, no bypass
- Integration test: user with super_admin role and any email → privileged behavior
- Integration test: super_admin against inactive tenant → still denied (inactive means inactive)
- Integration test: env flag ON + @ntg.com email → warns in log, still grants (temporary compat)

Do NOT:
- Break super_admin path
- Change any response shapes
- Touch the JwtAuthGuard Fix 8 caching logic

After done:
- Update both audit reports marking C5 (Phase 2) and M7 (Phase 3) as Fixed
- Add a note to docs/security/ or similar about the migration
- Commit as: fix(scan-section-3): remove email-domain privilege bypass, require super_admin role
```

### Success Criteria
- [x] Email domain checks removed from all controllers and guards
- [x] super_admin role required for privileged behavior
- [x] Inactive checks apply to super_admin too
- [x] Env flag exists for temporary backwards compatibility
- [x] Migration plan documented in code comment
- [x] Tests cover the removal and the flag

### Manual Verification
Confirm real ops accounts have `super_admin` role in `user_roles` BEFORE deploying this. Otherwise you lock yourself out. Test with a real `@ntg.com` account that has NO `super_admin` — it should behave like a normal user.

---

## Section 4: BranchGuard Inactive Fallback Consistency + Import Token Rebinding (Phase 2 M11, M8)

- [ ] Complete
- **Fixes:** Phase 2 M11 (stale branch context), M8 (import token trust)
- **Estimated:** 6–8 hours
- **Depends on:** Section 3 (email domain removal in same guard)

### Context
Two related isolation cleanups in one session. Both are in-memory trust issues where the app trusts a value from an earlier step without re-validation.

### Cursor Prompt

```
Task: Fix two multi-tenant trust issues (guard fallback + import token).

References:
- docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md — M8, M11

Fix A — BranchGuard inactive fallback (M11):
File: backend/src/common/guards/branch.guard.ts:205-249

Problem:
- When active branch is inactive, guard falls back to another user_branches entry
- After fallback updates branchId, request['branch'] may still reference the ORIGINAL (inactive) branch row in some code paths
- Writes/reads could target the wrong branch

Required:
- After fallback resolves a new branchId, RE-FETCH the branch row and re-attach to request['branch']
- Ensure request['tenantId'] is also updated to match the fallback branch's tenant
- Add unit test: mock inactive active branch, verify request['branch'].id matches the fallback branch id (not original)

Fix B — Settings import token rebinding (M8):
Files: backend/src/modules/settings-import/settings-import.controller.ts
       backend/src/modules/settings-import/settings-import.service.ts
       (or wherever preparedImports Map lives)

Problem:
- Prepare step stores { validationToken, branchId } in a Map
- Apply step trusts token → uses prepared.branchId
- If token leaks (logs, XSS, shared machine), attacker can apply to a different branch than the caller's

Required:
- On apply, re-validate that prepared.branchId === CurrentBranch.branchId
- If mismatch: return 403, delete the token from the Map, log attempt
- Reduce token TTL to 15 minutes (or shorter)
- Make tokens single-use — delete on first apply attempt regardless of outcome

Tests for Fix B:
- Integration test: caller in Branch A prepares import, caller in Branch B tries apply with token → 403 and token deleted
- Integration test: legitimate flow (prepare + apply from same branch within TTL) → succeeds
- Integration test: expired token → 403 with clear error

Do NOT:
- Change apply response shape on success
- Store tokens in DB (in-memory Map is fine, just tighter)
- Touch other guards or middleware

After done:
- Update audit report marking M8 and M11 as Fixed
- Commit as: fix(scan-section-4): tighten BranchGuard fallback and import token rebinding
```

### Success Criteria
- [ ] BranchGuard re-fetches branch row after fallback
- [ ] Import token validates branch match on apply
- [ ] Tokens are single-use with short TTL
- [ ] Tests for both fixes pass

### Manual Verification
For Fix A: manually deactivate a branch a test user is in, log them in, hit any authenticated endpoint, check server logs to see which branch context was used — should be the fallback, not the inactive one.

---

## Section 5: Audit Remaining Non-BranchGuard Controllers (Phase 2 MT Risk Register)

- [ ] Complete
- **Fixes:** MT-10 in Phase 2 Risk Register
- **Estimated:** 2–4 hours (audit only, fixes tracked separately if found)
- **Depends on:** Sections 1–4 complete

### Context
~15 controllers currently do not use BranchGuard. Most are intentional (public endpoints, auth, webhooks, student-self). Some may not be. You need to know which.

### Cursor Prompt

```
Task: Audit all controllers that do NOT use BranchGuard and classify each.

References:
- docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md — MT-10, coverage note
- backend/src/modules/**/*.controller.ts

Method:
1. List every controller in backend/src/modules
2. For each, note whether it uses BranchGuard (either at class level or on individual methods)
3. For every controller/method NOT using BranchGuard, classify as one of:
   - PUBLIC — anonymous, no auth needed (list which)
   - AUTH-ONLY — needs auth but no tenant scoping needed (e.g. user profile self-endpoints)
   - SELF-SCOPED — data is scoped by user_id already, no branch needed (e.g. student viewing their own grades)
   - WEBHOOK — external caller, uses different auth (Stripe, etc.)
   - PLATFORM-ADMIN — super_admin only, no per-branch scoping
   - MISSING-BY-MISTAKE — should have BranchGuard, does not

Deliverable:
Create/update file: docs/audits/branch-guard-coverage.md

Format as a markdown table:
| Controller | Path | Guard | Classification | Notes |
|------------|------|-------|----------------|-------|
| BranchesController | /branches | Custom (post Section 1) | PLATFORM-ADMIN | Fixed in Section 1 |
| AuthController | /auth | JwtAuthGuard | AUTH-ONLY | Correct |
| ... | ... | ... | ... | ... |

For each MISSING-BY-MISTAKE finding, add an issue to the same file with:
- File path and method
- Why it should have BranchGuard
- Proposed fix

Do NOT:
- Fix any MISSING-BY-MISTAKE findings in this session — just document them
- Modify controllers
- Add BranchGuard anywhere without human review

After done:
- Report the count of each classification back
- If any MISSING-BY-MISTAKE found, create a new section (Section 5.1) in this scan_fix.md with prompts to fix them
- Commit as: docs(scan-section-5): audit BranchGuard coverage
```

### Success Criteria
- [ ] Coverage file exists with every controller classified
- [ ] Any missing-by-mistake findings documented for follow-up
- [ ] No controllers modified in this pass

### Manual Verification
Open the generated file, spot-check 5 controllers, confirm classifications match reality.

---

# PART B — PLATFORM SAFETY

These protect you while you fix everything else. Rate limiting prevents accidental self-DoS. BranchGuard cache eliminates the biggest per-request DB cost. Health and request IDs give you basic operational visibility.

---

## Section 6: NestJS Throttler with Per-Tenant Keys (Phase 1 M6)

- [ ] Complete
- **Fixes:** Phase 1 M6 (no global/per-tenant rate limiting)
- **Estimated:** 6–8 hours
- **Depends on:** Sections 1–4 (security first)

### Context
No rate limiting exists. One misbehaving script or accidental infinite loop can saturate DB/Auth for every tenant. This is the safety net that protects everything else.

### Cursor Prompt

```
Task: Add per-tenant + per-user rate limiting to the API.

References:
- docs/audits/DEEP_SCAN_1(DB-BACKEND)_Report.md — M6

Install:
- @nestjs/throttler

Implementation:
1. Configure ThrottlerModule at app level with three tiers as named throttlers:
   - 'light': 300 requests/minute — for reads like /auth/me, health, single-record fetches
   - 'normal': 60 requests/minute — DEFAULT for everything
   - 'heavy': 5 requests/minute — for expensive operations
2. Create custom TenantThrottlerGuard that extends ThrottlerGuard:
   - Key by branch_id + user_id when both available (both from request via BranchGuard/JwtAuthGuard context)
   - Fall back to user_id alone if no branch (e.g. auth endpoints)
   - Fall back to IP if unauthenticated
3. Apply as global guard
4. Apply @Throttle({ heavy: { limit: 5, ttl: 60000 } }) to these endpoints explicitly:
   - Data export (school-data-collector)
   - ID cards bulk generation
   - Fee challan generation (bulk / class-wide)
   - Results bulk zip
   - Any endpoint that calls puppeteer.launch (search backend for this)
   - Bulk import endpoints
5. Apply @Throttle({ light: { limit: 300, ttl: 60000 } }) to:
   - /auth/me
   - /health, /health/ready
   - /notifications/unread-count

On rate limit exceeded:
- Return 429 with body: { error: 'Too many requests', retryAfterSeconds: N }
- Add response header Retry-After
- Log the throttled request (userId, branchId, endpoint) so we can spot patterns

Config:
- Read limits from env vars with sensible defaults
- Env vars: THROTTLE_LIGHT_LIMIT, THROTTLE_NORMAL_LIMIT, THROTTLE_HEAVY_LIMIT (all per minute)

Tests:
- Unit test: guard keys by branch+user correctly
- Integration test: hit a 'normal' endpoint 61 times fast → 429 on the 61st
- Integration test: verify limits are per-branch (Branch A hitting limit does not affect Branch B users)

Do NOT:
- Add rate limiting inside guards that already do work (BranchGuard, JwtAuthGuard) — throttler comes first
- Bypass throttling for super_admin without explicit env flag
- Change any endpoint's normal response shape

After done:
- Update audit report marking M6 as Fixed
- Document the tiers and limits in docs/api/rate-limits.md
- Commit as: fix(scan-section-6): add per-tenant rate limiting via NestJS Throttler
```

### Success Criteria
- [ ] Throttler installed and configured
- [ ] Custom TenantThrottlerGuard implemented
- [ ] Three tiers applied to correct endpoints
- [ ] 429 responses include Retry-After
- [ ] Per-branch isolation verified in test

### Manual Verification
Log in as a test user, hit a heavy endpoint 6 times fast (e.g. the export endpoint). The 6th should 429. Log in as a different user in the same branch — should also be blocked (per-branch, not per-user). Log in as a user in a different branch — should still work.

---

## Section 7: BranchGuard Short-TTL Cache (Phase 1 M1)

- [ ] Complete
- **Fixes:** Phase 1 M1 (BranchGuard DB roundtrips on every request)
- **Estimated:** 4–6 hours
- **Depends on:** Section 6 (throttler in place first)

### Context
BranchGuard currently hits DB 2–4 times per authenticated request. Dashboard pages fire 5–10 API calls each, so one page load = 10–40 wasted DB round-trips. Mirror the Fix 8 pattern exactly.

### Cursor Prompt

```
Task: Add short-TTL cache to BranchGuard to eliminate per-request DB queries.

References:
- docs/audits/DEEP_SCAN_1(DB-BACKEND)_Report.md — M1
- Pattern to mirror: existing Fix 8 JwtAuthGuard cache in backend/src/common/guards/jwt-auth.guard.ts

Current problem:
- BranchGuard at backend/src/common/guards/branch.guard.ts:150-222 does 2-4 DB queries per authenticated request:
  - user_branches lookup
  - branches active check
  - tenants active check
- Fix 8 only cached JWT user/roles — BranchGuard still uncached
- Dashboard multi-API bursts pay this cost per API call

Required implementation:
- Mirror Fix 8's exact safety model:
  - Cache key: `branch:${userId}:${branchId}`
  - Cache value: { tenantId, isActive, tenantIsActive, resolvedAt }
  - TTL: 30 seconds (same as Fix 8)
  - NEVER cache failures/errors — only successful resolutions
  - In-memory Map with periodic sweep (same as Fix 8)
- Do NOT cache the fallback path (inactive branch → alternate) — always resolve fresh
- Do NOT cache super_admin bypass path
- Do NOT cache when Section 3's env flag is enabled (email domain compat)

Invalidation:
- Clear cache entry on:
  - Explicit branch switch (if there is a switch endpoint)
  - User role change (if there is such an endpoint)
- Otherwise let TTL handle it

Metrics:
- Add a counter that logs cache hit rate every 100 requests to Nest Logger
- Format: `[BranchGuard cache] hits=N misses=M ratio=X%`

Tests:
- Unit test: two consecutive requests within TTL make only 1 DB query
- Unit test: request after TTL expiry makes a new DB query
- Unit test: cache miss does not cache errors
- Unit test: super_admin bypass never touches cache

Do NOT:
- Cache anything about inactive branches
- Increase TTL above 30s
- Use a shared/distributed cache (in-memory is intentional for Fix 8 safety model)
- Change guard's public behavior — cache is transparent

After done:
- Update audit report marking M1 as Fixed
- Commit as: fix(scan-section-7): add short-TTL cache to BranchGuard mirroring Fix 8 pattern
```

### Success Criteria
- [ ] Cache class implemented with same safety model as Fix 8
- [ ] TTL is 30 seconds, in-memory only
- [ ] Errors never cached
- [ ] Fallback path never cached
- [ ] Metrics logged every 100 requests
- [ ] Tests verify cache behavior

### Manual Verification
Add a temporary `console.log` in the DB query methods. Log in, load the dashboard, count DB queries — should be far fewer than before. Remove the log after verification. Watch server logs for the cache hit ratio message — should climb toward 80%+ during dashboard use.

---

## Section 8: Health Check Split + Request IDs + CLS Context (Phase 3 C2, C3)

- [ ] Complete
- **Fixes:** Phase 3 C2 (shallow health), C3 (no request IDs)
- **Estimated:** 4–6 hours
- **Depends on:** Section 7

### Context
`/health` currently returns `{status: 'ok'}` without touching the DB, so load balancers can route to a dying instance. Also, logs have no way to correlate events for a single request or a single tenant.

### Cursor Prompt

```
Task: Add readiness health check and request-scoped context (request ID + tenant tags).

References:
- docs/audits/DEEP_SCAN_3(SMELLS-MONITORING)_Report.md — C2, C3

Install:
- nestjs-cls (for request-scoped context via AsyncLocalStorage)

Fix A — Health check split:
Files: backend/src/app.controller.ts, backend/src/app.service.ts

Required:
1. Keep GET /health as pure liveness — returns { status: 'ok', uptimeSeconds: N } immediately, no dependencies
2. Add GET /health/ready as readiness:
   - Ping Supabase: SELECT 1 with 2-second timeout
   - If DB unreachable OR timeout: return 503 { status: 'error', database: 'unreachable', checkedAt: iso }
   - If OK: return 200 { status: 'ok', database: 'reachable', checkedAt: iso }
3. Do NOT put readiness on hot path — DigitalOcean should probe /health for liveness and /health/ready separately
4. Add a comment in app.controller.ts telling ops which endpoint to configure in DO health probe: /health/ready

Fix B — Request IDs and CLS context:
Files: create new backend/src/common/middleware/request-context.middleware.ts
       update backend/src/common/filters/http-exception.filter.ts
       update backend/src/common/guards/branch.guard.ts (to populate CLS)
       update backend/src/common/guards/jwt-auth.guard.ts (to populate CLS)

Required:
1. Middleware reads x-request-id header, or generates a UUID if absent
2. Store in ClsService: requestId, userId (when JWT resolves), branchId, tenantId (when BranchGuard resolves)
3. Update HttpExceptionFilter to include all CLS fields in the logged error:
   {
     level: 'error',
     timestamp,
     requestId, userId, branchId, tenantId,
     method, url, statusCode, message, stack
   }
4. Update error response JSON to include requestId so users can quote it in support:
   { error: '...', message: '...', requestId: 'uuid-here' }
5. Middleware also sets response header x-request-id (echoes back)

Config:
- No new env vars needed
- Do NOT log user emails or PII beyond IDs

Tests:
- Integration test: request without x-request-id gets one generated and echoed in response header
- Integration test: request with x-request-id has it propagated to error response and logs
- Integration test: an error thrown deep in a service shows tenantId + branchId in the logged event

Do NOT:
- Add a global logging library beyond Nest Logger (no Winston/Pino swap)
- Store the request context in a database
- Change any success response shapes
- Add correlation IDs to Supabase queries (out of scope)

After done:
- Update audit report marking C2 and C3 as Fixed
- Update docs/deployment or similar noting /health/ready as DO probe endpoint
- Commit as: fix(scan-section-8): split health checks and add request-scoped logging context
```

### Success Criteria
- [ ] `/health` unchanged, still immediate liveness
- [ ] `/health/ready` pings DB with timeout
- [ ] Request ID middleware installed
- [ ] CLS context populated by guards
- [ ] Errors logged with requestId, tenantId, branchId, userId
- [ ] Error responses include requestId for user support

### Manual Verification
Curl `/health` — should be instant. Curl `/health/ready` — should be ~50–200ms. Stop the Supabase project momentarily, curl `/health/ready` — should return 503. Trigger any known error endpoint, check DO logs — should see the tenant IDs.

**Also update DigitalOcean's health probe configuration to point at `/health/ready` (not `/health`) for readiness.**

---

## Section 9: Frontend Noisy Operation Confirmations (Phase 2 M10)

- [ ] Complete
- **Fixes:** Phase 2 M10 (FE noisy-neighbor triggers)
- **Estimated:** 4–6 hours
- **Depends on:** Section 6 (rate limiting already protects backend, but UX still needed)

### Context
One click on the frontend can trigger a backend-critical operation (export, bulk PDF, challan generation). Even with rate limiting on the backend, the UX should discourage accidental triggers.

### Cursor Prompt

```
Task: Add confirmation dialogs and re-entry protection to heavy frontend operations.

References:
- docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md — M10

Files to update:
- Data export UI (find in settings or admin)
- frontend/src/hooks/api/useIdCards.ts + related ID cards bulk UI
- Results bulk ZIP UI (grep for handleBulkZip)
- Fee challans generate UI (frontend/src/components/fees/ChallansTab.tsx)

For each heavy operation:
1. Add Mantine confirmation modal before triggering the API:
   - Title: '[Operation name] will take a while'
   - Body: explain what will happen, estimated time, note that it can't be canceled
   - Show scale info if possible: 'Generating X PDFs for Y students'
   - Two buttons: 'Cancel' and 'Start [operation]'
2. Once started:
   - Disable the trigger button
   - Show a loading state with clear text
   - Prevent re-entry: even if user navigates away and comes back, button stays disabled if operation is in flight
   - Use TanStack Query mutation isPending state
3. On error:
   - Show clear error message from backend (including requestId from Section 8)
   - Re-enable button
4. On success:
   - Show success toast with what was generated
   - Re-enable button

Also handle 429 (rate limit) gracefully:
- Read Retry-After header
- Show: 'Too many requests. Try again in N seconds.'

Do NOT:
- Add optimistic UI to these heavy operations
- Add client-side throttling beyond preventing re-entry (server rate limit is authoritative)
- Change the backend API contracts

Tests:
- Manual — no automated tests needed, verify UX

After done:
- Update audit report marking M10 as Fixed
- Commit as: fix(scan-section-9): confirmation dialogs and re-entry protection on heavy ops
```

### Success Criteria
- [ ] Confirmation modal before every heavy operation
- [ ] Buttons disabled during operation
- [ ] Rate limit errors shown clearly with retry time
- [ ] Cannot double-click to trigger twice

### Manual Verification
Try to trigger a bulk export twice quickly — second click should do nothing. Trigger a rate-limited response (hit it multiple times) — UI shows the retry message properly.

---

# PART C — MONITORING (Custom, No External Tools)

Free Sentry alternative built inside Alma. Uses existing infra. No approvals needed.

---

## Section 10: Error Log Table + Backend Capture (Phase 3 C1 alternative)

- [ ] Complete
- **Fixes:** Phase 3 C1 (no APM) — custom alternative
- **Estimated:** 4–6 hours
- **Depends on:** Section 8 (need request ID + CLS)

### Context
No approvals for external APM tools. Build a lightweight in-house error tracker using Supabase and the request context we already added in Section 8.

### Cursor Prompt

```
Task: Build a lightweight in-house error log system.

References:
- docs/audits/DEEP_SCAN_3(SMELLS-MONITORING)_Report.md — C1

Create migration: supabase/migrations/YYYYMMDD_error_log_table.sql

Schema:
CREATE TABLE error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT,
  user_id UUID,
  branch_id UUID,
  tenant_id UUID,
  method TEXT,
  url TEXT,
  status_code INT,
  error_name TEXT,
  error_message TEXT,
  error_stack TEXT,
  user_agent TEXT,
  ip_address TEXT,
  source TEXT NOT NULL DEFAULT 'backend', -- 'backend' or 'frontend'
  fingerprint TEXT, -- hash of stack top for grouping
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_log_created ON error_log(created_at DESC);
CREATE INDEX idx_error_log_branch_created ON error_log(branch_id, created_at DESC) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_error_log_fingerprint ON error_log(fingerprint, created_at DESC);

Backend integration:
Files: update backend/src/common/filters/http-exception.filter.ts
       create backend/src/modules/error-log/error-log.service.ts

1. In HttpExceptionFilter, after logging with Logger, also insert into error_log
2. Only insert for status codes >= 500 (or 400s that are unexpected — skip validation errors that are user's fault)
3. Populate all fields from CLS context (Section 8) + request
4. Compute fingerprint: SHA-256 hash of first 3 lines of stack trace, truncated to 16 chars
5. Insert must NOT throw or block the response — wrap in try/catch, use fire-and-forget
6. Truncate error_stack to first 4000 chars to avoid huge rows

Nightly cleanup:
- Create a cron in backend that runs daily to DELETE FROM error_log WHERE created_at < now() - interval '30 days'
- Use existing cron infrastructure (find how other crons are set up)

Do NOT:
- Log request bodies (may contain PII)
- Log passwords, tokens, or auth headers
- Block the response on error_log insert
- Add error_log to any RLS policy (service role only)

Tests:
- Integration test: trigger a 500 → verify error_log row created with correct tenant/branch
- Integration test: validation error (400) → no error_log row (skipped)
- Integration test: error_log insert failure does not affect the original response

After done:
- Update audit report noting C1 is partially addressed (in-house, not external APM)
- Commit as: feat(scan-section-10): add error_log table and backend capture
```

### Success Criteria
- [ ] Migration creates table with indexes
- [ ] Exception filter captures 500s (and unexpected 400s) into table
- [ ] Insert failures do not affect response
- [ ] Fingerprint enables grouping of similar errors
- [ ] Nightly cleanup removes rows older than 30 days
- [ ] No PII or auth data logged

### Manual Verification
Trigger a known bug (or throw a test error in dev). Query `SELECT * FROM error_log ORDER BY created_at DESC LIMIT 5` — should see the entry with all context populated.

---

## Section 11: Admin Errors Dashboard + Frontend Error Capture (Phase 3 C1, M8)

- [ ] Complete
- **Fixes:** Phase 3 C1 (viewing errors), M8 (FE error boundary reporting)
- **Estimated:** 4–6 hours
- **Depends on:** Section 10

### Context
The error_log table is only useful if you can see it. Add a super_admin dashboard, plus capture frontend errors into the same table.

### Cursor Prompt

```
Task: Add super_admin errors dashboard and route frontend errors to the same log.

References:
- docs/audits/DEEP_SCAN_3(SMELLS-MONITORING)_Report.md — C1, M8

Backend endpoint:
Create backend/src/modules/error-log/error-log.controller.ts

Endpoints (all super_admin only):
1. POST /api/v1/errors/report
   - Public-ish: no auth required so frontend crashes without valid session can still report
   - Rate-limited HEAVILY (10/min per IP) to prevent abuse
   - Body: { message, stack, url, userAgent, userId?, branchId?, digest? }
   - Inserts into error_log with source = 'frontend'
   - Rejects if message or stack missing

2. GET /api/v1/admin/errors
   - super_admin only
   - Query params: branchId?, source?, since?, until?, fingerprint?, page?, pageSize?
   - Returns paginated list with total count
   - Default sort: created_at DESC
   - Include grouping info: for each row, include count of same fingerprint in last 24h

3. GET /api/v1/admin/errors/:id
   - super_admin only
   - Returns single error with full stack

4. GET /api/v1/admin/errors/summary
   - super_admin only
   - Returns aggregate: total errors last 24h, top 10 fingerprints by count, errors per tenant

Frontend admin page:
Create frontend/src/app/(portal)/super-admin/errors/page.tsx

- Match existing admin UI style (Mantine Table + Modal)
- Table columns: Time, Branch, User, URL, Status, Error Message
- Filters: Branch dropdown, Source (backend/frontend), Date range, Search by message
- Click a row → modal with full stack trace, user agent, request ID
- 'Similar errors' badge showing fingerprint count
- Auto-refresh every 30 seconds (toggle)

Frontend error boundary integration:
File: frontend/src/app/(portal)/error.tsx
Also: frontend/src/app/(portal)/global-error.tsx if it exists

- Keep console.error (dev is helpful)
- In useEffect, fetch POST /api/v1/errors/report with:
  - message, stack, digest (from Next error boundary)
  - current URL, userAgent
  - userId and branchId from wherever session state lives
- Wrap in try/catch — reporting failure must not cause another crash

Do NOT:
- Show the errors dashboard to non-super_admin roles
- Include reporting endpoint in the openapi/public docs
- Store passwords, tokens, or full request bodies

Tests:
- Integration test: super_admin can GET /admin/errors
- Integration test: normal admin gets 403
- Integration test: POST /errors/report inserts with source='frontend'
- Integration test: POST /errors/report is rate limited after 10 requests

After done:
- Update audit report marking C1 (in-house version) and M8 as Fixed
- Add link to the dashboard in super_admin navigation
- Commit as: feat(scan-section-11): admin errors dashboard and frontend crash reporting
```

### Success Criteria
- [ ] Dashboard shows recent errors with filters
- [ ] Frontend crashes report to the same table
- [ ] Reporting endpoint is heavily rate-limited
- [ ] Only super_admin can view dashboard
- [ ] Fingerprint-based grouping visible

### Manual Verification
Cause a real frontend crash (throw new Error in a component). Watch the dashboard within 30 seconds — the crash should appear with source='frontend', digest, and stack. Click into it — full detail visible.

---

# PART D — NOISY NEIGHBOR FIXES

Phase 1 criticals. These stop one tenant from hurting others.

---

## Section 12: Data Export — Hard Block + Streaming (Phase 1 C1)

- [ ] Complete
- **Fixes:** Phase 1 C1 (export holds full tenant payload in memory)
- **Estimated:** 2–3 days
- **Depends on:** Section 6 (rate limiting), Section 10 (error log)

### Context
A single admin exporting a large school's data currently loads the entire dataset into Node memory before zipping. Concurrent exports can OOM the API. Phase 1a is a hard block for large schools; Phase 1b is proper streaming.

### Cursor Prompt

```
Task: Prevent data export from OOM-ing the API. Two-phase fix.

References:
- docs/audits/DEEP_SCAN_1(DB-BACKEND)_Report.md — C1
- backend/src/modules/data-export/school-data-collector.service.ts:45-97
- backend/src/modules/data-export/data-export.service.ts (rate limit code to extend)

Phase 1a — Hard block (do first, deploy immediately after this section):

Before starting an export:
1. Query row counts for the caller's branch across the biggest tables:
   - students, staff, attendance, student_grades, audit_logs
2. Estimate total size (assume ~2KB per row average)
3. If estimated size > 50MB OR student count > 2000:
   - Return 413 Payload Too Large
   - Body: { error: 'export_too_large', message: 'Contact support for large exports. Background export coming soon.', estimatedSizeMB: N, studentCount: N }
4. Also enforce max 1 concurrent export per host (global mutex — in-memory boolean is fine for single-node)
5. Also enforce max 1 export per branch per 24 hours (extend existing rate limit)

Phase 1b — Streaming (do in same session but as a second commit):

Refactor school-data-collector.service.ts:
1. Do NOT accumulate all tables into one `sections: Record<string, unknown[]>` object
2. Stream per-table JSONL chunks directly into the zip:
   - For each table: fetch page 1000 → write to zip stream → fetch page 2 → write → ...
   - Never hold more than 1000 rows in memory per table at a time
3. Do NOT JSON.stringify the whole payload — stream JSON output
4. Encryption: encrypt each table stream separately, not the concatenated whole
5. Use archiver or yazl for streaming zip — check if either is already installed

Do NOT:
- Remove existing rate limit logic in data-export.service — extend it
- Change the export file format (still zip with encrypted JSONL inside)
- Change API endpoint URL or response shape (except adding the 413 case)
- Ship 1b without 1a — 1a is the safety net

Tests:
- Integration test: large tenant (mock) → 413 with clear error
- Integration test: small tenant → succeeds
- Integration test: concurrent exports → second one blocked
- Manual: test with realistic small-tenant data, verify zip contents are correct

After done:
- Update audit report marking C1 as Fixed
- Commit as two commits: 
  1. fix(scan-section-12a): hard-block large exports
  2. fix(scan-section-12b): stream exports instead of accumulating in memory
```

### Success Criteria
- [ ] Large exports return 413 with clear message
- [ ] Only one export runs per host at a time
- [ ] Only one export per branch per 24h
- [ ] Streaming implementation never holds > 1000 rows per table in memory
- [ ] Zip contents verified correct after streaming refactor

### Manual Verification
Try exporting a small test tenant — should succeed with correct data. Try exporting a large tenant (or mock a large one) — should return 413 with clear error message.

---

## Section 13: Shared PDF Pool Service (Phase 1 C2/C3, Phase 3 M3)

- [ ] Complete
- **Fixes:** Phase 1 C2, C3; Phase 3 M3 (duplicated Puppeteer)
- **Estimated:** 1–2 days
- **Depends on:** Section 6 (rate limiting)

### Context
Puppeteer's `browser.launch()` is called from ~9 files (~20 launches). Each launch is expensive. Bulk operations fan out multiple concurrent launches. Build a shared pool once, migrate all callers.

### Cursor Prompt

```
Task: Build a shared Puppeteer browser pool service. Do NOT migrate callers yet.

References:
- docs/audits/DEEP_SCAN_1(DB-BACKEND)_Report.md — C2, C3
- docs/audits/DEEP_SCAN_3(SMELLS-MONITORING)_Report.md — M3
- Existing similar work: Fix 6 (results ZIP) — check what pattern was used, follow it

Create: backend/src/common/services/pdf-pool.service.ts

Requirements:
1. Singleton service that maintains ONE browser instance shared across all callers
2. Concurrency-limited via a semaphore
3. Env vars:
   - PDF_MAX_CONCURRENCY (default 2)
   - PDF_BROWSER_MAX_PAGES (default 100) — recycle after this many total pages
   - PDF_BROWSER_MAX_UPTIME_MINUTES (default 30) — recycle regardless
4. Interface:
   ```
   async renderPdf(html: string, options?: {
     format?: 'A4' | 'Letter' | ...,
     landscape?: boolean,
     printBackground?: boolean,
     margin?: { top, right, bottom, left },
     timeout?: number, // default 30000
   }): Promise<Buffer>
   ```
5. Under the hood:
   - Acquire semaphore
   - Ensure browser is launched (or relaunched if recycle criteria hit)
   - browser.newPage()
   - page.setContent(html, { waitUntil: 'networkidle0' })
   - const buffer = await page.pdf(options)
   - page.close()
   - Release semaphore
6. Graceful shutdown: on app termination, close the browser
7. Health check helper: async isHealthy(): Promise<boolean> — returns whether browser is alive

Configuration:
- Add to app.module providers
- Add to health check readiness (Section 8 /health/ready)

Do NOT in this section:
- Migrate any existing Puppeteer callers — that is Section 14
- Change any existing PDF output
- Remove existing puppeteer.launch calls from other files

Tests:
- Unit test: two concurrent renderPdf calls do not exceed PDF_MAX_CONCURRENCY
- Unit test: 101st call triggers browser recycle
- Unit test: renderPdf returns a valid PDF buffer
- Integration test: pool survives 10 rapid consecutive calls without leaking pages

After done:
- Update audit report noting infrastructure ready but not yet migrated
- Commit as: feat(scan-section-13): shared PDF browser pool service
```

### Success Criteria
- [ ] Service compiles and starts
- [ ] Concurrency capped at env var value
- [ ] Browser recycles on page or time limit
- [ ] Graceful shutdown closes browser
- [ ] Health check integrated

### Manual Verification
Add a temporary test endpoint that calls `renderPdf` with sample HTML. Hit it 10 times fast. `ps aux | grep chrome` on the server — should see only one Chromium process (or two while recycling). Remove test endpoint.

---

## Section 14: Migrate All Puppeteer Sites to Pool (Phase 1 C2/C3, Phase 3 M3)

- [ ] Complete
- **Fixes:** Phase 1 C2, C3; Phase 3 M3
- **Estimated:** 2–3 days
- **Depends on:** Section 13

### Context
Now migrate every existing `puppeteer.launch` caller to use the pool. This is the big code-quality win. Do it all in one PR — partial migration is worse than none.

### Cursor Prompt

```
Task: Migrate ALL Puppeteer callers to use the shared PdfPoolService from Section 13.

References:
- docs/audits/DEEP_SCAN_1(DB-BACKEND)_Report.md — C2, C3
- docs/audits/DEEP_SCAN_3(SMELLS-MONITORING)_Report.md — M3
- Existing shared service: backend/src/common/services/pdf-pool.service.ts

Step 1: Enumerate ALL call sites first
Run: grep -rn 'puppeteer.launch' backend/src
List every file. Expected candidates (verify by grepping):
- id-cards/id-card-pdf.service.ts
- fees/fee-pdf.service.ts
- reports/(various report PDF services)
- certificates/(certificate PDF service if exists)
- results (may already use Fix 6 pattern — skip if so)
- assessments (attachment or draft PDF paths)
- subscription/invoice PDF service
- revenue reports if separate

Report the full list before migrating so we can review.

Step 2: For each file, migrate:
- Remove local puppeteer.launch, browser.close, args
- Inject PdfPoolService via constructor
- Replace the render call with pdfPool.renderPdf(html, options)
- Preserve the exact PDF options (format, margin, landscape, printBackground)
- Do NOT change the generated HTML — that is the caller's job

Step 3: For bulk operations, remove old concurrency limits:
- id-cards.service.ts — remove BULK_CHUNK = 3, let pool handle concurrency
- fees challan bulk — same
- Any other bulk site with local concurrency caps

Step 4: Add a lint rule (or CI grep) that fails on any new puppeteer.launch in modules/**:
- Update package.json scripts:
  "lint:no-puppeteer-launch": "grep -rn 'puppeteer.launch' backend/src/modules && exit 1 || exit 0"

Do NOT:
- Change any PDF's visual output (same options, same HTML, same result)
- Change any endpoint's response
- Fix HTML generation issues found along the way — separate concern
- Skip a file 'just for now' — migrate all or roll back

Tests:
- Run existing PDF generation tests, verify all pass
- Manual: generate one PDF from each module, visually diff against a pre-migration sample

After done:
- Update audit report marking C2, C3 (Phase 1), M3 (Phase 3) as Fixed
- Commit as: fix(scan-section-14): migrate all Puppeteer callers to PdfPoolService
```

### Success Criteria
- [ ] Zero `puppeteer.launch` calls remain in `backend/src/modules/**`
- [ ] Every PDF-generating service uses `PdfPoolService`
- [ ] Bulk operations no longer have local concurrency caps
- [ ] Lint check catches new violations
- [ ] All existing tests pass

### Manual Verification
Generate one PDF from each type (ID card, fee challan, report, certificate, invoice). Open each — should look identical to before. Server-side: `ps aux | grep chrome` during a bulk operation — should show ONE process.

---

## Section 15: Assessment Publish Notification Batching (Phase 1 C4)

- [ ] Complete
- **Fixes:** Phase 1 C4 (unbounded notification fan-out)
- **Estimated:** 1 day
- **Depends on:** none

### Context
Publishing an assessment currently fires one notification insert per recipient in parallel with no cap. Exam week × many classes × many tenants = notification storm.

### Cursor Prompt

```
Task: Batch notification creation for assessment publish.

References:
- docs/audits/DEEP_SCAN_1(DB-BACKEND)_Report.md — C4
- backend/src/modules/assessments/assessments.service.ts:363-376

Current problem:
- `await Promise.allSettled(recipientUserIds.map((userId) => this.notificationsService.createNotification({ userId, ... })))`
- Creates N parallel DB inserts and N parallel push deliveries per publish

Required:
1. Replace per-user createNotification calls with a single batch insert:
   - Extend NotificationsService to add createNotificationsBatch(notifications: NotificationInput[])
   - Uses single supabase.from('notifications').insert(bulkArray)
   - Returns the created rows
2. For push delivery (Expo/APNS/whatever is used):
   - Queue it, do not await in the publish flow
   - Use mapWithConcurrency(4-8) to send pushes
   - Failures logged but not blocking

If a job queue infrastructure does not exist yet (Bull/BullMQ/etc.):
- For now, use mapWithConcurrency for pushes and don't await the whole thing (fire-and-forget after batch DB insert)
- Add a TODO comment: 'Move to job queue when infrastructure exists'
- Do NOT add BullMQ etc. in this section — separate concern

Also check: does the same fan-out pattern exist elsewhere?
- grep backend for: Promise.allSettled(.*map.*createNotification
- grep backend for: Promise.all(.*map.*createNotification
- If found, apply the same fix

Do NOT:
- Change what data is stored in notifications
- Change push delivery format
- Add BullMQ/Redis in this section

Tests:
- Integration test: publish assessment with 100 recipients → verify 1 batch insert, not 100
- Verify all recipient rows created
- Verify existing single createNotification callers still work

After done:
- Update audit report marking C4 as Fixed
- Commit as: fix(scan-section-15): batch notifications on assessment publish
```

### Success Criteria
- [ ] Single DB insert for all recipients
- [ ] Pushes fire-and-forget with concurrency cap
- [ ] Same pattern applied wherever else found
- [ ] All recipient rows still created

### Manual Verification
Publish a test assessment with a class of 10+ students. Check server logs for DB query count — should see one insert, not ten. Verify each student got a notification in the notifications table.

---

# PART E — FRONTEND POLISH

User-visible wins. Do after Parts A–D but before Part F.

---

## Section 16: Kill Theme Polling + Messages Cleanup (Phase 2 M4, M5)

- [ ] Complete
- **Fixes:** Phase 2 M4 (theme 300ms polling), M5 (messages logs + poll)
- **Estimated:** 1–2 days
- **Depends on:** none

### Context
Three global 300ms `setInterval`s are running on every portal session. This is a constant CPU tax on school laptops. Also the messages page has 19 `console.log` calls left in production.

### Cursor Prompt

```
Task: Two frontend cleanups — kill DynamicThemeProvider polling and clean up messages page.

References:
- docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md — M4, M5
- frontend/src/components/providers/DynamicThemeProvider.tsx (~1256 lines)
- frontend/src/app/(portal)/messages/page.tsx

Fix A — DynamicThemeProvider polling:

Current problem:
- Three setInterval(fn, 300) calls plus MutationObservers running on every session
- Applied styles are being re-applied constantly

Required:
1. Identify what the interval is actually trying to achieve
   - Likely applying header styles in reaction to theme/branding changes
2. Replace intervals with event-driven updates:
   - Apply once on theme change
   - Apply once on branding data load
   - Apply once on mount
3. Remove ALL setInterval and MutationObserver code from this file
4. If a style genuinely needs to update on some DOM event, use a targeted event listener, not a poll

Verify after: search this file for setInterval and setTimeout — should be zero setIntervals and only intentional setTimeouts.

Fix B — Messages page cleanup:

Current problem:
- 19 console.log calls in production code
- 20-second polling from Sprint 1 trade-off

Required:
1. Remove ALL console.log, console.debug, console.info calls from messages/page.tsx
2. Keep console.error only if genuinely useful (usually not — replace with proper error state)
3. Poll interval: increase from 20s to 60s (Realtime is preferred but out of scope here)
4. Add ESLint override at file top if any console.error must stay: /* eslint-disable no-console */

Do NOT:
- Rewrite the theme provider architecture (that is a bigger fish)
- Refactor the messages page structure (M2 goal, not this)
- Convert messages to Realtime yet (separate ticket)

Tests:
- Manual — verify theme still updates when user changes branding colors in settings
- Manual — verify messages still update within a minute

After done:
- Update audit report marking M4 and M5 as Fixed
- Commit as two commits:
  1. fix(scan-section-16a): remove DynamicThemeProvider polling intervals
  2. fix(scan-section-16b): remove console noise from messages, raise poll to 60s
```

### Success Criteria
- [ ] No setInterval in DynamicThemeProvider
- [ ] Theme updates still work via events
- [ ] No console.log in messages/page.tsx
- [ ] Poll raised to 60 seconds

### Manual Verification
Open Alma in Chrome DevTools → Performance tab, record 10 seconds of idle time. Before: constant activity. After: nearly quiet. Also: change a theme color in settings, verify UI updates immediately.

---

## Section 17: Debounce All Search Inputs (Phase 2 M6)

- [ ] Complete
- **Fixes:** Phase 2 M6 (undebounced search)
- **Estimated:** 3–4 hours
- **Depends on:** none

### Context
Assessments, ID cards, and fee payments search boxes fire an API call on every keystroke. Students and library already use `useDebouncedValue(300)`. Standardize this everywhere.

### Cursor Prompt

```
Task: Standardize debouncing on all search inputs that trigger API calls.

References:
- docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md — M6
- Existing pattern to follow: search students/library uses Mantine's useDebouncedValue(300)

Files to update (verify by reading — audit listed these):
- frontend/src/app/(portal)/assessments/page.tsx:80-135
- frontend/src/app/(portal)/id-cards/page.tsx:40-79
- frontend/src/components/fees/PaymentsTab.tsx:112-131

Also grep for other list pages with a search input:
- grep frontend for: 'search' near 'useQuery' or 'refetch'
- flag any list page that lacks useDebouncedValue

For each:
1. Wrap the search state with useDebouncedValue(searchValue, 300)
2. Pass the debounced value (not raw) to the query params
3. Verify the search input stays snappy (debounces only the API call, not the input)

Do NOT:
- Change API contracts
- Change UI layout
- Debounce non-search inputs (form fields, etc.)

After done:
- Update audit report marking M6 as Fixed
- Commit as: fix(scan-section-17): debounce list-page search inputs to 300ms
```

### Success Criteria
- [ ] All list-page search inputs use `useDebouncedValue`
- [ ] Input remains snappy (immediate visual update)
- [ ] API call only fires after 300ms of no typing

### Manual Verification
Open network tab in browser. Go to Assessments, type "trigonometry" letter by letter fast. Before: 12 API calls. After: 1 API call.

---

## Section 18: Tab-Gated Data Fetching + Kill Console Logs (Phase 2 M7, cross-cutting)

- [ ] Complete
- **Fixes:** Phase 2 M7 (reports/results/settings eager fetches)
- **Estimated:** 1–2 days
- **Depends on:** none

### Context
Reports and Settings pages fetch data for all tabs on mount, even for tabs the user never opens. Also leftover console.log in settings.

### Cursor Prompt

```
Task: Tab-gate data fetching on Reports, Results, and Settings pages. Clean up debug logs.

References:
- docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md — M7
- frontend/src/app/(portal)/reports/page.tsx:103-122
- frontend/src/app/(portal)/results/page.tsx:95-120
- frontend/src/app/(portal)/settings/page.tsx (1530 lines, debug logs ~891-898)

Fix A — Tab-gated queries:

For each page:
1. Identify the useQuery/useSWR calls
2. Add `enabled: activeTab === 'expectedTabName'` to queries that are only used on one tab
3. For queries used on ALL tabs (rare), leave enabled
4. Ensure default tab data still loads on mount

Reports page specifically:
- Students (limit 100) loads regardless of tab → only load on tabs that need it
- Class sections loads regardless → only load if needed
- Public counts → only load on the public-facing tab

Settings page specifically:
- Only fetch settings for the active tab
- Do NOT statically import all tab panels — this is Section 19

Fix B — Remove settings console logs:
- Remove console.log, console.debug, console.info at settings/page.tsx ~891-898 (verify line numbers)
- Verify no other debug logs in settings

Do NOT:
- Rewrite the page structure
- Convert to server components (M3 territory, later)
- Change tab switching behavior

Tests:
- Manual — open Reports on 'attendance' tab, check network — only attendance data loaded
- Manual — switch to 'academic' tab, network shows new load

After done:
- Update audit report marking M7 as Fixed
- Commit as: fix(scan-section-18): tab-gate queries on Reports/Results/Settings + remove debug logs
```

### Success Criteria
- [ ] Queries `enabled` on activeTab match
- [ ] Only active tab data loads on mount
- [ ] No debug console calls in settings page
- [ ] Tab switching still works

### Manual Verification
Open Reports page with network tab open. Only see requests for the default tab. Click a different tab — see the new requests appear.

---

## Section 19: Dashboard Aggregator + Dynamic Imports (Phase 2 M1, M2)

- [ ] Complete
- **Fixes:** Phase 2 M1 (dashboard fan-out), M2 (no dynamic imports)
- **Estimated:** 2–3 days
- **Depends on:** none

### Context
Admin dashboard fires ~10 parallel API queries on mount. All four role dashboards ship in one client chunk. Recharts imported statically everywhere. Fix both together since they touch overlapping files.

### Cursor Prompt

```
Task: Reduce dashboard load fan-out and introduce dynamic imports for heavy libraries.

References:
- docs/audits/DEEP_SCAN_2(FRONTEND-MULTI-TENANT)_Report.md — M1, M2

Fix A — Dashboard aggregator endpoint:

Backend:
- Create GET /api/v1/dashboard/summary
- Query params: role, branchId (from BranchGuard)
- Returns single response with all counts the dashboard needs:
  {
    students: { count },
    staff: { count },
    leaveRequests: { pendingCount },
    earlyDepartures: { pendingCount },
    storage: { ... },
    lowStock: { count },
    unreadCount,
    conflicts: { count },
    upcomingEventsConflictCount,
    attendanceSummary: { ... }
  }
- Compute all in parallel on the backend (Promise.all internally is fine — one host)
- Cache result briefly if that fits your patterns (30s in-memory per branch)

Frontend:
- Replace the ~10 individual useQuery calls in AdminDashboardOverview with a single useDashboardSummary hook
- Use the summary endpoint
- Preserve current UI — just one query instead of ten

Fix B — Dynamic imports:

Files with recharts static imports (5 flagged):
- Dashboard overview components
- Substitution reports
- Any other chart-heavy component

For each:
- Convert recharts import to dynamic:
  const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false })
- Only affects charts, not everything else
- Show loading skeleton while chart lazy-loads

Also dynamic import:
- PDF viewer components (pdfjs-dist / react-pdf) — only load when opened
- xlsx / bulk import UI — only when user visits bulk import
- Onboarding tour library — only when tour is triggered

Do NOT:
- Rewrite dashboard layout
- Change what data is displayed
- Dynamic-import basic UI components (Mantine buttons etc.) — not worth it

Tests:
- Integration test: /dashboard/summary returns all fields
- Integration test: dashboard summary is per-branch (different branch = different numbers)
- Manual: verify dashboard loads with same content
- Manual: run `next build`, capture First Load JS size before/after — should drop noticeably

After done:
- Update audit report marking M1, M2 as Fixed
- Note new First Load JS metric in the report appendix
- Commit as two commits:
  1. feat(scan-section-19a): dashboard summary aggregator endpoint
  2. perf(scan-section-19b): dynamic imports for recharts and heavy libs
```

### Success Criteria
- [ ] Dashboard makes 1 API call, not 10
- [ ] Recharts loads only when charts render
- [ ] PDF viewers load only when opened
- [ ] Bulk import UI loads only when visited
- [ ] Bundle size dropped (measure with `next build`)

### Manual Verification
Open dashboard with browser network tab. Before: ~10 requests. After: ~1 request. Also `next build` and note the "First Load JS" for `/dashboard` — should be smaller than before.

---

# PART F — DATA LAYER HYGIENE

Query performance and index cleanup. Less urgent than security/monitoring but real impact.

---

## Section 20: Data Layer Batching Fixes (Phase 1 M2, M4, M5, M9, M10)

- [ ] Complete
- **Fixes:** Phase 1 M2 (grades bulk), M4 (parents assoc preload), M5 (timetable), M9 (reports comparison), M10 (draft commit)
- **Estimated:** 3–4 days
- **Depends on:** none

### Context
Multiple services do parallel per-row DB writes or load entire ID sets before filtering. Fix them together since the patterns are similar.

### Cursor Prompt

```
Task: Fix batching and preload patterns across multiple services.

References:
- docs/audits/DEEP_SCAN_1(DB-BACKEND)_Report.md — M2, M4, M5, M9, M10

Fix A — Grades bulk save (M2):
File: backend/src/modules/grades/grades.service.ts:327-359

Current:
- Promise.all over toUpdate array, each calls .update().select('*').single()
- Full-class save opens dozens of parallel writes

Fix:
- Use mapWithConcurrency(4) OR single batch upsert using postgres RPC
- Prefer explicit column selection instead of select('*')
- Return only the columns the caller needs

Fix B — Parents associations (M4):
File: backend/src/modules/parents/parents.service.ts:472-489

Current:
- Loads ALL branch student IDs first
- Then does .in('student_id', hugeArray)

Fix:
- Join at DB level using a subquery or supabase relation:
  .from('parent_students')
  .select('*, students!inner(id, branch_id)')
  .eq('students.branch_id', branchId)
- Preserve pagination
- Test with a large branch (or mock it)

Fix C — Timetable batching (M5):
File: backend/src/modules/timetable/timetable.service.ts:250-268, 1041-1049

Current:
- select('*') with nested joins
- Promise.all of single-row updates for renumber

Fix:
- Explicit columns on the nested select
- Renumber via single SQL UPDATE with CASE ... END, or mapWithConcurrency(4)

Fix D — Reports comparison cap (M9):
File: backend/src/modules/reports/reports.service.ts:2195-2236

Current:
- Sequentially awaits full getClassReport / getAcademicReportBySubject for each selected id

Fix:
- Use mapWithConcurrency(3) for the comparison loop
- Reuse cached aggregates where possible

Fix E — Draft commit (M10):
File: backend/src/modules/assessments/assessments.service.ts:2567-2601 (approx)

Current:
- Serial download → upload → insert per file
- Holds buffers, serializes Storage IOPS

Fix:
- Prefer supabase.storage.from(bucket).copy() for server-side copy
- Batch attachment inserts into one insert(bulkArray)
- If copy is not viable, at least parallelize with mapWithConcurrency(3)

Do NOT:
- Change the response shape of any of these endpoints
- Change what data is stored
- Do all five in one commit — one commit per fix

Tests:
- For each: verify existing tests pass
- Add integration test for grades bulk: save 30 grades → verify 1 batch operation (or N/4 chunks)

After done:
- Update audit report marking M2, M4, M5, M9, M10 as Fixed
- Commit as five commits, one per fix:
  1. fix(scan-section-20a): batch grades bulk save with concurrency cap
  2. fix(scan-section-20b): parents associations without full ID preload
  3. fix(scan-section-20c): timetable batched updates and column selection
  4. fix(scan-section-20d): reports comparison concurrency cap
  5. fix(scan-section-20e): draft commit server-side copy and batched inserts
```

### Success Criteria
- [ ] Grades bulk uses concurrency cap or batch upsert
- [ ] Parents associations no longer preloads all IDs
- [ ] Timetable uses explicit columns and batched updates
- [ ] Reports comparison capped at concurrency 3
- [ ] Draft commit uses copy or concurrency cap

### Manual Verification
For each fix, add a temporary DB query counter, exercise the endpoint, count queries — should be dramatically fewer. Remove counter after.

---

## Section 21: Index Hygiene — Add Hot FKs, Drop Unused (Phase 1 M7)

- [ ] Complete
- **Fixes:** Phase 1 M7 (unindexed FKs, unused indexes, duplicates)
- **Estimated:** 1–2 days
- **Depends on:** Section 20 (want new query patterns settled first)

### Context
Supabase advisor flags 88 unindexed FKs, 49 unused indexes, 5 duplicates. Add indexes on the FKs actually used in queries. Drop confirmed unused. Be careful — indexes cost writes.

### Cursor Prompt

```
Task: Add missing indexes on hot FKs and drop confirmed unused indexes.

References:
- docs/audits/DEEP_SCAN_1(DB-BACKEND)_Report.md — M7
- Supabase advisors: get_advisors 'performance' → filter for 'unindexed_foreign_keys' and 'unused_index'

Step 1: Identify HOT FKs (not just all FKs)
- Run get_advisors for performance
- List every unindexed_foreign_keys finding
- For each, grep backend code for queries that filter/join on that FK column
- Prioritize FKs that appear in Nest queries — these are hot

Report the list before creating migrations. Do NOT index cold FKs — indexes cost writes.

Step 2: Create migration for hot FK indexes:
File: supabase/migrations/YYYYMMDD_hot_fk_indexes.sql

For each identified hot FK:
- CREATE INDEX IF NOT EXISTS idx_<table>_<column> ON <table>(<column>);
- If the FK is often filtered with branch_id, prefer composite: (branch_id, <fk_column>)
- Note the source finding in a comment above each

Step 3: Identify confirmed unused indexes:
- Run get_advisors for unused_index
- Cross-reference with pg_stat_user_indexes to confirm zero idx_scan over a meaningful period
- LIST candidates but do NOT drop yet — this needs a production observation window

Report the list. Include in a NEW file: docs/audits/unused-index-candidates.md
Format: 
| Index | Table | Size | idx_scan | Last observed |
|-------|-------|------|----------|---------------|

Step 4: Drop DUPLICATE indexes (safer than unused):
- 5 duplicate indexes flagged by advisors
- Duplicates are safe to drop (the equivalent one remains)
- Create migration: YYYYMMDD_drop_duplicate_indexes.sql

Step 5: Investigate idx_attendance_marked_by:
- Advisor showed high idx_scan but idx_tup_read = 0
- Likely means planner picks it but returns no tuples
- Run: SELECT * FROM pg_stat_user_indexes WHERE indexname = 'idx_attendance_marked_by'
- Recommend keeping or dropping in a comment in the audit report

Do NOT:
- Drop any 'unused' index in this session — only duplicates
- Add indexes on cold tables just because advisor flagged them
- CREATE INDEX without IF NOT EXISTS

Tests:
- Migrations run cleanly
- No queries break after new indexes (they can only speed things up)
- After duplicate drops, verify no query got slower — use EXPLAIN on a representative query

After done:
- Update audit report marking M7 as partially Fixed (hot FKs + duplicates done, unused pending observation)
- Commit as:
  1. perf(scan-section-21a): add indexes on hot foreign keys
  2. perf(scan-section-21b): drop confirmed duplicate indexes
  3. docs(scan-section-21c): document unused index candidates for later drop
```

### Success Criteria
- [ ] Hot FK indexes created
- [ ] Duplicate indexes dropped
- [ ] Unused index candidates documented, not dropped yet
- [ ] Attendance marked-by anomaly investigated

### Manual Verification
After running migrations, spot-check with Supabase advisors — the FK count should drop from 88. Duplicate count should drop from 5.

---

## Section 22: RLS Init Plan Optimization (Phase 1 M8)

- [ ] Complete
- **Fixes:** Phase 1 M8 (RLS init plan × 83)
- **Estimated:** 2–3 days (careful QA required)
- **Depends on:** none

### Context
83 RLS policies re-evaluate `auth.uid()` per row instead of `(SELECT auth.uid())`. Nest uses service role so this mostly hits Realtime/client paths. Fix hot tables first.

### Cursor Prompt

```
Task: Optimize RLS policies to use init plan pattern.

References:
- docs/audits/DEEP_SCAN_1(DB-BACKEND)_Report.md — M8
- Supabase docs: https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations

Step 1: Identify hot Realtime/client tables
- The advisor flags 83 policies — do not fix them all
- Priority is tables accessed via Realtime or client-directly (not Nest service-role)
- Likely hot tables (verify): notifications, messages, student_grades, attendance, students
- Cold tables (defer): most admin/settings tables

Report the shortlist first. Aim for the top 10–15 policies covering the hottest paths.

Step 2: Rewrite each policy
Original pattern:
  USING (auth.uid() = user_id)

New pattern:
  USING ((SELECT auth.uid()) = user_id)

This forces the planner to evaluate auth.uid() once per query, not per row.

Same for tenant/branch checks:
  USING (auth.uid() = user_id AND branch_id IN (SELECT b FROM user_branches WHERE u = auth.uid()))
becomes:
  USING (
    (SELECT auth.uid()) = user_id 
    AND branch_id IN (SELECT b FROM user_branches WHERE u = (SELECT auth.uid()))
  )

Step 3: Migration file per table (not one giant migration)
- supabase/migrations/YYYYMMDD_rls_init_plan_<table>.sql
- DROP POLICY then CREATE POLICY
- Preserve exact permissions (only change performance, not access control)

Step 4: Test each one
- After each policy migration, run a representative query as an authenticated user
- Use EXPLAIN ANALYZE to confirm plan changed from per-row eval
- Verify same rows are returned as before

Do NOT:
- Change any policy's access control logic
- Rewrite policies you did not verify with EXPLAIN
- Do all 83 in one session — start with 10-15 hot ones
- Modify service-role paths (Nest bypasses RLS anyway)

Tests:
- For each policy: test as an authorized user (should see their rows)
- For each policy: test as an unauthorized user (should see nothing)

After done:
- Update audit report marking M8 as partially Fixed (hot tables done)
- List remaining cold tables in the audit for later
- Commit as one commit per table migration
```

### Success Criteria
- [ ] Top hot-table policies rewritten
- [ ] Access control unchanged (verified with tests)
- [ ] EXPLAIN shows init plan improvement
- [ ] Cold tables documented for later

### Manual Verification
Log in as a test user, load a page that queries a fixed table (e.g. notifications). Check that data is the same as before. Optionally check server logs or Supabase dashboard for query performance improvement.

---

# PART G — PREVENTION LAYER

Do these once, benefit forever. Stops new debt from accumulating.

---

## Section 23: ESLint Rules + CI Grep Checks (Phase 3 M5, M6; cross-cutting)

- [ ] Complete
- **Fixes:** Phase 3 M5 (console.*), M6 (any), cross-cutting duplication prevention
- **Estimated:** 2–3 hours
- **Depends on:** Section 14 (PDF pool must exist first)

### Context
Prevent the anti-patterns you just fixed from creeping back in.

### Cursor Prompt

```
Task: Add ESLint rules and CI grep checks to prevent regression.

References:
- docs/audits/DEEP_SCAN_3(SMELLS-MONITORING)_Report.md — M5, M6

Fix A — ESLint rules:

Backend (.eslintrc in backend):
- Add rule: 'no-console': ['error', { allow: ['warn', 'error'] }]
- Override for backend/scripts/**: allow console.log
- Override for backend/src/main.ts: allow console.log (bootstrap logs)
- Add rule: '@typescript-eslint/no-explicit-any': 'warn'
  - Not 'error' yet — would break build (~115 offenses)
  - Warn keeps them visible in IDE

Frontend (.eslintrc in frontend):
- Add rule: 'no-console': ['error', { allow: ['warn', 'error'] }]
- Override for frontend/scripts/**: allow console.log
- Add rule: '@typescript-eslint/no-explicit-any': 'warn'

Fix B — CI grep checks:

Add to package.json scripts (root or backend):
"lint:no-puppeteer-launch": "! grep -rn 'puppeteer.launch' backend/src/modules && echo 'PASS' || (echo 'FAIL: use PdfPoolService instead of puppeteer.launch' && exit 1)"

"lint:no-select-star": "grep -rn \"\\.select('\\*')\" backend/src/modules | tee /tmp/select-star.log && wc -l /tmp/select-star.log"
  - Warn only for now — record count as baseline
  - Fail future PRs if count grows

Add these to CI workflow (.github/workflows/... or DO pipeline):
- Run lint:no-puppeteer-launch on every PR — hard fail
- Run lint:no-select-star on every PR — output count for comparison

Fix C — Install dev tools for future audits:

npm install --save-dev depcheck knip ts-prune (in both frontend and backend)

Add scripts:
- "check:unused-deps": "depcheck"
- "check:unused-exports": "knip"
- "check:unused-code": "ts-prune"

Do NOT wire these into CI yet — just make them runnable.
Document in docs/development.md how to use them for periodic audits.

Do NOT:
- Auto-fix any existing violations in this session
- Turn any of the new rules to 'error' (except no-console which is safe)
- Add these as pre-commit hooks yet — CI is enough

After done:
- Update audit report noting prevention layer is in place
- Commit as: chore(scan-section-23): ESLint rules and CI checks to prevent regression
```

### Success Criteria
- [ ] `no-console` errors on new console.log
- [ ] `no-explicit-any` warns
- [ ] CI fails on new `puppeteer.launch` in modules
- [ ] CI records `select('*')` count as baseline
- [ ] Dev tools installed for periodic audits

### Manual Verification
Add a `console.log` to any backend module file — ESLint should complain. Add a `puppeteer.launch` — run `npm run lint:no-puppeteer-launch` — should fail.

---

## Section 24: SLO Documentation + Slow Query Awareness (Phase 3 M9, M10)

- [ ] Complete
- **Fixes:** Phase 3 M9 (no SLOs), M10 (critical path coverage)
- **Estimated:** 2–3 hours
- **Depends on:** none

### Context
No documented targets means no way to know if performance is degrading. Simple doc, not a monitoring system.

### Cursor Prompt

```
Task: Document performance SLOs and critical paths.

References:
- docs/audits/DEEP_SCAN_3(SMELLS-MONITORING)_Report.md — M9, M10

Create: docs/performance/slo.md

Structure:

# Alma Performance SLOs

## Purpose
Document target latencies and error rates so we know when performance degrades.
These are targets, not guarantees. Break them and investigate.

## Latency Targets (p95)

| Endpoint category | Target p95 | Notes |
|-------------------|------------|-------|
| /auth/me | < 200ms | Runs on every page mount |
| /health, /health/ready | < 100ms | Load balancer probes |
| List endpoints (paginated) | < 500ms | Attendance, grades, students, etc |
| Single-record fetches | < 300ms | Get by ID |
| Dashboard summary (Section 19) | < 800ms | Aggregated data |
| PDF generation (single) | < 3s | ID card, single challan |
| Bulk PDF (30 items) | < 30s | Background jobs preferred |
| Data export | ASYNC | Not an SLO — should be background job |
| Search endpoints | < 400ms | Debounced |

## Error Rate Targets

| Category | Target |
|----------|--------|
| 5xx errors | < 0.1% of requests |
| 4xx (excluding validation) | < 1% |
| Frontend crashes | < 0.01% of sessions |

## Critical Paths (High Blast Radius)

These paths affect many tenants when they fail:
1. Authentication (/auth/*)
   - Failure: nobody can log in
   - Monitor: 5xx rate on auth endpoints
2. BranchGuard resolution
   - Failure: entire portal fails for the branch
   - Monitor: cache hit rate, DB timeouts
3. Stripe / Subscription hooks
   - Failure: billing state gets out of sync
   - Monitor: webhook success rate
4. Data export
   - Failure: OOM crash affects everyone
   - Monitor: concurrent export count, memory
5. PDF pool health
   - Failure: all PDF-generating features break
   - Monitor: pool health check, semaphore wait times
6. Notification publish fan-out
   - Failure: notification storm or missed notifications
   - Monitor: batch size, error rate

## How to Measure (Today)

- p95/p99: sample from Nest logs or Supabase dashboard (no APM currently)
- Error rate: query error_log table (Section 10)
- Frontend crashes: query error_log where source='frontend'

## Alerting (Future)

When APM is added (may or may not happen):
- Alert on p95 exceeding target for 5 minutes
- Alert on 5xx rate > 0.5%
- Alert on frontend crash rate > 0.1%

Do NOT:
- Add actual monitoring in this section — that is separate
- Commit to SLOs you cannot measure — mark them 'aspirational' if so

After done:
- Update audit report marking M9, M10 as Fixed (docs level)
- Commit as: docs(scan-section-24): performance SLOs and critical paths
```

### Success Criteria
- [ ] SLO doc exists
- [ ] Latency and error rate targets documented
- [ ] Critical paths listed
- [ ] Measurement approach noted

### Manual Verification
Open the file, read it. If any number feels wrong for your infrastructure, edit it.

---

# PART H — ONGOING (No Deadline)

Do these opportunistically. Do NOT block on them.

---

## Section 25: Opportunistic Improvements (Everything Not Yet Fixed)

- [ ] Rolling — never marked complete
- **Fixes:** Phase 1 M3 (SELECT *), Phase 3 M1 (god services), M2 (god components), M6 (any), M5 residual (console)
- **Estimated:** Ongoing, per-touch
- **Depends on:** Sections 1–24 done first

### Context
These are large-surface debts. Attacking them in dedicated sprints is high-risk and low-reward. Instead, fix them when you're already in the code for another reason.

### Rules for Opportunistic Fixes

**When you touch a file for a real feature/fix:**
- Reduce `.select('*')` calls in that file to explicit columns
- Remove any `console.log` calls in that file
- Replace `any` types with proper types where it takes < 15 minutes
- If the file is a god service (> 800 lines) and you're adding a big feature, consider extracting your feature into a new file rather than growing the god

**When you have a slow afternoon and want to reduce debt:**
- Pick one god service from the audit list
- Extract PDF helpers + notification side-effects into their own service files
- Do NOT try to refactor the whole god service in one sitting — just extract 1–2 concerns
- Ship it, take a break

### Cursor Prompt (Use When Ready)

Use this prompt when you have a real reason to be in a target file:

```
Task: Apply opportunistic improvements to files I am already editing.

Rules:
1. Only touch files I list — do NOT go broad
2. For each listed file:
   - Replace .select('*') with explicit column lists that match what the caller actually uses
   - Remove any console.log/debug/info calls
   - Replace explicit any types with proper types where obvious (< 15 min per any)
3. Do NOT change any behavior — only types and column lists
4. If a change requires updating a downstream caller, STOP and flag it

Target files for this session:
- <list your files here>

After done:
- No audit doc updates needed — this is ongoing
- Commit as: chore(cleanup): opportunistic improvements in <file>
```

### Success Criteria
- [ ] Never — this section is always "in progress"
- [ ] After 6 months, the counters (SELECT *, any, console) should be measurably lower

### Long-Running Metrics to Track

Every 3 months, run:
```bash
grep -rn '\.select(.\*.)' backend/src/modules | wc -l  # SELECT * count
grep -rn ': any' backend/src frontend/src | wc -l    # any count
grep -rn 'console\.' backend/src/modules frontend/src/components frontend/src/app | wc -l  # console count
```

Log the numbers in `docs/audits/debt-trend.md`. The direction matters more than the absolute number.

---

# Progress Tracking

Update this table as you complete sections.

| Section | Fix Area | Status | Date | Notes |
|---------|----------|--------|------|-------|
| 1 | Branches controller isolation | ⬜ | | |
| 2 | Guardians IDOR | ⬜ | | |
| 3 | Email domain bypass | ⬜ | | |
| 4 | BranchGuard fallback + import token | ⬜ | | |
| 5 | Non-BranchGuard audit | ⬜ | | |
| 6 | Rate limiting | ⬜ | | |
| 7 | BranchGuard cache | ⬜ | | |
| 8 | Health check + Request IDs | ⬜ | | |
| 9 | Frontend noisy-op confirmations | ⬜ | | |
| 10 | Error log table + backend capture | ⬜ | | |
| 11 | Errors dashboard + FE reporting | ⬜ | | |
| 12 | Data export streaming + block | ⬜ | | |
| 13 | PDF pool service | ⬜ | | |
| 14 | Migrate Puppeteer sites | ⬜ | | |
| 15 | Notification batching | ⬜ | | |
| 16 | Theme polling + messages cleanup | ⬜ | | |
| 17 | Debounce searches | ⬜ | | |
| 18 | Tab-gated fetching | ⬜ | | |
| 19 | Dashboard aggregator + dynamic imports | ⬜ | | |
| 20 | Data layer batching (5 sub-fixes) | ⬜ | | |
| 21 | Index hygiene | ⬜ | | |
| 22 | RLS init plan | ⬜ | | |
| 23 | ESLint + CI checks | ⬜ | | |
| 24 | SLO documentation | ⬜ | | |
| 25 | Opportunistic (rolling) | 🔄 | | |

Status legend: ⬜ Not started · 🟨 In progress · ✅ Complete · 🔄 Rolling

---

# When You're Done With Sections 1–24

You will have addressed **every critical and major finding** from all three audit reports, plus prevention against regression.

Expected new scores after this work:
- Phase 1 (DB + Backend): 62 → 85+
- Phase 2 (FE + Multi-tenant): 51 → 80+
- Phase 3 (Smells + Monitoring): 44 → 75+ (higher requires external APM which you cannot install)

Re-run the audit (same prompts as before) in ~3 months to confirm. If scores match, ship confidence.

---

**End of scan_fix.md**