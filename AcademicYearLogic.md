# Academic Year Logic (Lock + Rollover)

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
- Locking is intended to be **final** (unlock only via super admin support).

### Fresh Start (New Year)
When a new academic year is activated, the school should experience a **fresh operational start**:
- New year starts with **no attendance, no leave requests, no assessments/grades, no events** by default.
- The school may **carry forward** structural setup (classes/sections/teachers/templates/timetables) via a wizard.

---

## School User Journey (After Implementation)

### 1) Admin decides to end the year
From **Settings → Academic Years**, the admin clicks:
- **“Lock & Start New Academic Year”** (recommended label)

The system shows a clear warning:
- “You are ending the current academic year. After locking, records in that year cannot be edited.”
- “You will be guided to start the new year and optionally carry forward selected setup.”

### 2) Rollover wizard opens (guided steps)
The wizard helps the admin create a correct new-year setup without needing technical knowledge.

**Step A — Choose the new academic year**
- Create a new year (name + start/end dates) **or** select an already-created inactive year.
- Confirm: “This will become the active year once the rollover completes.”

**Step B — Choose what to copy forward (carry-forward options)**
The admin selects what to bring into the new year. Recommended defaults are listed below.

**Step C — Review and confirm**
Before executing, the system shows:
- Source year → Target year
- Selected carry-forward items
- A short summary of what will start empty (attendance, assessments, etc.)

**Step D — Execute rollover**
The system performs the carry-forward and setup actions and then shows a results summary:
- “Created X class sections”
- “Copied X teacher assignments”
- “Copied X timetable slots”
- “Skipped Y items (already existed)”

### 3) New year becomes the live working year
- The new year is set as **Active**.
- The old year is **Locked** (read-only).
- All daily screens now show new-year data by default (which may be empty if nothing was copied).

### 4) Viewing history
- Staff can switch a “Year” filter on reporting/history pages to view last year’s records.
- Operational screens still default to the active year to avoid confusion.

---

## What is Copied vs What Starts Fresh

### Carry-Forward (Optional Setup Copy)
These are “setup/scaffolding” items that schools commonly want to reuse.

- **Class Sections (recommended: ON)**  
  Copies the list of class/section combinations into the new year so the school structure exists immediately.

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
- Locked year is read-only everywhere (not just in settings).
- Historical data remains accessible without mixing into the new year.
