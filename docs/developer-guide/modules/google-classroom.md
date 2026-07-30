# Google Classroom (Developer)

**Product:** NTG Alma
**Audience:** Developers / DevOps

User-facing steps live in the User Guide. This page covers implementation, environment variables, sync behaviour, and production OAuth.

## 3. Developer guide

### 3.1 Architecture overview

```
Frontend (Next.js)
  Settings → Integrations (toggle, OAuth, mappings, rubric presets)
  Assessments → Grade Entry (link, pull, read-only Google rubric, grade sheet)
  Assessments → Statistics (status / graded / read)
        │
        ▼
Backend (NestJS)  /api/v1/google-workspace/*  +  /api/v1/.../rubrics
        │
        ├── Google OAuth + encrypted token store
        ├── Google Classroom REST (courses, coursework, submissions, rubrics)
        ├── Grade pull (email match, upsert grades + rubric scores)
        └── Rubrics module (presets, assessment rubrics, scores)
        │
        ▼
Supabase PostgreSQL
```

**Rule:** Frontend never talks to Supabase for this feature (except normal auth). All Classroom and rubric data goes through Nest.

### 3.2 Environment variables

From `backend/.env.example`:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLASSROOM_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLASSROOM_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_CLASSROOM_REDIRECT_URI` | Must match an authorised redirect URI registered on the OAuth client **exactly** (scheme, host, port, path). Dev: `http://localhost:3001/api/v1/google-workspace/oauth-callback`. Register the production URI as a separate entry |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | 32+ character secret (or 64-char hex) for AES-256-GCM token encryption at rest |
| `FRONTEND_URL` | Used for OAuth success/error redirects to the Integrations page |

Also requires normal Supabase / Nest config. Tokens are **never** returned to the frontend.

### 3.3 OAuth scopes

```
https://www.googleapis.com/auth/classroom.courses.readonly
https://www.googleapis.com/auth/classroom.coursework.students.readonly
https://www.googleapis.com/auth/classroom.rosters.readonly
https://www.googleapis.com/auth/classroom.student-submissions.students.readonly
https://www.googleapis.com/auth/classroom.profile.emails
openid email profile
```

- `access_type=offline`, `prompt=consent` so a refresh token is issued.  
- `classroom.profile.emails` is required to match students by email.  
- Rubrics API uses `classroom.coursework.students.readonly` (not the submissions-only scope).

All five Classroom scopes are **sensitive** (not restricted), so the app needs Google verification but no CASA security assessment — see [§3.13.2](#3132-scope-classification--we-need-verification-not-a-security-assessment) before adding any scope.

If scopes change in code, users must **Disconnect and Connect again** — and the new scope must also be declared under **Data access** on the Google Auth Platform, or verified users will start seeing the unverified-app warning.

### 3.4 Backend modules & key files

| Area | Path |
|------|------|
| Module | `backend/src/modules/google-workspace/` |
| Controllers | `google-workspace.controller.ts`, `google-workspace-oauth.controller.ts` |
| Orchestration | `google-workspace.service.ts` |
| OAuth | `services/google-oauth.service.ts` |
| Classroom HTTP | `services/google-classroom-api.service.ts` |
| Pull grades | `services/grade-pull.service.ts` |
| Token crypto | `services/token-encryption.service.ts` |
| Rubric fingerprint | `utils/rubric-fingerprint.util.ts` |
| Rubrics | `backend/src/modules/rubrics/` |

Both modules are registered in `app.module.ts`. `GoogleWorkspaceModule` imports `RubricsModule`.

### 3.5 API reference

Base path: `/api/v1/google-workspace`  
Envelope: `{ data: T }` or `{ data, meta }` for paginated sync history.

#### Settings & connection (admin / principal)

| Method | Path | Body / notes |
|--------|------|--------------|
| GET | `/settings` | Creates settings row if missing |
| PUT | `/settings` | `{ isFeatureEnabled }` |
| POST | `/connect` | Returns `{ authorizationUrl }` |
| GET | `/oauth-callback` | **Public**; redirects to frontend |
| POST | `/disconnect` | Revokes tokens best-effort |
| POST | `/test-connection` | Lists courses; returns count + email |

#### Courses & mappings (admin / principal)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/courses` | Active Google courses |
| GET | `/mappings` | Active mappings + labels |
| POST | `/mappings` | Create mapping |
| POST | `/mappings/auto-suggest` | Similarity ≥ 0.55, max 50 |
| DELETE | `/mappings/:id` | Soft-deactivate (`is_active = false`) |

#### Assessment sync (feature edit permission)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/coursework/:googleCourseId` | List coursework |
| POST | `/assessments/:id/link` | `{ googleCourseworkId }` |
| DELETE | `/assessments/:id/link` | Back to manual grading source |
| POST | `/assessments/:id/pull-grades` | Manual grade sync |
| GET | `/assessments/:id/sync-status` | Link + last audit |
| GET | `/sync-history` | Paginated audit (`page`, `limit`, `assessmentId`) |

#### Rubrics (`/api/v1`)

| Method | Path |
|--------|------|
| GET/POST | `/rubrics/presets` |
| PUT | `/rubrics/presets/:id` |
| GET/POST/PUT/DELETE | `/assessments/:id/rubric` |
| GET | `/assessments/:id/rubric-scores` |
| PUT | `/student-grades/:id/rubric-scores` |

### 3.6 Database

Migrations (in order of relevance):

| Migration | Purpose |
|-----------|---------|
| `20260724120000_assessment_rubrics_foundation.sql` | Rubric tables, KTAC seed, feature |
| `20260724130000_google_classroom_integration.sql` | Google tables, assessment Google columns, feature |
| `20260727120000_student_google_account_email.sql` | `students.google_account_email` + unique per branch |
| `20260727130000_ktac_flexible_default_marks.sql` | Intended KTAC default mark updates |

#### Core tables

| Table | Role |
|-------|------|
| `google_workspace_settings` | One row per branch: toggle, connection, encrypted tokens, sync meta |
| `google_classroom_course_mappings` | Alma class_section + subject ↔ Google course |
| `google_sync_audit_log` | Pull outcomes (`started` / `success` / `partial` / `failed`) |
| `rubric_presets` / `rubric_preset_categories` | Global + branch presets |
| `assessment_rubrics` | 1:1 with assessment; `source` = `alma` \| `google_classroom` |
| `rubric_categories` | Categories; optional `google_criterion_id` |
| `student_rubric_scores` | Per-category scores; `source` = `manual` \| `google_classroom` |

#### Assessment columns

- `grading_source` (`manual` \| `google_classroom`)  
- `google_course_id`, `google_coursework_id`  
- `google_last_synced_at`  
- `has_rubric`

#### Student column

- `google_account_email` — preferred Classroom match; unique `(branch_id, lower(email))` when set

Feature codes: `google_classroom_integration`, `assessment_rubrics`.

### 3.7 Frontend map

| Path / area | Role |
|-------------|------|
| `/settings?section=integrations` | Main UI: toggle, connect, mappings, presets |
| `/settings/integrations/google-classroom` | Redirects to integrations |
| `/settings/rubrics` | Redirects to integrations |
| `/assessments/[id]/grades` | Link, Pull, sync badge, rubric UI, grade sheet |
| `/assessments/[id]/statistics` | Status / Graded / Read / Last updated |
| Student form | Optional Google Account Email |

Components:

- `frontend/src/components/features/google-classroom/*`  
- `frontend/src/components/features/rubrics/*`  
- `frontend/src/components/features/settings/IntegrationsTabContent.tsx`

Hooks / types:

- `hooks/api/useGoogleWorkspace.ts`, `useRubrics.ts`  
- `types/google-workspace.ts`, `types/rubrics.ts`  
- i18n namespaces: `googleClassroom`, `rubrics` (`en-GB`, `en-US`, `ar`)

**Present in API/hooks but little/no UI yet:** unlink assessment, sync history list.

### 3.8 Link assessment behaviour

1. Resolve active mapping for assessment’s `class_section_id` + `subject_id`.  
2. Verify coursework belongs to mapped Google course.  
3. Set `grading_source = google_classroom` and store Google IDs.  
4. Fetch rubric via Classroom rubrics API (`/rubrics` list or `/rubrics/{id}`).  
5. Compare **fingerprint** to Alma’s stored rubric.  
6. If different → `importGoogleRubric` (deletes existing Alma assessment rubric, inserts Google criteria with `google_criterion_id`).

### 3.9 Pull grades behaviour (optimised)

Google calls on a typical pull:

1. **Always:** get coursework + list student submissions (+ roster/profile emails as needed).  
2. **Conditionally:** get rubric **only if** Alma’s Google linkage looks missing/stale (`shouldFetchGoogleRubric`).  
3. Prefer **one** rubric call: get-by-id when `submission.rubricId` exists, else list.

Fingerprint:

```text
googleRubricId|sorted(criterionId:normalisedTitle:maxPoints)
```

- Same fingerprint → do **not** re-import rubric (avoid delete/recreate).  
- Different fingerprint → override Alma from Google, then sync scores.

Student match:

1. Build map from profiles.email.  
2. Override with `google_account_email`.  
3. Match submission emails (lowercased).

Grades:

- Upsert `student_grades` with `submission_status = submitted`, set `graded_at`.  
- Scale overall marks when Alma `total_marks` and Google `maxPoints` are both &gt; 0.  
- Upsert `student_rubric_scores` for categories with `google_criterion_id` when draft/assigned rubric grades exist.  
- If category scores were written, overall mark may be replaced by **sum of category scores**.  
- Write `google_sync_audit_log` and update assessment `google_last_synced_at`.

### 3.10 Alma rubrics vs Google rubrics

| Topic | Behaviour |
|-------|-----------|
| Alma preset attach | Allowed only when **not** Google-linked |
| Google-linked UI | Rubric builder **read-only** + synced hint |
| Import | `RubricsService.importGoogleRubric` — full replace |
| Assessment `total_marks` | **Not** overwritten by rubric import |
| Statistics `isGraded` | Driven by `student_grades.graded_at` (set on pull) |
| Statistics `isRead` | Independent portal engagement flag |

### 3.11 Access control notes

- Settings / connect / mappings: **school_admin** or **principal**.  
- Coursework / link / pull / sync-status / history: admin/principal **or** feature `edit` on `google_classroom_integration`.  
- There is **no** extra check that the caller is the assigned subject teacher for that assessment (any user with feature edit can pull).

### 3.12 Extending safely

When changing behaviour:

1. Prefer piggybacking on **Pull grades** rather than new polling jobs.  
2. Keep fingerprint skip so unchanged rubrics do not hit Google.  
3. Never log tokens or return encrypted token fields to the client.  
4. Add i18n keys to **all** locales (`en-GB`, `en-US`, `ar`).  
5. Use Mantine only on the frontend; British English in user-facing copy where the product standard applies.  
6. Keep API responses in `{ data }` / `{ data, meta }` shape.

### 3.13 Going to production — OAuth publishing, verification & quota

> Validated against Google's current documentation (July 2026): [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview), [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), [Restricted scopes](https://support.google.com/cloud/answer/13464325), [Classroom usage limits](https://developers.google.com/workspace/classroom/reference/limits), [Rubrics limitations](https://developers.google.com/workspace/classroom/rubrics/limitations).

#### 3.13.1 Publishing states and what each one costs us

Behaviour is determined by the combination of **publishing status**, **user type**, and **verification status** on the Google Auth Platform (formerly the OAuth consent screen):

| Publishing status | User type | Who can connect | Test-user allowlist required? | Practical impact on Alma |
|---|---|---|---|---|
| n/a | **Internal** | Only accounts inside the Workspace organisation that **owns the Cloud project** | No | No verification needed at all. Unusable for Alma's shared vendor-owned project, because schools are in *their* organisations, not ours. Only relevant to the optional BYO-project model (§3.13.5). |
| **Testing** | External | Only accounts explicitly added to the allowlist — **hard cap of 100** | **Yes** | Warning UI on consent. Organisation users are *not* exempt. **Refresh tokens expire after 7 days**, so every stored connection dies weekly (§3.13.3). Development only. |
| **Published** | External, **Unverified** | Any Google account, but a **hard cap of 100 users applies for the app's lifetime** | No | "Unverified app" danger screen; app name and logo hidden. Explicitly discouraged by Google and unacceptable for customers. |
| **Published** | External, **Verified** | Any Google account, no cap | No | **This is Alma's required production state.** Name, logo and scopes shown cleanly. |

**Key consequence for onboarding:** the test-user allowlist is a *Testing-state artefact only*. Once the app is Published + Verified, schools self-serve from Settings → Integrations, and nobody on the Alma team touches Google Cloud per customer. There is no per-school Google Cloud work in the production model.

#### 3.13.2 Scope classification — we need verification, not a security assessment

All five Classroom scopes in `CLASSROOM_SCOPES` (`google-oauth.service.ts`) are classified **sensitive**. Google's current **restricted** list covers only Gmail and Drive scopes, so:

| Requirement | Applies to Alma? |
|---|---|
| Basic app / brand verification | ✅ Yes |
| Sensitive-scope verification (justification + demo video) | ✅ Yes |
| CASA Tier 2/3 third-party security assessment | ❌ No |
| Annual re-verification (restricted-scope obligation) | ❌ No |

**Guard this carefully.** If we ever add `https://www.googleapis.com/auth/spreadsheets(.readonly)` — which the rubrics docs mention for importing rubrics exported to Sheets — or any Drive/Gmail scope, the classification and the review burden change. Adding a restricted scope would pull us into CASA plus annual re-verification. Treat any scope addition as a compliance decision, not just a code change.

#### 3.13.3 The 7-day refresh token trap (why Testing state breaks Alma)

Alma persists the refresh token (`google_workspace_settings.refresh_token_encrypted`) and mints access tokens on demand via `resolveAccessToken()` in both `google-workspace.service.ts` and `grade-pull.service.ts`.

Google expires refresh tokens after **7 days** for apps in the **Testing** publishing status. When that happens:

- `refreshAccessToken()` receives an `invalid_grant` error from Google's token endpoint.
- `postForm()` converts it into a `BadRequestException`, surfacing as *"Failed to refresh Google access token. Please reconnect Google Classroom."*
- The branch must Disconnect and Connect again — and will have to repeat this weekly.

There is deliberately **no** silent auto-reconnect: the user has to re-consent. Publishing and verifying the app removes the 7-day limit entirely. A Workspace administrator marking the app **Trusted** also overrides both the 7-day expiry and the 100-user cap for that organisation, which is a useful stopgap for a pilot school while verification is pending.

#### 3.13.4 Production go-live checklist

**Google Cloud / Auth Platform**

- [ ] Enable **Google Classroom API** on the production Cloud project.
- [ ] Auth Platform → **Branding**: production app name, logo, support email, homepage, privacy policy and terms URLs on a domain we own.
- [ ] **Verify domain ownership** in Search Console for every domain referenced above.
- [ ] Auth Platform → **Audience**: user type **External**, then **Publish app** (moves out of Testing).
- [ ] **Data access**: declare *exactly* the five Classroom scopes plus `openid`/`email`/`profile`. Undeclared scopes trigger the unverified warning even on an otherwise verified app.
- [ ] Register the production redirect URI **exactly** as `GOOGLE_CLASSROOM_REDIRECT_URI` (scheme, host, port, path, no trailing slash). Keep the localhost URI as a separate entry for development.
- [ ] Submit for verification with a written justification per scope and a **demo video** showing the consent flow and how each scope's data is used (mapping → link → pull → grade display). Allow several weeks.

**Alma backend**

- [ ] Production `GOOGLE_CLASSROOM_CLIENT_ID` / `CLIENT_SECRET` set in the secret store — not committed, and distinct from development credentials.
- [ ] `GOOGLE_TOKEN_ENCRYPTION_KEY` is a strong 32-byte value (64-char hex preferred) held only in the production secret store. **Rotating or losing this key invalidates every stored token** and forces all branches to reconnect; there is currently no key-versioning or re-encryption path.
- [ ] `FRONTEND_URL` points at the production frontend so OAuth callbacks redirect correctly.
- [ ] Confirm tokens are never logged and never serialised into API responses.

**Verification**

- [ ] End-to-end test on a real Workspace for Education domain (or a Google **demo domain**, which ships with a free permanent Education Fundamentals licence and can be upgraded to Education Plus for rubric testing).
- [ ] Confirm the connection survives past 7 days after publishing.

#### 3.13.5 Multi-tenant topology: one shared project (default)

Alma uses **one vendor-owned Cloud project for all tenants**. The tenant boundary is the encrypted per-branch token, not the Cloud project:

| Layer | Scope | Where it lives |
|---|---|---|
| OAuth client ID / secret / redirect URI | **Application-level**, shared by all tenants | Environment variables |
| Access & refresh tokens, connected email, granted scopes | **Per branch** | `google_workspace_settings`, AES-256-GCM encrypted at rest |
| Courses, coursework, rosters, grades | **Per branch**, reachable only via that branch's token | Never cross-tenant |

This is the correct arrangement. A shared client ID grants **no** cross-tenant data access, because every Classroom request is authorised by a specific school's token and Google scopes the response to what that account can see.

**Do not adopt a vendor-owned Cloud project per school.** Each project would need its own consent screen and its own verification submission, and until verified would impose a 100-user cap and warning screens — a verification queue per customer.

The only per-tenant topology worth supporting is **school-owned, opt-in**: the school creates the Cloud project inside its own Workspace organisation and sets the user type to **Internal**, which needs no verification and has no user cap. That would require storing an optional per-tenant encrypted `client_id`/`client_secret` with fallback to the shared environment credentials. Treat it as an enterprise feature for schools whose IT refuses to authorise third-party apps — not the default, and not a billing mechanism.

Related known gap: `google_workspace_settings` is `UNIQUE (branch_id)`, so a multi-branch school connects (and re-consents) once per branch. Making the connection tenant-level with per-branch overrides is the natural evolution, since one Google Cloud project and its quota can serve all branches of a school.

#### 3.13.6 Quota and cost

The Classroom API is **free**: no per-call charge, and no billing account is needed for standard usage. A billing account is only required to *submit a quota-increase request*. Quotas are enforced per Cloud project on a 60-second moving average:

| Limit | Default |
|---|---|
| Queries per day per project | 4,000,000 (~46 QPS average) |
| Queries per minute per project | 3,000 (50 QPS) |
| Queries per minute **per user** | 1,200 (20 QPS) |

Alma's cost per **Pull grades** is roughly four calls — get coursework, list submissions, list roster emails, and *conditionally* one rubric call (skipped by the fingerprint check in `shouldFetchGoogleRubric`). Against 4,000,000/day that is on the order of a million pulls per day, and pulls are manual and human-paced. **Shared quota across tenants is not a practical constraint**, which is another reason the shared-project model is fine.

Two related caveats:

- Google has announced that later in 2026, quota-increase requests for the **Gmail, Calendar and Drive** APIs will require billing to be enabled, with charges above standard daily thresholds. Classroom is not currently in that programme, but it indicates the direction of travel for Workspace APIs.
- Rubric **create/update/delete** via the API requires a **Google Workspace for Education Plus** licence on both the requesting user and the course owner. Alma is read-only today so this does not bite, but it is the only real Google cost in this feature area, and it is the school's Workspace licensing — not an API bill. `checkUserCapability` is the documented way to test eligibility before issuing such requests.

#### 3.13.7 Known gaps to address before heavy production load

- **No 429 / `RESOURCE_EXHAUSTED` handling.** `getJson()` in `google-classroom-api.service.ts` turns any non-OK response into a `BadRequestException`, so a quota error reaches the teacher as a generic failure. Google explicitly asks for truncated exponential backoff with jitter on `RESOURCE_EXHAUSTED`.
- **Unbounded concurrency in the email fallback.** `fetchStudentEmails` fires one `userProfiles` request per unresolved student via `Promise.all`, which is exactly the burst shape that trips the 1,200/minute per-user cap on large classes. A small concurrency limit would fix it.
- **OAuth `state` is not integrity-protected.** The state carries `branchId` and `userId` without an HMAC signature or verified nonce, so it is not tamper-evident. Signing and single-use-nonce validation should be added before public launch.
- **No encryption key versioning.** `GOOGLE_TOKEN_ENCRYPTION_KEY` cannot be rotated without invalidating every stored token.

---


## 4. Troubleshooting

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| Connect fails / no refresh token | Google omitted refresh token | Revoke Alma app access in Google Account → Connect again |
| Courses empty | Wrong Google account / feature off | Reconnect correct account; ensure feature enabled |
| Cannot link assessment | No mapping for class+subject | Create mapping for **active** academic year section |
| Pull: missing emails | Scope / reconnect | Ensure `classroom.profile.emails`; Disconnect + Connect |
| Pull: unmatched students | Email mismatch | Set **Google Account Email** on student |
| Overall mark OK, KTAC 0 | No criterion grades or Alma rubric not Google-linked | Grade by criterion in Classroom; Pull (triggers import if needed) |
| Rubric not updating after Classroom edit | Structure unchanged or pull skipped fetch | Change criteria in Classroom; Pull again; check fingerprint / criterion IDs in submissions |
| Statistics shows Not started but Graded | Expected | Graded comes from grades; Status/Read from portal engagement |
| 403 on Google APIs | Feature off or role lacks permission | Enable feature; check role_permissions |
| “Access blocked: this app is not verified” / danger screen | OAuth app not Published + Verified, or requesting an undeclared scope | Publish and verify the app; ensure every requested scope is declared under Data access ([§3.13.1](#3131-publishing-states-and-what-each-one-costs-us), [§3.13.2](#3132-scope-classification--we-need-verification-not-a-security-assessment)) |
| “Access blocked: authorisation error” for one school only, others fine | School’s Workspace administrator has blocked or limited the app | School admin allows/trusts Alma in Admin console → Security → API controls |
| Connection dies roughly every 7 days; “Please reconnect Google Classroom” | App is in Google’s **Testing** state, where refresh tokens expire after 7 days | Publish + verify the app; as a stopgap, ask the school admin to mark Alma **Trusted** ([§3.13.3](#3133-the-7-day-refresh-token-trap-why-testing-state-breaks-alma)) |
| Only the first ~100 accounts can connect | Testing-state test-user cap, or Published-but-Unverified lifetime cap | Complete verification — the cap does not exist for verified apps |
| `redirect_uri_mismatch` after deploying | Production redirect URI not registered, or differs by port / trailing slash | Register the exact `GOOGLE_CLASSROOM_REDIRECT_URI` value in the OAuth client |
| Every branch shows disconnected after a deployment | `GOOGLE_TOKEN_ENCRYPTION_KEY` changed, so stored tokens cannot be decrypted | Restore the original key; there is no re-encryption path, otherwise all branches must reconnect |
| HTTP 429 / `RESOURCE_EXHAUSTED` during pull | Quota burst (often the per-student profile fallback) | Retry after a pause; see the backoff gap in [§3.13.7](#3137-known-gaps-to-address-before-heavy-production-load) |

---


## 5. Limitations & design choices

1. **Read-only** — Alma never writes grades or rubrics back to Classroom.  
2. **Manual pull only** — no cron auto-sync (by design, to control API usage and teacher timing).  
3. **One Google connection per branch** — not per-teacher OAuth.  
4. **Google rubric is authoritative when linked** — Alma editing disabled to avoid drift.  
5. **Optimised rubric fetch** — skip Google rubrics API when Alma already matches submission hints; override only on fingerprint change.  
6. **Unlink / sync-history** — backend ready; UI may be incomplete.  
7. **No teacher-assignment gate** on link/pull beyond feature ACL.  
8. **Turning the feature off** hides/blocks Google APIs but does not delete mappings, tokens, or existing grades.  
9. **Auto-suggest** is heuristic (name similarity); always verify mappings.  
10. **One shared vendor Google Cloud project** for all tenants — isolation comes from per-branch encrypted tokens, not separate projects. Per-school Cloud projects are deliberately avoided because each would need its own Google verification ([§3.13.5](#3135-multi-tenant-topology-one-shared-project-default)).  
11. **Production requires a verified OAuth app.** In Google's Testing state the app is limited to 100 allowlisted test users and refresh tokens expire after 7 days, so schools cannot be onboarded until verification completes.  
12. **No quota backoff yet** — `RESOURCE_EXHAUSTED` surfaces as a generic pull failure ([§3.13.7](#3137-known-gaps-to-address-before-heavy-production-load)).  

---


## Appendix A — End-to-end sequence

```text
Admin: enable → connect OAuth → map class/subject → Google course
Staff: set student google_account_email
Teacher: create Alma assessment + Classroom assignment
Teacher: link Alma assessment → coursework
         └─ optional: import Google rubric into Alma
Teacher: grade in Classroom (overall + criteria)
Teacher: Pull grades in Alma
         ├─ match emails
         ├─ upsert student_grades (+ scale)
         ├─ maybe refresh Google rubric (fingerprint)
         └─ upsert student_rubric_scores
Teacher: review Grade Entry + Statistics (Graded column)
```

## Appendix B — Related repo paths

```text
backend/src/modules/google-workspace/
backend/src/modules/rubrics/
frontend/src/components/features/google-classroom/
frontend/src/components/features/rubrics/
frontend/src/components/features/settings/IntegrationsTabContent.tsx
frontend/src/app/(portal)/assessments/[id]/grades/page.tsx
frontend/src/app/(portal)/assessments/[id]/statistics/page.tsx
frontend/src/hooks/api/useGoogleWorkspace.ts
frontend/src/hooks/api/useRubrics.ts
supabase/migrations/20260724120000_assessment_rubrics_foundation.sql
supabase/migrations/20260724130000_google_classroom_integration.sql
supabase/migrations/20260727120000_student_google_account_email.sql
supabase/migrations/20260727130000_ktac_flexible_default_marks.sql
backend/.env.example
```

---

*This guide reflects the implemented behaviour as of the July 2026 Google Classroom + rubrics workstream. Update this file when scopes, endpoints, or sync rules change. Google's OAuth publishing, verification and quota policies in [§3.13](#313-going-to-production--oauth-publishing-verification--quota) were validated against Google's documentation in July 2026 and should be re-checked before each verification submission.*
