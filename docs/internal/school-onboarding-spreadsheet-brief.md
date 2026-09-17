# Alma School Onboarding — Spreadsheet Brief (for Claude)

**Audience:** Claude (or any spreadsheet generator) creating Excel workbooks that a school fills and returns for Alma setup.  
**School context:** One organisation with **4 branches**.  
**Date:** 2026-09-10 (updated same day with live Alma DB)  
**Product:** NTG Alma (school management)

---

## Important source notes

### Alma Supabase MCP (verified)

Connected via **Alma MCP** to project `https://hpqpdeysaoxtfouksvcw.supabase.co`. Live schema was inspected (`information_schema`, constraints, indexes, enums, `roles`, `system_settings` keys).

This brief combines:

1. **Primary:** Live Alma DB constraints / NOT NULL / uniqueness (MCP)  
2. **Primary:** Current backend DTOs, setup wizard, settings-import, bulk-import  
3. **Secondary:** In-app wizard/templates (shape only; may lag product)

### Critical multi-branch rule

| Scope | What |
|--------|------|
| **Tenant-wide** (once) | Organisation identity, **login domain**, academic year(s), leave quota (`leave_settings` is **per academic year**, not per branch), branding/`default_locale` |
| **Branch-scoped** (×4) | Subjects, classes, sections, levels, school days, timing templates, assessment types, grade templates, public holidays, role permissions, staff, students, class-sections, teacher mappings, timetable, fees, behavioural **framework** config |
| **Settings keys** | `system_settings` is a flat key/value store (no `branch_id` column); branch-specific flags use keys like `settings_initialized:{branchId}` |

**Do not assume** classes/subjects are shared across branches. Unique indexes are per branch, e.g. `(branch_id, name)` on subjects/classes/sections/levels/assessment_types.

Practical approach: configure Branch 1 fully → **Copy settings from other branch** for Branches 2–4 → overlay differences → import people/mappings per branch.

Every branch-scoped sheet **must** include a stable `branch_key` (e.g. `MAIN`, `NORTH`, `SOUTH`, `EAST`) matching the Branches sheet.

### Hard uniqueness rules (from live DB — put on Validation sheet)

| Rule | DB fact |
|------|---------|
| School domain | `tenants.domain` **NOT NULL**; unique on `lower(domain)`; must be a domain (no `@`, no spaces) |
| School / branch codes | `tenants.code` unique; `branches.code` unique (global) |
| One active academic year | Partial unique index: one `is_active=true` per `tenant_id` |
| Academic year name | Unique per `(tenant_id, name)`; `start_date < end_date` |
| Subject / class / section / level / assessment type names | Unique per `(branch_id, name)` |
| Subject codes | Unique per `(branch_id, code)` when code set |
| Class ↔ level | A class can belong to **only one** level (`level_classes.class_id` unique) |
| School days | Unique `(branch_id, day_of_week)`; day 0–6 |
| Class × section × year | Unique `(class_id, section_id, branch_id, academic_year_id)` |
| Student roll (`student_id`) | **Globally unique** text (`students_student_id_key`) — not merely per branch. Prefer blank (auto-roll) or org-wide unique codes |
| Google Classroom email | Unique per branch on `lower(google_account_email)` when set |
| Parent link | Unique `(parent_user_id, student_id)`; `priority` only `1` or `2`; unique `(student_id, priority)` when set |
| Teacher assignment | Unique `(subject_id, class_section_id, staff_id, academic_year_id)` |
| Leave quota | One row per `academic_year_id` (tenant year), default annual_quota **7** |

---

## How to package the Excel files

**Recommended: one workbook file with many sheets** (modules as tabs), not dozens of separate files.

Suggested file name: `Alma_School_Onboarding_<SchoolName>_v1.xlsx`

Optional split (only if the school prefers):

| File | Contents |
|------|----------|
| `01_Organisation_and_Structure.xlsx` | Tenant, branches, academic year, subjects→schedule→assessment settings |
| `02_Staff.xlsx` | Staff + roles + optional teacher assignments |
| `03_Students_and_Parents.xlsx` | Students + parent accounts/links |
| `04_Operations_Day2.xlsx` | Class-sections, class teachers, timetable, fees (optional) |

Claude should still keep **one sheet per module** even if split across files.

---

## Setup phases (what “complete and successful” means)

### Phase A — Organisation shell (required before anything else)

Created at product signup / ops registration:

- Tenant (`schoolName`, **required** `schoolDomain`, optional `schoolCode`)
- First branch
- First **active** academic year
- School admin user

Then add the other **3 branches**.

### Phase B — Branch initialised (settings complete)

A branch counts as initialised when **either**:

- Flag `settings_initialized:{branchId}` exists (settings bulk import), **or**
- All of the following exist for that branch (wizard / manual path):
  - Active academic year (tenant)
  - ≥1 subject, class, section, level
  - School days + ≥1 timing template
  - ≥1 assessment type + ≥1 grade template + leave settings (**leave quota is per academic year / tenant**, not per branch)  
  - Communication direction settings  
  - Behavioural assessment settings (`behavioral_assessment` and/or `branch_behavioral_config`)  
  - Role permissions for the branch

**Wizard hard rule:** at least **two** assessment types must be marked as **term examinations**.

### Phase C — Operationally open for term (required for real use)

Beyond Phase B:

1. Subject templates (which subjects apply to which classes/levels)
2. Class × section combinations for the active year (**Create All** / class-sections sheet)
3. Staff with roles + branch access
4. Students enrolled in class/section
5. Parent accounts linked (if parent portal)
6. Class teachers + teacher–subject–class-section mappings
7. Timetable (if using period grids / My Timetable)

### Phase D — Optional / plan-gated (not blocking day-1 portal)

Library categories, uniform inventory categories/sizes, fee templates & bank details, certificates, ID cards, Google Classroom mappings, result PDF styling, holidays/vacations (recommended soon for attendance accuracy).

---

## Dependency order (must respect when filling / importing)

1. Tenant + domain + first branch + school admin + active academic year  
2. Additional branches (×3)  
3. Per branch: Subjects → Classes → Sections → Levels (with class names)  
4. Per branch: School days → Timing templates + slots  
5. Per branch: Assessment types (≥2 term exams) → Grade templates + ranges → Leave quota  
6. Communication + Behaviour settings  
7. Subject templates + assign to classes/levels  
8. Class-sections (class × section × year)  
9. Staff / users  
10. Students (+ enrolments) → Parents / links  
11. Class teachers → Teacher assignments  
12. Timetable (optional bulk)  
13. Fees, holidays, library, inventory (optional)

---

## Workbook sheets — column specifications

Legend: **R** = required for that row to be usable. Empty optional cells are fine.

Date format everywhere: `YYYY-MM-DD`.  
Times: `HH:MM` 24-hour (e.g. `07:15`).  
Booleans: `yes` / `no` (also accept `true`/`false`/`1`/`0`).  
Gender: `male` / `female` (also `m`/`f`/`boy`/`girl` for students).  
Day of week: `0`=Sunday … `6`=Saturday (confirm with school calendar culture; Alma uses 0–6).

---

### Sheet `00_Instructions` (for the school — not imported)

Include:

- Purpose of the workbook and which sheets are mandatory vs optional  
- That login emails for staff/students are `username@<school_domain>`  
- That structure is **per branch** — fill rows for all 4 `branch_key` values  
- Allowed role names list  
- Sample filled rows for one branch  
- Contact for questions  

---

### Sheet `01_Tenant` (tenant-wide — **1 row**)

| Column | Req | Notes |
|--------|-----|--------|
| school_name | **R** | Organisation display name |
| school_code | | Globally unique; uppercase preferred; auto-generated if blank |
| school_domain | **R** | Valid domain e.g. `alnoor.edu` — **globally unique**; used for `username@domain` logins |
| email | | Organisation contact |
| phone | | |
| timezone | | DB default `Asia/Baghdad`; set real school TZ e.g. `Asia/Karachi` |
| fiscal_year_start | | |
| vat_number | | |
| default_locale | **R** (defaults) | DB: `en-GB` \| `en-US` \| `ar` (NOT NULL, default `en-GB`) |

---

### Sheet `02_Academic_Years` (tenant-wide)

| Column | Req | Notes |
|--------|-----|--------|
| name | **R** | e.g. `2025-2026` |
| start_date | **R** | |
| end_date | **R** | |
| set_active | **R** | Exactly one `yes` for the year they will go live on |

Usually **one** active year at signup; extra years optional.

---

### Sheet `03_Branches` (**4 rows**)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | Stable key used on all other sheets (`MAIN`, `CAMPUS2`, …) |
| name | **R** | Display name |
| name_ar | | Arabic name |
| code | | Globally unique branch code |
| address | | |
| phone | | |
| email | | |
| storage_quota_gb | | Default 100 if blank |
| is_active | | Default `yes` |
| copy_structure_from_branch_key | | Optional: e.g. Branches 2–4 say `MAIN` if structure is identical |

---

### Sheet `04_Subjects` (branch-scoped)

Aligns with settings-import `subjects`.

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| name | **R** | Localised display name for this row’s language |
| code | **R*** | e.g. `MATH`. *Required when providing more than one language for the same subject |
| lang_code | **R** | e.g. `EN`, `AR`, `en-GB`, `en-US`. One row per language; rows with the same `code` merge into one subject |

Example: two rows for Mathematics — `Mathematics | MATH | EN` and `رياضيات | MATH | AR`.

---

### Sheet `05_Classes` (branch-scoped)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| name | **R** | Internal name e.g. `Grade 1` |
| display_name | **R** | Shown in UI |
| sort_order | **R** | Integer |
| section_names | | Optional comma-separated section names from `06_Sections`. Product settings-import creates class × section combos for the active year when set |

---

### Sheet `06_Sections` (branch-scoped)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| name | **R** | e.g. `A`, `B` |
| sort_order | | |

---

### Sheet `07_Levels` (branch-scoped)

Levels group classes (Primary, Middle, …).

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| name | **R** | |
| name_ar | | |
| sort_order | | |
| class_names | **R** | Comma-separated **exact** class names from `05_Classes` for this branch. Each class may appear in **only one** level (`level_classes.class_id` is unique) |

---

### Sheet `08_Subject_Templates` (branch-scoped — strongly recommended before teacher mapping)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| name | **R** | e.g. `Primary Core` |
| description | | |
| subject_names | **R** | Comma-separated subject names (or codes) included in this template |
| assign_mode | **R** | `classes` or `levels` (not both) |
| assign_names | **R** | Comma-separated class names **or** level names |

---

### Sheet `09_School_Days` (branch-scoped)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| day_of_week | **R** | 0–6 |
| is_active | **R** | `yes`/`no` |

Provide **7 rows per branch** (all days) or only active days — Claude should document which convention is used; Alma stores per `(branch_id, day_of_week)`.

---

### Sheet `10_Timing_Templates` (branch-scoped)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| name | **R** | e.g. `KG–Grade 4` |
| start_time | **R** | School day start |
| end_time | **R** | School day end |
| period_duration_minutes | | Default **60** |

---

### Sheet `11_Timing_Slots` (branch-scoped — child of templates)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| template_name | **R** | Must match `10_Timing_Templates.name` |
| slot_name | **R** | e.g. `Period 1`, `Break`, `Assembly` |
| start_time | **R** | |
| end_time | **R** | |
| sort_order | **R** | |

---

### Sheet `12_Class_Timing` (optional / UI assign)

Wizard stores class→template assignments in UI but commit RPC currently **ignores** them. Still useful for ops to apply manually.

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| class_name | **R** | |
| template_name | **R** | |

---

### Sheet `13_Assessment_Types` (branch-scoped)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| name | **R** | Localised name for this row’s language |
| code | **R*** | Import grouping key for translations (not stored). *Required when providing more than one language for the same type |
| lang_code | **R** | e.g. `EN`, `AR` |
| sort_order | | |
| is_term_examination | **R** | `yes`/`no` — **at least 2 `yes` per branch** (wizard / ops workbook; product settings-import does not set this flag) |

---

### Sheet `14_Grade_Templates` (branch-scoped)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| template_name | **R** | e.g. `Primary Grades` |

---

### Sheet `15_Grade_Ranges` (branch-scoped)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| template_name | **R** | Parent template |
| letter | **R** | e.g. `A`, `B`, `F` — unique within template |
| min_percentage | **R** | |
| max_percentage | **R** | ≥ min |
| sort_order | | |

---

### Sheet `16_Class_Grade_Passing` (recommended — stored in `class_grade_assignments`)

DB: one template per class (`UNIQUE class_id`); `minimum_passing_grade` NOT NULL default **`D`**.

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| class_name | **R** | |
| template_name | **R** | |
| minimum_passing_grade | **R** | Letter from that template (default `D` if blank at apply) |

> Note: Setup wizard commit RPC historically ignored class grade assignments; ops may need to apply this sheet via UI/API after wizard. Still collect from school.

---

### Sheet `17_Leave_Quota` (**tenant / academic year — NOT per branch**)

DB: `leave_settings` unique on `academic_year_id` only; `annual_quota` NOT NULL default **7**, must be ≥ 0.

| Column | Req | Notes |
|--------|-----|--------|
| academic_year_name | **R** | Must match active year |
| annual_quota | **R** | Integer days per student per year e.g. `7` |

Do **not** ask for four different quotas per campus unless product later adds branch scope — today one quota serves the whole organisation for that year.

---

### Sheet `18_Communication` (typically one row; stored as system setting)

| Column | Req | Notes |
|--------|-----|--------|
| teacher_student | **R** | `teacher_only` or `both` |
| teacher_parent | **R** | `teacher_only` or `both` |
| allow_admin_assistant_broadcast | | `yes`/`no` default no |
| allow_principal_broadcast | | `yes`/`no` default no |

---

### Sheet `19_Behavior` (star-based — `system_settings.behavioral_assessment`)

Either one config row + attribute rows, or attributes on separate sheet.

**Config row columns:**

| Column | Req | Notes |
|--------|-----|--------|
| enabled | **R** | Default yes |
| mandatory | **R** | Default no |

**Attribute rows** (`19b_Behavior_Attributes` or same sheet):

| Column | Req | Notes |
|--------|-----|--------|
| attribute_name | **R** | Defaults if empty: Discipline, Respect & Courtesy, Class Engagement, Work Habits, Extracurriculars |

### Sheet `19c_Behavior_System` (per branch — live table `branch_behavioral_config`)

DB check: `active_system` ∈ `star_based` \| `framework_based`; unique one row per `branch_id`.

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| active_system | **R** | `star_based` (default) or `framework_based` |
| framework_preset_code | Cond. | Required if `framework_based` — ops maps to `framework_preset_id` |

If the school only uses classic stars, set all four branches to `star_based` and ignore framework columns.

---

### Sheet `20_Holidays` (branch-scoped — `public_holidays`)

DB: `name`, `start_date`, `end_date`, `academic_year_id` NOT NULL; optional `branch_id` / `tenant_id`.

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| name | **R** | |
| name_ar | | |
| start_date | **R** | |
| end_date | **R** | |
| academic_year_name | **R** | |

---

### Sheet `21_Vacations` (year-scoped — **no `branch_id` column** in live DB)

DB: `vacations` has `name`, `start_date`, `end_date` NOT NULL; `academic_year_id` nullable (still fill). **Not branch-scoped** — collect once per organisation/year.

| Column | Req | Notes |
|--------|-----|--------|
| name | **R** | |
| name_ar | | |
| start_date | **R** | |
| end_date | **R** | |
| academic_year_name | **R** | |

---

## People sheets (separate modules — high volume)

### Sheet `22_Staff` (**separate logical module — own sheet**)

Prefer invitation flow (school username + personal invitation email).

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | Primary branch; repeat row or use `23_Staff_Branches` for multi-campus staff |
| username | **R** | Local-part only → login `username@school_domain` |
| invitation_email | **R** | Where invite link is sent (personal email OK) |
| full_name | **R** | |
| role_names | **R** | Comma-separated from catalogue below |
| phone | | |
| address | | |
| date_of_birth | | |
| gender | | `male`/`female` |
| employee_id | | |
| department | | |
| join_date | | |
| is_active | | Default yes |

**Role catalogue (staff — do not use `parent` / `student` here):**

- `school_admin`
- `principal`
- `academic_coordinator`
- `admin_assistant`
- `class_teacher`
- `subject_teacher`
- `guidance_counselor`

Same person on multiple branches → either duplicate rows with different `branch_key` or use:

### Sheet `23_Staff_Branches` (optional)

| Column | Req | Notes |
|--------|-----|--------|
| username | **R** | |
| branch_key | **R** | |
| role_names | **R** | Roles in that branch |

---

### Sheet `24_Students` (**separate module — own sheet; largest volume**)

Aligned with current **bulk student import** plus `branch_key`.

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| username | **R** | Local-part `[a-z0-9._]+` only |
| first_name | **R** | |
| last_name | **R** | |
| gender | **R** | `male`/`female` |
| invitation_type | **R** | `parent` or `student` — who receives the setup invite |
| invitation_recipient_email | Cond. | **Required** when `invitation_type=parent`. Optional when `student` (blank → school email) |
| create_parent_account | | `yes`/`no` default no |
| parent_email | Cond. | **Required** if create_parent_account=yes |
| parent_name | | |
| parent_phone | | |
| parent_relationship | | `father` \| `mother` \| `guardian` |
| phone | | |
| date_of_birth | | `YYYY-MM-DD` |
| student_id | | Custom roll; blank → auto-generated. If set, must be **globally unique** in Alma (not only within branch) |
| class_name | Rec. | Must exist on that branch |
| section_name | Rec. | Must exist on that branch |
| subject_template_name | | Must be linked to class if set |
| address | | Profile field |
| blood_group | | |
| medical_notes | | |
| admission_date | | |
| google_account_email | | Optional; unique per branch when set |

**Prerequisites:** Branch structure + active year; class/section names must match.

---

### Sheet `25_Parent_Links` (when parents not fully created via student sheet)

Max **2** guardians per student.

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| parent_email | **R** | Parent portal email |
| parent_full_name | | If creating new parent |
| parent_phone | | |
| student_username | **R\*** | One of username / student_id |
| student_id | **R\*** | Custom roll if used |
| relationship | **R** | `father` \| `mother` \| `guardian` |
| is_primary | | |
| can_approve | | Default yes |
| priority | | `1` primary / `2` secondary only (DB check); unique per student when set |

\* At least one student identifier required.

---

## Day-2 operations sheets

### Sheet `26_Class_Sections` (required for operational open)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| academic_year_name | **R** | |
| class_name | **R** | |
| section_name | **R** | |
| capacity | | Default **30** |
| class_teacher_username | | Staff username |

Tip: schools often want **all** class × section combinations; Claude can add a checkbox instruction “Create all combinations of classes × sections for each branch”.

---

### Sheet `27_Teacher_Assignments` (required for teaching / assessments)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| teacher_username | **R** | |
| class_name | **R** | |
| section_name | **R** | |
| subject_name | **R** | Subject must be allowed by that class’s subject template |

---

### Sheet `28_Timetable` (optional bulk — no dedicated import module today; ops apply)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| academic_year_name | **R** | |
| class_name | **R** | |
| section_name | **R** | |
| day_of_week | **R** | 0–6 |
| start_time | **R** | |
| end_time | **R** | |
| `slot_type` | **R** | Enum `timetable_slot_type`: `class` \| `assembly` \| `break` \| `free` |
| subject_name | Cond. | For `class` slots |
| teacher_username | Cond. | For `class` slots |
| room | | |
| period_number | | |

---

### Sheet `29_Fee_Templates` (optional, plan-gated)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| name | **R** | |
| type | **R** | `Fee` \| `Discount` |
| scope | **R** | `Levels` \| `Class` \| `Class-Section` \| `Individual` |
| currency_code | | `PKR` \| `IQD` \| `SAR` \| `USD` |
| auto_apply | | |
| days_until_due | | 1–365 |

### Sheet `30_Fee_Metrics` (child of templates)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| template_name | **R** | |
| metric_name | **R** | |
| amount_type | **R** | `Absolute` \| `Percentage` |
| amount | **R** | ≥ 0.01 |

### Sheet `31_Fee_Assignments`

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| template_name | **R** | |
| scope_type | **R** | `Level` \| `Class` \| `Section` (DB check) |
| scope_name | **R** | Name matching structure sheets |

### Sheet `31b_Fee_Challan_Settings` (per branch — `fee_challan_settings`)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| bank_name | | |
| account_title | | |
| account_number | | |
| bank_branch_code | | |
| payment_instructions | | |
| footer_text | | |
| challan_template | | Default `Minimal` |

---

### Sheet `32_Library_Categories` (optional)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | (or tenant — confirm at apply time; settings-import is current-branch) |
| category_name | **R** | |

### Sheet `33_Inventory_Categories` / `34_Inventory_Sizes` (optional uniforms)

| Column | Req | Notes |
|--------|-----|--------|
| branch_key | **R** | |
| name | **R** | Category or size label |

---

## What must be separate vs one workbook

| Module | Recommendation |
|--------|----------------|
| Organisation + academic structure + schedule + assessment settings | Same workbook, sheets `01`–`21` |
| **Staff** | Same file, sheet `22` (and `23`) — treat as **separate module** for school teams (HR fills) |
| **Students** | Same file, sheet `24` — **separate module** (admissions fills); largest sheet |
| **Parents / links** | Sheet `25` — often filled with admissions; keep separate from staff |
| Teacher assignments / class teachers / timetable | Sheets `26`–`28` — academic coordinator |
| Fees / library / inventory | Optional sheets — finance / admin |

**Single spreadsheet file with different sheets per module is the preferred deliverable.**

---

## Existing in-product templates (secondary reference only)

### Settings onboarding template (`settings-onboarding-template.xlsx`)

Sheets today: `subjects`, `classes` (optional `section_names` — sections and class × section combos are derived from this), `levels`, `assessment_types` (with `is_term_examination`), `subject_templates` (optional), `school_days`, `timing_templates`, `timing_slots`, `grade_templates`, `grade_ranges`  
Optional legacy: `school_info`  
Language columns use `name` + `lang_code` (+ `code` to merge translations).  
**Limitation:** Applies to the **current branch only** — no `branch_key`. Missing communication settings, holidays/vacations, leave quota, library categories. Class × section rows require an active academic year.

### Student bulk import template

Columns match sheet `24_Students` (without `branch_key`). Invitation-based; creates auth users.

### Setup wizard (UI)

Steps: Academic year → Academic structure → Schedule → Assessment → Communication → Behaviour → Review.  
Commits via RPC `commit_setup_wizard`. Does **not** create staff/students/timetable/fees. Requires ≥2 term-examination assessment types.

**Do not** regenerate school-facing sheets solely from these templates — use the column lists in this brief.

---

## Suggested Claude deliverables

1. **Excel workbook** with all sheets above (freeze header row, data validation for enums, sample row per sheet, `branch_key` dropdown from Branches).  
2. **`README` sheet** explaining fill order and Phase B vs Phase C.  
3. **Colour coding:** Required columns = light red header; optional = grey; recommended = amber.  
4. **Four sample branch_keys** pre-filled on Branches; structure sheets include 2–3 example rows for `MAIN` only so the school copies patterns.  
5. **Validation notes** tab: include the **Hard uniqueness rules** table from this brief (domain, student_id global unique, one class→one level, ≥2 term exams, parent priority 1|2, leave quota once per year).

---

## Ops checklist after sheets return

- [ ] Register tenant + admin + year + branch 1 (or use existing)  
- [ ] Create branches 2–4  
- [ ] Import / enter structure for Branch 1 (wizard or settings-import + manual schedule/grades)  
- [ ] Copy settings to other branches; fix diffs from sheets  
- [ ] Subject templates + class-sections  
- [ ] Import staff → assign multi-branch  
- [ ] Import students → verify parent invites  
- [ ] Class teachers + teacher assignments  
- [ ] Timetable / fees / holidays as needed  
- [ ] Smoke-test: admin login per branch, student placement, parent link, one teacher mapping  

---

## Code reference index

| Area | Path |
|------|------|
| Registration | `backend/src/modules/registration/dto/register.dto.ts` |
| Branch create | `backend/src/modules/branches/dto/create-branch.dto.ts` |
| Wizard DTO | `backend/src/modules/setup-wizard/dto/commit-setup-wizard.dto.ts` |
| Wizard service | `backend/src/modules/setup-wizard/setup-wizard.service.ts` |
| Settings import | `backend/src/modules/settings-import/settings-import.service.ts` |
| Settings status / copy | `backend/src/modules/settings-status/settings-status.service.ts` |
| Bulk students | `backend/src/modules/bulk-import/dto/bulk-student-row.dto.ts` |
| Student invite | `backend/src/modules/students/dto/create-student-with-invitation.dto.ts` |
| Staff / users | `backend/src/modules/staff/dto/create-staff.dto.ts`, `users/dto/create-user.dto.ts` |
| Teacher map | `backend/src/modules/teacher-assignments/dto/create-teacher-assignment.dto.ts` |
| Class section | `backend/src/modules/class-sections/dto/create-class-section.dto.ts` |
| Fees | `backend/src/modules/fees/dto/create-fee-template.dto.ts` (and assignment DTOs) |
| Scope docs | `docs/internal/context/scope.md` |

---

## Appendix A — Live DB inventory (Alma MCP)

**Project:** `https://hpqpdeysaoxtfouksvcw.supabase.co`  
**Roles catalogue (`roles.name`):** `parent`, `student`, `principal`, `school_admin`, `academic_coordinator`, `class_teacher`, `subject_teacher`, `guidance_counselor`, `admin_assistant`

### Core onboarding tables (public)

`tenants`, `branches`, `academic_years`, `profiles`, `subjects`, `classes`, `sections`, `levels`, `level_classes`, `school_days`, `timing_templates`, `timing_template_slots`, `class_timing_assignments`, `assessment_types`, `grade_templates`, `grade_ranges`, `class_grade_assignments`, `leave_settings`, `system_settings`, `public_holidays`, `vacations`, `subject_templates`, `subject_template_subjects`, `class_subject_template_assignments`, `level_subject_template_assignments`, `class_sections`, `staff`, `students`, `student_enrolments`, `parent_students`, `invitations`, `user_branches`, `user_roles`, `role_permissions`, `teacher_assignments`, `timetable_slots`, `fee_templates`, `fee_template_metrics`, `fee_template_assignments`, `fee_challan_settings`, `branch_behavioral_config`, `behavioral_framework_presets`, `behavioral_framework_categories`, `result_report_settings`, …

### Enums relevant to sheets

| Enum | Values |
|------|--------|
| `user_role` | parent, student, principal, school_admin, academic_coordinator, class_teacher, subject_teacher, guidance_counselor, admin_assistant |
| `timetable_slot_type` | class, assembly, break, free |
| (check) invitation_type | student, parent, parent_account, staff |
| (check) relationship | father, mother, guardian |
| (check) gender | male, female |
| (check) student account_status | active, pending_verification, link_expired |
| (check) enrolment status | active, graduated, transferred_out, withdrawn, inactive |
| (check) fee type/scope | Fee\|Discount ; Levels\|Class\|Class-Section\|Individual |
| (check) fee amount_type | Absolute, Percentage |
| (check) currency_code | PKR, IQD, SAR, USD |
| (check) active_system | star_based, framework_based |
| (check) pdf_variant | minimal, modern |
| (check) default_locale | en-GB, en-US, ar |

### Known `system_settings` keys (examples in prod)

- `behavioral_assessment` — `{ enabled, mandatory, attributes[] }`  
- `communication_direction` — `{ teacher_student, teacher_parent }`  
- `library_categories`, `inventory_categories`, `inventory_sizes`  
- `settings_initialized:{branchId}`  
- `student_leave_request_class_ids:{branchId}`  
- `tenant_theme_primary_color:{tenantId}`  
- `guided_tours_auto_open_enabled`

### MCP note for future updates

Re-run column/constraint queries on Alma MCP before regenerating school packs if schema drifts. Do **not** use the restaurant (`user-supabase` / RMS) MCP for Alma.

---

## Prompt snippet to paste to Claude

```text
Using docs/internal/school-onboarding-spreadsheet-brief.md as the single source of truth,
create one Excel workbook (.xlsx) for a school with 4 branches.

Requirements:
- One sheet per module listed in the brief
- Include branch_key on every branch-scoped sheet (NOT on Leave_Quota or Vacations — those are year/tenant scoped)
- Mark required columns clearly; add data validation for enums from Appendix A
- Include Instructions + Validation notes sheets (copy Hard uniqueness rules)
- Add 1–2 sample rows for branch_key MAIN only
- Staff and Students must be separate sheets (high volume)
- Do not invent columns outside the brief; if unsure, add a comment column Notes
- Prefer British English labels in Instructions
- Honour DB facts: student_id globally unique if provided; one class in only one level; leave quota once per academic year
```

---

*End of brief.*
