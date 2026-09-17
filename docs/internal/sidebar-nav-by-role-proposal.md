# Sidebar nav by role — hard-lock proposal

Critical follow-up to `sidebar-nav-by-role.md`. Goal: decide what must be **hard-denied by role** (not overridable from Settings → Permissions), and what else to fix.

**Audience split (product truth):**

| Audience | Roles |
| --- | --- |
| Staff | SA, P, AC, AA, CT, ST, GC |
| Family | Par, Stu |

Management tabs and personal (“My *”) tabs are different products. Matrix should refine **within** an audience, not cross it.

---

## Never show — hard deny (not matrix-configurable)

### Family (Par / Stu) must never see

These are staff operations. Granting them via the matrix is a privacy / ops leak.

| Tab | Why hard-deny |
| --- | --- |
| Student | Roster / enrolment ops — not a parent/student surface |
| User | Account admin |
| Class | Structure setup |
| Mapping | Teacher ↔ class / parent-link admin |
| Assessment | Staff markbook; family uses My Assessment / child views |
| Behavioral | Staff assessment workflow |
| Inventory | Stock / issuances admin (not “request uniform”) |
| ID Cards | Issue / print |
| Certificates | Issue / revoke (family uses **My Certificates**) |
| Event | Create / manage school events (family uses **My Event**) |
| Timetable | Build / edit timetable (family uses Child Timetable / My Timetable) |
| Conflict | Timetable conflict ops |
| Substitution | Cover assignment |
| Promotion & Placement | Year-end placement |
| Report Cards | Staff publish workflow (parents download from My Child) |
| Storage | Tenant file quota / admin |
| Settings | Branch / school config |
| Billing | Subscription / payment — SA only among staff too |

**Already hard-gated (keep):** My Child, PIN Management, Child Timetable, Request uniform → Par only. My Assessment, My Timetable → Stu only. My Schedule → CT/ST only. Billing → SA only. Storage → SA/P only.

### Parent-only tabs — never show to staff or student

| Tab | Never |
| --- | --- |
| My Child | Stu, all staff |
| PIN Management | Stu, all staff |
| Child Timetable | Stu, all staff |
| Request uniform | Stu, all staff |

### Student-only tabs — never show to parent or staff

| Tab | Never |
| --- | --- |
| My Assessment | Par, all staff |
| My Timetable | Par, all staff *(teachers use My Schedule)* |

### Staff-only personal tabs — never show to family

| Tab | Never |
| --- | --- |
| My Schedule | Par, Stu, non-teachers (P/AC/AA/GC/SA unless also teacher) |

### Privilege caps inside staff (still hard, not matrix)

| Tab | Hard rule |
| --- | --- |
| Billing | **SA only** — never P/AC/AA/teachers even if someone adds a matrix column |
| Storage | **SA + P only** — never AC/AA/teachers/family |
| Settings | Never Par/Stu; optionally never CT/ST/GC (today matrix can grant — recommend hard-deny teachers/GC) |
| User | Never Par/Stu/CT/ST/GC — keep configurable only among SA/P/AC/AA |

---

## Current leaks (matrix or seed can show the wrong audience today)

Fix these even before a full hard-deny layer:

1. **Par + Assessment** — seed gives assessment view; sidebar only hides Stu → parents can see staff Assessment.
2. **Par/Stu + Timetable** — seed gives `timetable_management` view → family can see Timetable management.
3. **Stu + Inventory** — seed gives inventory edit → students can see stock admin.
4. **Par + Report** — often fine for limited parent reports, but staff admin report packs should not be the same tab without scoping.
5. **Events / My Events** — Event is role-gated (good); My Event excludes GC/P/AA even when matrix says view (inconsistent).
6. **Conflict / Promotion** — matrix-only with almost no seed → only SA sees them, or a mis-click can grant Par/Stu if rows exist. Needs staff allowlist.

---

## Suggested hard-deny matrix (quick reference)

`✗` = never show, ignore Settings. `·` = may be matrix/plan gated among allowed roles.

| Tab | SA | P | AC | AA | CT | ST | GC | Par | Stu |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | · | · | · | · | · | · | · | · | · |
| Student | · | · | · | · | · | · | · | ✗ | ✗ |
| User | · | · | · | · | ✗ | ✗ | ✗ | ✗ | ✗ |
| Class | · | · | · | · | · | · | · | ✗ | ✗ |
| Mapping | · | · | · | · | · | · | · | ✗ | ✗ |
| My Child | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | · | ✗ |
| PIN Management | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | · | ✗ |
| Child Timetable | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | · | ✗ |
| Attendance | · | · | · | · | · | · | · | · | · |
| Assessment | · | · | · | · | · | · | · | ✗ | ✗ |
| My Assessment | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | · |
| Behavioral | · | · | · | · | · | · | · | ✗ | ✗ |
| Leave | · | · | · | · | · | · | · | · | · |
| Early Departure | · | · | · | · | · | · | · | · | · |
| Notification | · | · | · | · | · | · | · | · | · |
| Messages | · | · | · | · | · | · | · | · | · |
| Support | · | · | · | · | · | · | · | · | · |
| Library | · | · | · | · | · | · | · | · | · |
| Inventory | · | · | · | · | · | · | · | ✗ | ✗ |
| Request uniform | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | · | ✗ |
| Fees | · | · | · | · | ✗* | ✗* | ✗* | · | · |
| ID Cards | · | · | · | · | ✗ | ✗ | ✗ | ✗ | ✗ |
| Certificates | · | · | · | · | · | · | ✗ | ✗ | ✗ |
| My Certificates | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | · | · |
| My Event | ·† | ·† | ·† | ·† | · | · | ·† | · | · |
| Event | · | · | · | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| My Schedule | ✗ | ✗ | ✗ | ✗ | · | · | ✗ | ✗ | ✗ |
| My Timetable | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | · |
| Timetable | · | · | · | · | ✗ | ✗ | ✗ | ✗ | ✗ |
| Conflict | · | · | · | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Substitution | · | · | · | ✗ | · | · | ✗ | ✗ | ✗ |
| Promotion & Placement | · | · | · | · | ✗ | ✗ | ✗ | ✗ | ✗ |
| Report | · | · | · | · | · | · | · | · | · |
| Report Cards | · | · | · | · | · | · | · | ✗ | ✗ |
| Storage | · | · | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Settings | · | · | · | · | ✗ | ✗ | ✗ | ✗ | ✗ |
| Billing | · | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

\* Fees: teachers/GC currently open the page and see “no access” — hide nav instead.  
† My Event: allow any staff who is not using Event management, or keep CT/ST/Par/Stu only — pick one rule and enforce it.

---

## Other suggestions

1. **Enforce hard denies in one place** — e.g. `navHardDeny[role] = Set<path>` checked *before* `canView`, so Settings cannot override.
2. **Hide matrix columns that are audience-locked** — don’t offer Assessment / Timetable / Inventory / Users cells for Par/Stu rows (and don’t offer My Child for staff).
3. **Fix seeds** to match hard rules (especially student `my_assessments`, student `inventory`, parent `assessment`, family `timetable_management`).
4. **Paired tabs** — always ship management + personal as mutually exclusive audiences (Assessment ↔ My Assessment, Certificates ↔ My Certificates, Event ↔ My Event, Timetable ↔ My Timetable / Child Timetable / My Schedule).
5. **Fees** — no matrix column today; either add `fees` feature for staff admin vs family “my fees”, or hard-hide Fees for CT/ST/GC.
6. **Reports** — keep configurable for staff; for Par/Stu either hard-deny or a dedicated “family reports” subset so admin packs never appear.
7. **Support** — keep for everyone (no matrix); good as-is.
8. **Dual-role users** — if staff+parent is disallowed (user-guide), hard denies stay simple; if dual-role returns, apply union of allowed tabs carefully so parent tabs don’t unlock staff tools.

---

## Priority if implementing

1. Hard-deny family ↔ staff management pairs (biggest real leak).  
2. Cap Billing / Storage / Settings / Users.  
3. Align seeds + stop showing Fees to roles with no UI.  
4. Tighten Conflict / Promotion / Event allowlists.

---

## Implemented (family hard-deny)

- Shared rules: `frontend/src/lib/permission/familyHardDeny.ts`
- **Permission matrix**: Parent/Student staff cells disabled (locked None); save + API coerce to `none`
- **Sidebar**: family audience never sees staff hrefs even with legacy view/edit grants
- Backend mirror coerce in `roles.service.ts` `updatePermissions`

## Implemented (operational staff ↔ family hard-deny)

- **Operational staff** (AC, AA, CT, ST, GC): matrix cells for **My Assessments** locked; AC/AA/GC also locked for personal timetable/events features
- **School Admin** and **Principal** exempt from staff-side family matrix locks
- **Sidebar**: parent/student portal hrefs (My Child, PIN, Child Timetable, Request uniform, My Assessments, My Timetable, My Certificates) hidden from operational staff even with legacy grants
- Parent/student role gates unchanged; staff+parent users still see parent tabs when logged in as parent
