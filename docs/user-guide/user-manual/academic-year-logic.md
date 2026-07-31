# 📅 Academic Year Logic

## Purpose

Schools need a clean “year end” process:

- The **old academic year becomes read-only** (no further changes).
- A **new academic year becomes the active working year** (fresh start).
- The school can **choose what to carry forward** (so they don’t rebuild everything manually).
- Historical data remains available for reporting, but **does not mix** into the new year’s daily operations.

This document describes the **business logic and user journey** for that process.

---

## Key Concepts (Plain Language)

### Active Academic Year

The **active academic year** is the year the school is currently working in.

- Daily screens (timetable, attendance, assessments, results, events, leave) default to the **active year**.

### Locked Academic Year

The **locked academic year** is finished and becomes **read-only**.

- Staff can still **view** it (reports/history), but cannot **edit** records in that year.
- Locking is intended to be **final**. There is no unlock tool in the portal — if a year was locked in error, contact NTG Alma support.

### Fresh Start (New Year)

When a new academic year is activated, the school should experience a **fresh operational start**:

- New year starts with **no attendance, no leave requests, no assessments/grades, no events** by default.
- The school may **carry forward** structural setup (classes/sections/teachers/templates/timetables) via a wizard.

---

## Data model (student placement)

Three tables work together. **Do not treat `students.class_id` as the only source of truth.**

| Table | One row means | Used for |
|--------|----------------|----------|
| **`students`** | The **person** (name, roll number, login) | Identity; **`class_id` / `section_id` / `academic_year_id`** are a **mirror of the active year’s enrolment** for day-to-day screens |
| **`student_enrolments`** | **This student, this branch, this academic year** → class, section, status (`active`, `graduated`, …) | **Source of truth** for rosters, class filters, and year-scoped placement |
| **`student_promotion_decisions`** | **End-of-year decision** for closing year X → outcome + target class/section | Checklist before lock; drives enrolments on **save**, **lock**, and **new year** |

**Writes:** all `student_enrolments` upserts go through **`StudentPlacementService`** (backend), which keeps the `students` mirror in sync when the year is active.

**Reads:** class-section lists and filters should use **`student_enrolments`** for the selected/active year (with the `students` mirror as fallback only if enrolment is missing).

**Attendance / results / behaviour** for a past year stay on those records’ own `academic_year_id` (and often `class_section_id` at time of entry). They are **not** moved when a student is promoted.

---

## School User Journey (After Implementation)

### 1) Staff/teachers complete Promotion (end-of-year requirement)

From **Sidebar → Promotion**, staff record each student’s outcome:

- **Promoted**: choose (or accept the auto-filled) **Target class** (next class by sort order) and **Target section** (same section).
- **Repeated**: system keeps the student in the same class/section (not editable).
- **Graduated / Transferred out / Withdrawn / Inactive**: student leaves the active roster.

Important behaviour (**two steps — not “only on lock”**):

- **When staff click Save on Promotion:** closing-year **`student_enrolments`** are aligned with **all** saved decisions for that year (promoted/repeated → target class/section; graduated/left → matching status). Staff should see the new class/section straight away on **Students** and class rosters for **that same year**.
- **When the year is locked:** the system runs the same alignment **once more** on the closing year (so locked-year enrolment rows cannot drift from decisions), then applies decisions into **`student_enrolments` for the newly active year**. Outcomes such as graduated / left do not carry a class in the new year.

### 2) Admin locks the academic year

From **Settings → Academic Years** (tab inside `/settings`), the admin clicks **Lock** on the active year.

Lock rules:

- Lock is **blocked** if Promotion is incomplete (missing decisions for active students).
- Lock is **blocked** if there is **no other academic year available** to move into. The user must create the next year first.

After a successful lock:

- The locked year becomes **read-only**.
- The system automatically **activates the next available inactive academic year** (unlocked).
- The system **copies Promotion & Placement into enrolments for that newly active year** (so students are not left without class/section on the new year).

### 3) New year starts (active, clean operational data)

Once the new year is active:

- Operational modules show **fresh** data by default (attendance, leave requests, early departures, etc.).
- Student placement is taken from **year enrolment** (placement per academic year), not from legacy “student record”.

### 4) Optional: Copy setup from a locked year into the active year (Rollover)

If the school wants to reuse setup, the admin can run **Rollover** from the active year:

- Click **Rollover** on the active academic year.
- Choose **Source academic year (locked)** to copy from.
- Select what to copy (recommended):
  - leave settings
  - optional: teacher assignments, timetable slots

Notes:

- The rollover wizard **does not offer “Copy class sections”** (classes/sections are treated as global structure; copying class-sections is not part of this flow).
- The source year remains locked; the target year stays active/unlocked.

**One rollover per target year (enforced):**

- For each **branch**, rollover may be run **only once** per **target** (active) academic year. After it completes successfully, the system stores a record so it cannot be repeated by mistake.
- On the **Academic year** card for that target year, the **Rollover** button is **disabled**.
- A short **“Rollover complete”** note appears under the card with concise bullet points, for example: which **locked source** year was used, whether **leave settings** were copied, and counts for **teacher assignments** / **timetable slots** (matching what was selected in the wizard).
- If someone tries rollover again for the same target year (e.g. via API), the system returns an error explaining that rollover was already completed for that year.

### 5) Viewing history

- Staff can view historical data in the locked year via reporting/history filters where provided.
- Operational screens default to the active year to avoid mixing years.

---

## What is Copied vs What Starts Fresh

### Carry-Forward (Optional Setup Copy)

These are “setup/scaffolding” items that schools commonly want to reuse.

- **Class Teachers & Teacher Subject Assignments (recommended: OPTIONAL)**  
  Copies teacher-to-class/subject mapping if the school wants continuity; can be changed any time in the new year.

- **Subject Templates & Template Rules (recommended: ON if templates are used)**  
  Copies:
  - subject template definitions (the groups/tracks)
  - which classes/levels are allowed to use which templates

- **Student Subject Template Assignments (recommended: OPTIONAL)**  
  Copies “which student belongs to which template group” (only if those groupings remain stable year-to-year).

- **Timetable (recommended: OPTIONAL)**  
  Copies timetable slots into the new year (useful if the timetable is mostly unchanged).  
  If not copied, timetable starts empty and is built for the new year.

- **Policy Settings like leave quota (recommended: ON)**  
  Copies year-specific policy values that the school typically reuses.

### Starts Fresh (Not Copied)

These are operational records that should reset each year:

- Attendance records
- Leave requests
- Assessments and grades/results
- Behaviour records
- Events
- Messages/communications history

These remain accessible in the old year for reporting/history, but **do not appear** in the new year.

---

## Accounts & Access (Important)

### Staff/Parents/Students login accounts

User accounts **do not get duplicated** per year.

- People keep the same login.
- Permissions and branch access stay the same.

### Students across years (enrolment)

A student remains the same person across years.
Each year has its own “enrolment” record (class/section for that year, and optional template grouping).

This ensures:

- The new year can be a clean start
- Past years remain accurate and viewable
- Promoting/reassigning students in the new year doesn’t damage historical records

Important:

- Operational screens and class rosters should use **enrolment for the active year** to determine a student’s current class/section.
- The **`students`** row keeps a **mirror** of the active year’s active enrolment (`class_id`, `section_id`, `academic_year_id`) so older screens and filters stay aligned.
- All enrolment writes go through **`StudentPlacementService`**, which:
  - upserts **`student_enrolments`**
  - mirrors to **`students`** when the row’s year is the branch **active** year (or when locking assigns the new active year)
  - on **Promotion save** and **Lock**, aligns **closing-year** enrolments with **`student_promotion_decisions`** so locked-year placement cannot disagree with promotion (e.g. decision “Class II” but enrolment still “Class I”).

See **Worked example: Lock** above for row-by-row behaviour.

---

## Worked example: Lock (user journey + database rows)

**School:** Credo School · **Main Branch**  
**Closing year:** 2026–2027 (currently **active**)  
**Next year:** 2028–2029 (exists, inactive)  
**Class section:** Class I · C → after promotion, target **Class II · C**

**Pupils in the example:** Ali Hassan (roll 0031) and Nameer Ali Khan (roll 0045) — both in Class I · C during the year.

### Step 0 — Before promotion (active year 2026–2027)

**`academic_years`**

| name | is_active | is_locked |
|------|-----------|-----------|
| 2026–2027 | yes | no |
| 2028–2029 | no | no |

**`student_enrolments`** (placement for **2026–2027**)

| student | academic_year | class | section | status |
|---------|---------------|-------|---------|--------|
| Ali Hassan | 2026–2027 | Class I | C | active |
| Nameer Ali Khan | 2026–2027 | Class I | C | active |

**`students`** (mirror — same as enrolment while this year is active)

| student | academic_year | class | section |
|---------|---------------|-------|---------|
| Ali Hassan | 2026–2027 | Class I | C |
| Nameer Ali Khan | 2026–2027 | Class I | C |

**`student_promotion_decisions`:** *(empty)*

---

### Step 1 — Staff complete Promotion (Sidebar → Promotion → Save)

Admin promotes both to **Class II · C** for the closing year.

**`student_promotion_decisions`** (one row per student per closing year)

| student | source_year | outcome | target_class | target_section |
|---------|-------------|---------|--------------|----------------|
| Ali Hassan | 2026–2027 | promoted | Class II | C |
| Nameer Ali Khan | 2026–2027 | promoted | Class II | C |

**`student_enrolments`** for **2026–2027** is **updated** to match decisions (end-of-year placement on the closing year):

| student | academic_year | class | section | status |
|---------|---------------|-------|---------|--------|
| Ali Hassan | 2026–2027 | Class II | C | active |
| Nameer Ali Khan | 2026–2027 | Class II | C | active |

**`students`** mirror (still active year 2026–2027):

| student | academic_year | class | section |
|---------|---------------|-------|---------|
| Ali Hassan | 2026–2027 | Class II | C |
| Nameer Ali Khan | 2026–2027 | Class II | C |

*Operational history (e.g. attendance marked in September in Class I) is unchanged — it still points at the old class section for that date.*

---

### Step 2 — Admin clicks Lock on 2026–2027

**Gate:** every active student in 2026–2027 must have a promotion decision; another year (2028–2029) must exist.

**Before** setting `is_locked`, the system **re-applies** promotion decisions onto **2026–2027** enrolments (safety net so locked rows cannot drift).

Then:

1. **2026–2027** → `is_active = no`, `is_locked = yes`  
2. **2028–2029** → `is_active = yes`, `is_locked = no`  
3. **New enrolment rows** for **2028–2029** are created from promotion decisions  
4. **`students`** mirror is updated for the **new** active year

**`academic_years` (after lock)**

| name | is_active | is_locked |
|------|-----------|-----------|
| 2026–2027 | no | **yes** |
| 2028–2029 | **yes** | no |

**`student_enrolments`** (two rows per promoted student)

| student | academic_year | class | section | status |
|---------|---------------|-------|---------|--------|
| Ali Hassan | 2026–2027 | Class II | C | active |
| Ali Hassan | **2028–2029** | Class II | C | active |
| Nameer Ali Khan | 2026–2027 | Class II | C | active |
| Nameer Ali Khan | **2028–2029** | Class II | C | active |

**`students`** (mirror = **active** year only)

| student | academic_year | class | section |
|---------|---------------|-------|---------|
| Ali Hassan | **2028–2029** | Class II | C |
| Nameer Ali Khan | **2028–2029** | Class II | C |

**`student_promotion_decisions`:** unchanged (still the audit of what was decided for 2026–2027).

---

### Step 3 — What staff see day-to-day (after lock)

| Screen | Year used | Class II · C roster |
|--------|-----------|---------------------|
| Attendance, Behaviour matrix, Students filter | **Active 2028–2029** | Ali, Nameer, and other promoted pupils in II · C |
| Reports filtered to **2026–2027** | Locked year | Enrolment shows **II · C**; attendance lines may still show **Class I** where marked earlier |

Trying to **edit** 2026–2027 data (timetable, attendance, student placement for that year) is **blocked** with: *This academic year is locked.*

---

### Step 4 — Optional Rollover (later, separate action)

On **2028–2029**, admin may run **Rollover** to copy leave settings, timetable, teacher assignments, etc. from a **locked** source year. Rollover does **not** change student class placement (that already came from lock + promotion).

---

## Locking Rules (Business Enforcement)

Once an academic year is locked:

- Any attempt to **create/update/delete** records belonging to that year is blocked.
- The user sees a clear message:  
  “This academic year is locked. Please switch to the active year or contact support.”

---

## Success Criteria (What “Done” Looks Like)

- A school can end the year using one guided flow.
- The new year becomes active and feels like a clean workspace.
- Only selected setup items are carried forward.
- Rollover cannot be run twice for the same target academic year; staff can see what was copied on the year card.
- Locked year is read-only everywhere (not just in settings).
- Historical data remains accessible without mixing into the new year.

---

## QA Manual Testing (User Journey Checklist)

This section is written so QA can test the full feature set delivered in this change: **Promotion & Placement**, **locking gates**, **rollover**, and **locked-year read-only enforcement**.

### Preconditions (recommended test setup)

- Have **two academic years** in the same tenant (e.g. “2025–2026” and “2026–2027”).
- Ensure “2025–2026” is **Active** and **not locked**.
- Ensure there are **active students** enrolled for the active year.
- Ensure there are **class sections** for the active year (so students belong to a class/section).
- Login as a role that can manage students/academic year settings (e.g. **School Admin**).

### A) Promotion & Placement screen (data entry)

1. Go to **Sidebar → Promotion**.
2. Select the **Academic year** (normally defaults to the active year).
3. (Optional) Select a **Class-section** to filter the student list.

4. For a student:
   - Set **Outcome** = **Promoted**
   - Set **Target class** and **Target section**
5. Click **Save**.

#### Expected results (when Promotion is incomplete)

- Save succeeds.
- If Outcome is **Promoted**, QA must be able to choose **Target class/section** (auto-filled by next class sort order + same section, but editable).
- If Outcome is **Repeated**, Target class/section is auto-filled as the current class/section and is **not editable**.
- If QA tries to Save with any **Promoted/Repeated** student missing target class/section, Save is blocked with a clear error message.
- After saving Promotion decisions, the **Students** list and class rosters should reflect the updated placement immediately.

### B) Readiness gate (blocking lock/rollover until grading is complete)

1. Ensure at least **one active student** has **no Promotion & Placement decision**.
2. Go to **Settings → Academic Years**.
3. Try to **Lock** the active academic year.

#### Expected results

- Lock is **blocked**.
- Error message clearly indicates that some students are still missing Promotion & Placement decisions.

1. Return to **Promotion**, complete decisions for **all active students** (Promoted/Repeated must have target class/section).
2. Try **Lock** again.

#### Expected results (after completing Promotion)

- Lock succeeds.
- On success, the system automatically **activates the next available (inactive) academic year**.
- If there is no next year, Lock is blocked with a message to **create a new academic year first**.

### C) Rollover wizard (copy setup from locked year into active year)

1. Go to **Settings → Academic Years** tab (inside `/settings`).
2. Ensure you have:
   - An **active** academic year (target year you are working in)
   - A **locked** academic year (source year you will copy from)
3. Click **Rollover** on the active year card.
4. Choose a **Source academic year (locked)**.
5. Toggle carry-forward options (recommended tests):
   - **Copy leave settings**: ON
   - (Optional) **Copy teacher assignments**: ON
   - (Optional) **Copy timetable slots**: ON
6. Click **Run rollover**.

#### Expected results (rollover)

- If Promotion decisions are incomplete for the selected source year, rollover is **blocked**.
- If readiness is complete:
  - The **active (target) year stays active and unlocked**
  - The **source year stays locked**
  - A success message shows how many items were copied (teacher assignments / timetable slots / leave settings — per the options chosen; class sections are not a user-facing rollover option)
- After a **successful** rollover for that target year:
  - The **Rollover** button on that year’s card is **disabled**
  - A **“Rollover complete”** summary appears under the card (short bullets: source year, leave settings, assignment/timetable counts as applicable)
- A **second** rollover attempt for the **same** target academic year is **rejected** with a clear error (UI and API).

### D) Locked year read-only enforcement (regression checks across modules)

After the year is locked (via Lock or Rollover), verify the system refuses edits that would change records **in the locked year**.

Run these quick checks:

- **Timetable**
  - Try to add/update/delete a timetable slot for the locked year.
  - **Expected**: operation blocked with “academic year is locked” message.
- **Attendance**
  - Try to mark attendance for a date/year that targets the locked year.
  - **Expected**: operation blocked.
- **Leave requests**
  - Try to create/cancel/approve leave that belongs to the locked year.
  - **Expected**: operation blocked.
- **Assessments / Grades**
  - Try to create/update/delete an assessment in the locked year, or add grades to it.
  - **Expected**: operation blocked.
- **Events**
  - Try to create/update/delete an event in the locked year.
  - **Expected**: operation blocked.
- **Students**
  - Try to edit a student’s placement/template details that target the locked year.
  - **Expected**: operation blocked.

#### Notes for QA

- “Blocked” means the API refuses the action and the UI shows an error message; viewing historic data is still allowed.
- If a screen does not allow choosing the locked year in the UI, QA can still validate the enforcement by executing the action in a way that targets the locked year (e.g. by using a year filter if present, or by calling the relevant endpoint with the locked year id).
