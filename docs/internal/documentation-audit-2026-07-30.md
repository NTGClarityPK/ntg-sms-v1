# Documentation audit — 30 July 2026

**Scope:** User-guide feature pages under `docs/user-guide/features/` validated against frontend routes, backend modules, and Supabase migrations.

**Method:** Six read-only code audits (July 2026). Findings bucketed as **WRONG** (contradicts code), **MISSING**, **STALE**, **THIN/STUB**.

**Use this file when:** Updating docs after the Resto-style restructure. Fix **WRONG** claims first, then new pages, then expand stubs.

**Not synced to GitBook** — internal team reference only.

---

## Executive summary

| Category | Count (approx.) | Action |
|----------|-----------------|--------|
| Pages with outright false claims | ~12 | Rewrite affected sections immediately |
| Stub pages (<50 lines, omit most behaviour) | 11 | Expand from code |
| Missing user-facing pages | 4 | Create new pages + SUMMARY |
| Pages mostly OK but thin | ~10 | Expand workflows, statuses, permissions |
| Orphan/dead routes — do not document as primary | 8+ | Note redirects only |

**Highest-risk pages:** `results.md`, `fee-management.md`, `offline-documents.md`, `staff.md`, `authentication-and-access.md`, `notifications.md`.

**Mostly accurate:** `data-export.md`, `google-classroom.md` (user half), `teacher-substitution.md` (needs precision fixes).

---

## Recommended fix order

1. **Falsehoods** — Results, Fees, Staff, Offline Documents, Auth, Notifications  
2. **Missing pages** — Dashboard, Profile, Mapping, Class Sections  
3. **Stubs** — Messages, Library, Storage, Billing, Certificates, ID Cards, Audit Trail, Admin Portal, Promotion, Behavioural, Rubrics, Reports  
4. **Expand** — Settings, User Roles, Leaves, Early Departure, Events, Inventory, Timetable, Attendance, Assessments, Students, Parent Associations  
5. **Cross-links** — Invitation setup (`/setup`), PIN Management, fee reports (`/reports/fees`), My-* views inside existing pages  

**Do not launch model-pinned subagents for rewrites** — edit pages directly against this report and cited code paths.

---

## Cross-cutting findings

### Navigation vs docs

- **Staff** → `/staff` redirects to **Users** (`/users`). Staff schedule is not the main staff workflow.
- **Parent Associations** → sidebar label **Mapping**; `/parent-associations` redirects to `/mapping?tab=parent-student`.
- **Attendance** → single tabbed page (`Mark`, `Child`, `History`); not separate menu destinations.
- **Settings** → two rows of tabs (6 categories, 13 sections); not a sidebar of sections. Exact labels in audit § Access & Settings.

### Permissions

- Matrix is **per branch** (`role_permissions.branch_id`). School Admin / Super Admin bypass and are absent from the matrix.
- Three levels: `none`, `view`, `edit` — not just view/edit.
- Sidebar visibility = permissions + hard-coded role checks + **plan features** (`hasFeeManagement`, `hasLibraryManagement`, etc.).

### Product bugs surfaced (fix in code, not docs)

1. Events list search box is unwired (UI only).
2. `OfflineDocumentsTab` is dead code; `/offline-documents` redirects to storage.
3. Parent can set own PIN on PIN Management but PIN login is **student roll number only**.
4. Plan gates for Fees/Library/Inventory in sidebar may not apply as declared (implementation detail in coverage audit).

### Routes — do not document as primary flows

| Route | Reality |
|-------|---------|
| `/select-child` | Legacy; child switch is header badge + `POST /api/v1/auth/switch-child` |
| `/student` | Orphaned; no nav link |
| `/theme-settings` | Duplicate of Settings → Theme; unlinked |
| `/settings/subject-templates`, `/communication`, `/behavior` | Duplicates of consolidated `/settings` |
| `/settings/certificates` | Redirect to Certificates → Settings tab |
| `/offline-documents` | Redirect to Admin → Storage → Cache |

---

## New pages to create

| Page | Path | Why |
|------|------|-----|
| Dashboard | `features/dashboard.md` | Role-specific overviews, role switcher, widgets |
| Profile & account | `features/profile-and-account.md` | Name, email, teaching assignments, branch read-only badge |
| Mapping | `features/mapping.md` | Parent–Student + Teacher–Class tabs (replace standalone Parent Associations nav story) |
| Class sections | `features/class-sections.md` | Class × section matrix, bulk create combinations |

Add emoji H1, nested under Features in `SUMMARY.md`, and row in `features/README.md` per `.cursor/rules/documentation.mdc`.

---

## Per-page findings (condensed)

### authentication-and-access.md

**WRONG:** PIN login is student roll-number only (not generic device PIN); branch picker only for school admins; child selection at login does not exist (use header child switcher); `/select-child` broken (wrong API path).

**MISSING:** Signup (5-step), invitation `/setup?token=`, password rules differ by flow (6 vs 8 chars), reset “associated email”, inactive account probe, super_admin → admin portal, PIN Management page, Google signup vs sign-in, branch switch in user menu (school admin only).

**STALE:** Mermaid “Select Child” node; PIN as peer login method.

---

### user-roles.md

**WRONG:** Role list missing **Admin Assistant**; “Guidance Counsellor” vs UI “Guidance Counselor”; implies only view/edit (missing **none**).

**MISSING:** Per-branch permissions; matrix tabs (Assign Access / Role Access View); Users screen filters, statuses (Pending Verification, Link Expired), resend invitation; username@domain staff login vs parent email; parent+staff role mix forbidden; plan gating on sidebar; Student+Assessment disabled cell; student leave class picker in Permissions tab.

---

### settings-and-configuration.md

**WRONG:** Section labels mismatch UI (e.g. Business Info not Business Information); “sidebar” layout; General section does not contain subjects/classes; Academic tab stacks Years + Academic + Assessment; Result reports gated by role not plan.

**MISSING:** First-run setup wizard, copy from branch, bulk settings import; 13 exact sections (see SettingsSectionNav); rollover; vacations; communication branch broadcast; data export password rules; public stats URL; fee settings detail; certificate branding lives on Certificates page.

**Reference — current Settings sections:**

| Category | Section id | Label |
|----------|------------|-------|
| School setup | business-information | Business Info |
| School setup | communication | Communication |
| School setup | general | General |
| Academic | academic-years | Academic |
| Academic | schedule | Schedule |
| Academic | result-reports | Result reports |
| Operations | inventory-management | Inventory |
| Operations | integrations | Integrations |
| Operations | data-export | Data export |
| Finance | fees | Fee settings |
| Appearance | theme-settings | Theme |
| Appearance | public-statistics | Stats |
| Access control | permissions | Permissions |

---

### students.md

**WRONG:** No student detail page (modal on list); bulk import not “where enabled” — permission/route gaps; “view details” stale.

**MISSING:** Filters, sort, pagination, statuses (incl. link expired), emergency contacts, re-invitation, bulk import validation/rules, enrolment statuses, default role permissions.

---

### staff.md

**WRONG:** Staff list gone (redirect to Users); Staff → Schedule workflow wrong; schedule page shows assignments not day/time timetable.

**MISSING:** Users as staff admin; Mapping tab for teacher–class; My Schedule for weekly slots.

**STALE:** Entire Staff List section.

---

### parent-associations.md

**WRONG:** One parent+one student per create; edit only changes `canApprove`; My Children does not select global child context.

**MISSING:** Mapping location; two-guardian limit; priority primary/secondary; filters; API allows parent approver but UI does not.

---

### attendance.md

**WRONG:** No Overview tab; Child tab parent-only (not student); My Children pre-select not required.

**MISSING:** Statuses Present/Absent/Late/Excused (Excused not in mark UI); entry/exit times, bulk times, Excel export; absent→auto leave; teacher class scope rules.

---

### assessments.md

**WRONG:** No assessment detail route; **My Assessments is student/parent-facing**, not teacher; creation fields incomplete.

**MISSING:** Examination Schedule tab + PDF; filters; three creation modes; grades rubrics/Google Classroom; statistics statuses; delete; Assessment Settings cross-link.

---

### fee-management.md

**WRONG:** No “Mark as Paid” — flow is proof upload → Review → Verify/Reject; challan statuses wrong; payment history filters wrong; export is XLSX not CSV; sibling auto-discount oversimplified.

**MISSING:** Parent My Fees tab; admin payment workflow; challan lifecycle (Under review, Rejected, Cancelled); Reports → Fees; plan gate `hasFeeManagement`.

**STALE:** Bulk ZIP “coming soon”.

---

### billing.md (stub)

**WRONG:** Billing is school_admin only; certificates not plan-gated.

**MISSING:** Plans Free/Starter/Pro/Enterprise, Stripe checkout, usage card, invoice Pay Now.

---

### certificates.md, id-cards.md, audit-trail.md, admin-portal.md (stubs)

**Certs:** Settings on Certificates page not Settings nav; 7 types, issue wizard, My Certificates.

**ID cards:** Generate/Students/Staff tabs; statuses draft→issued; ZIP bulk; detail photo/reprint.

**Audit trail:** **super_admin only** at `/adminportal/audit-trail`, not school admin.

**Admin portal:** Tenants UI has no default locale; Payment Model = subscription override; audit not in school portal.

---

### data-export.md

**Mostly accurate.** Add excluded tables note, failure rate limit, Settings path Operations → Data export.

---

### google-classroom.md (user half)

**Mostly accurate.** Note: no Unlink button in UI today; keep OAuth/quota in developer guide.

---

### results.md — CRITICAL

**WRONG (major):** Email/SMS send to parents **not implemented**; comment templates/subject remarks invented; bulk publish/send invented; keyboard shortcuts invented; revised reports invented; publish “lock” overstated; dashboard metrics wrong; PDF page counts wrong; Interim term phase omitted; conduct/ABS/N/A claims not in code.

**MISSING:** Exact report kinds/phases; marks readiness; progress sequencing; parent access via My Children; bulk ZIP max 60; `approved` status in backend.

**Action:** Treat as rewrite from `frontend/src/app/(portal)/results` + `backend/src/modules/results`, not incremental edit.

---

### reports.md

**WRONG:** Public statistics not “no login” — password + token.

**MISSING:** Tabs Student/Class/Public/Administrative/Revenue; export sections; revenue scope; `/reports/fees` defaulters.

---

### timetable-and-schedule.md, teacher-substitution.md, behavioural.md, promotion-and-placement.md, rubrics.md

**Timetable:** Children timetable has own child selector; My Timetable = student; missing generate/copy/conflicts/schedule settings.

**Substitution:** Permission for SUB badges; load thresholds >8 vs >10; `completed` status not auto-applied.

**Behavioural:** “Overview” stale — matrix 1–5 stars; Pending tab; settings mandatory toggle.

**Promotion:** “Retain” → **Repeated**; no confirm step — Save is immediate; six outcomes.

**Rubrics:** Presets under Settings → Integrations accordion; branch override on edit; expand student row after base grade.

---

### leaves.md, early-departure.md, events.md, notifications.md, messages.md, library.md, inventory-uniforms.md, offline-documents.md, storage.md

**Leaves:** `absent` status from attendance; students can raise if class enabled; no attachments in UI; quota = school days not calendar.

**Early departure:** Staff **authorise** flow → `excused`; time dropdown from class template; conflict check advisory.

**Events:** Parent consent workflow is core; search box broken; delete exists.

**Notifications:** Two tabs All/Settings not Unread/Read/Attendance; push + realtime + deep links; not branch-scoped.

**Messages (stub):** Full realtime chat, broadcast scopes, read receipts — rewrite entirely.

**Library (stub):** Upload PDF/DOC/TXT; plan `hasLibraryManagement`; no offline save; no detail page.

**Inventory:** Status machine pending→approved→issued; stock at issue; direct issue; uniform-request parent tab.

**Offline documents:** **Entire page stale** — redirect/dead code; fold into storage.md Cache tab.

**Storage (stub):** Five tabs Overview/Breakdown/Largest files/Alerts/Cache; quota enforcement on upload.

---

## Coverage map (sidebar → doc)

See full sidebar structure in coverage audit transcript (`d44cfc31`). Docs should mirror **Sidebar.tsx** groups: Dashboard, Students & Attendance, Academics, Communication, Management (Setup, Resources, System).

Undocumented sidebar items: **Dashboard**, **PIN Management** (expand auth), **Class** (new page), **Mapping** (new page), **Profile** (user menu — new page).

---

## Agent instructions for doc updates

When fixing a page:

1. Read this section + open cited frontend page and backend controller/service.
2. Document **who** (role + permission + plan), **where** (exact nav label), **statuses/enums**, **steps** users actually see.
3. British English, product name **NTG Alma**, emoji H1 + SUMMARY + features README.
4. Do not document dead routes as primary paths.
5. If code and desired UX disagree, note “product bug” in this file or a GitHub issue — do not document wishful behaviour (especially Results email/SMS).

---

## Source transcripts

Full per-page evidence (file paths, line numbers) lives in Cursor agent subagent transcripts for conversation `ff671e5a-28e4-4d39-a93a-8f850edb1ae9`:

| Audit | Subagent id | Pages |
|-------|-------------|-------|
| People & academic | `a2878b6b-68e8-4901-8bb1-092c2bc42b90` | students, staff, parent-associations, attendance, assessments |
| Finance & documents | `954d1f25-4b3e-44cd-a850-77e005314617` | fees, billing, certs, id-cards, data-export, audit, admin, classroom |
| Coverage gaps | `d44cfc31-31be-4b3b-9e75-5d02b375f20d` | all routes, sidebar, missing pages |
| Timetable & results | `e132f7ec-726e-47a2-b2b2-f9d30ebaf73d` | timetable, substitution, behavioural, promotion, results, reports, rubrics |
| Requests & comms | `62441cff-ea29-4c5d-87d2-6d5975f53f7e` | leaves, early-departure, events, notifications, messages, library, inventory, offline, storage |
| Access & settings | `bfb14e3b-c54c-4589-98fd-0661a667e001` | authentication, user-roles, settings |

---

*Generated from completed read-only audits. No user-guide files were modified during the audit.*
