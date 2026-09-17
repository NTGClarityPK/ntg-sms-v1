# Sidebar tabs by role

Unique portal sidebar items from `Sidebar.tsx`, with **default effective visibility** (permission-matrix seed + hard role gates). Branch **Settings → Permissions** can change matrix-gated tabs **except** Parent/Student staff-only cells (locked to None; sidebar hard-hides those tabs even if a legacy grant exists — see `familyHardDeny.ts`).

**Roles:** SA = school_admin · P = principal · AC = academic_coordinator · AA = admin_assistant · CT = class_teacher · ST = subject_teacher · GC = guidance_counselor · Par = parent · Stu = student

SA has full matrix access. Tabs marked *role gate* ignore or override matrix for that check.

| Tab | Path | Who sees it (defaults) |
| --- | --- | --- |
| Dashboard | `/dashboard` | SA, P, AC, AA, CT, ST, GC, Par, Stu |
| Student | `/students` | SA, P, AC, AA, CT, ST, GC |
| User | `/users` | SA, P, AC, AA |
| Class | `/academic/class-sections` | SA, P, AC, AA, CT, ST, GC |
| Mapping | `/mapping` | SA, P, AC, AA, CT, ST, GC *(teacher_mapping or parent_associations)* |
| My Child | `/my-children` | Par *only* — **hidden from sidebar**; open from Dashboard |
| Report Cards (parent) | `/my-report-cards` | Par *only* |
| PIN Management | `/parent/pin-management` | Par *only* |
| Child Timetable | `/children-timetable` | Par *only* |
| Attendance | `/attendance` | SA, P, AC, AA, CT, ST, GC, Par, Stu |
| Assessment | `/assessments` | SA, P, AC, CT, ST, GC, Par *(hidden for Stu)* |
| My Assessment | `/my-assessments` | Stu *only* |
| Behavioral | `/behavioral` | SA, P, CT, ST, GC *role gate* |
| Leave | `/leaves` | SA, P, AC, AA, CT, ST, GC, Par, Stu |
| Early Departure | `/early-departure` | SA, P, AC, AA, CT, GC, Par, Stu *(ST none in seed)* |
| Notification | `/notifications` | SA, P, AC, AA, CT, ST, GC, Par, Stu |
| Messages | `/messages` | SA, P, AC, AA, CT, ST, GC, Par, Stu |
| Support | `/support` | All roles *(online only; no matrix)* |
| Library | `/library` | SA, P, AC, AA, CT, ST, GC, Par, Stu |
| Inventory | `/inventory` | SA, P, AC, AA, Stu *(CT/ST/GC/Par none in seed)* |
| Request uniform | `/uniform-request` | Par *only* |
| Fees | `/fees` | All roles *(plan feature; no matrix column)* |
| ID Cards | `/id-cards` | SA, P, AC, AA |
| Certificates | `/certificates` | SA, P, AC, AA, CT *(staff only)* |
| My Certificates | `/my-certificates` | Par, Stu |
| My Event | `/my-events` | Par, Stu, CT, ST *role gate* |
| Event | `/events` | SA, P, AC *role gate* |
| My Schedule | `/my-schedule` | CT, ST *only* |
| My Timetable | `/my-timetable` | Stu *only* |
| Timetable | `/timetable` | SA, P, AC *(+ anyone with timetable_management view)* |
| Conflict | `/conflict-management` | Matrix only *(typically SA until granted)* |
| Substitution | `/substitution` | SA, P, AC, CT, ST |
| Promotion & Placement | `/promotion-placement` | Matrix only *(typically SA until granted)* |
| Report | `/reports` | SA, P, AC, CT, ST, GC, Par, Stu *(AA none in seed)* |
| Report Cards | `/results` | SA, P, AC, AA, CT, ST, GC *(hidden for Par/Stu)* |
| Storage | `/admin/storage` | SA, P *only* |
| Settings | `/settings` | SA, P, AA *(view)* |
| Billing | `/billing` | SA *only* |

**Plan-locked (still listed, disabled if plan lacks module):** Fees, Behavioral, Library, Inventory, Request uniform.
