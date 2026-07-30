# ABC School Seed – Audit Report

This document summarises what the current seed does, what the application expects, and what is **missing or wrong** for the ABC School Networks tenant.

---

## 1. Branch vs tenant scope mismatch (critical)

The application’s **core lookups** (classes, sections, subjects, levels) and **settings status** all filter by **`branch_id`**. The seed creates **classes**, **sections**, and **subjects** with **`tenant_id` only** and **`branch_id = null`**.

| Table      | Seed creates              | App expects (e.g. `core-lookups.service`) | Result for ABC branches   |
|-----------|---------------------------|-------------------------------------------|----------------------------|
| `classes` | `tenant_id` only, no `branch_id` | `.eq('branch_id', branchId)`             | **0 classes** returned     |
| `sections`| `tenant_id` only, no `branch_id` | `.eq('branch_id', branchId)`             | **0 sections** returned    |
| `subjects`| `tenant_id` only, `branch_id` null | `.eq('branch_id', branchId)`           | **0 subjects** returned     |

So in the portal, when an ABC branch is selected, **Classes**, **Sections**, and **Subjects** dropdowns/lists will be empty because the DB has no rows for that `branch_id`.

**Fix:** Create (or copy) classes, sections, and subjects **per branch**, or ensure the seed sets `branch_id` on existing rows for each ABC branch (and that your schema allows it). The codebase pattern (e.g. Al Ahmar, settings-status, core-lookups) is branch-scoped.

---

## 2. Levels and level_classes (missing)

- **`levels`**: No rows for ABC branches. The app uses levels per branch (e.g. “Primary”, “Secondary”) and links them to classes via `level_classes`.
- **`level_classes`**: Not created. So even if levels existed, class–level mapping would be missing.

**Used by:** Settings status (“Academic” step), class-section/teacher flows, reports.

**Fix:** Seed at least one level per branch and populate `level_classes` (level_id, class_id) for that branch’s classes.

---

## 3. Teacher assignments and class teacher (missing)

- **`teacher_assignments`**: The seed **never inserts** into this table. It builds a `classTeacherMap` in memory and uses it only for attendance/assessments/behaviour, but does not persist:
  - `teacher_assignments` (staff_id, class_section_id, subject_id, role type, etc.)
  - or `class_sections.class_teacher_id`
- **`class_sections.class_teacher_id`**: All ABC class_sections have **null** `class_teacher_id`.

So the app will show no teacher–class/section mapping, and “class teacher” will be empty.

**Fix:** After creating staff and class_sections:
- For each class section that should have a class teacher, set `class_sections.class_teacher_id` to the corresponding staff (or user) id as per your schema.
- Insert rows into `teacher_assignments` for class teachers and subject teachers (class_section_id, staff_id, subject_id if applicable, etc.) so that teacher mapping and reports work.

---

## 4. Timing / schedule (missing)

- **`timing_templates`**: No rows for ABC branches.
- **`timing_template_slots`**: Not created.
- **`class_timing_assignments`**: Not created (which class_section uses which timing template).
- **`school_days`**: Not created (which days are active, linked to timing).

Settings status uses “at least one timing template” and “school days configured” for the **Schedule** step. Without these, the branch will show as not fully set up.

**Fix:** Seed at least one timing template per branch, with slots and school days, and assign it to class sections as required by your schema.

---

## 5. Grade templates (branch scope)

- **`grade_templates`**: The seed creates **one** template with **`tenant_id`** only and **no `branch_id`**.
- **Settings status** checks: `grade_templates` with `.eq('branch_id', branchId)`. So for ABC branches the count is **0** and the Assessment step is incomplete.
- Other tenants in your DB have `grade_templates` with **`branch_id`** set.

**Fix:** Create grade templates (and their `grade_ranges`) **per branch**, or at least set `branch_id` on the template so that branch-scoped checks and UI work. Keep `class_grade_assignments` consistent (correct `grade_template_id` and class/branch semantics).

---

## 6. Subject templates (missing)

- **`subject_templates`**: No rows for ABC branches.
- **`subject_template_subjects`**: Not created.
- **`class_subject_template_assignments`** / **`level_subject_template_assignments`** / **`student_subject_template_assignments`**: Not created for ABC.

Subject templates drive “which subjects belong to which template” and “which class/level/student uses which template”. Without them, template-based flows (e.g. Class 9–10 Science vs Arts) will not work for ABC.

**Fix:** Seed at least one subject template per branch, link subjects via `subject_template_subjects`, and assign to classes/levels/students as per your business rules.

---

## 7. Leave settings (missing)

- **`leave_settings`**: No row for the ABC academic year (2025–2026). Settings status expects at least one `leave_settings` for the Assessment step (leave quota, etc.).

**Fix:** Insert `leave_settings` for the ABC academic year (e.g. `academic_year_id`, `annual_quota`, and any other required fields).

---

## 8. System settings (missing for status)

- **`system_settings`**: The app checks for keys such as **`communication_direction`** and **`behavioral_assessment`** to mark Communication and Behavior as configured. If these are global (no branch), ensure they exist; if per-branch, create them for each ABC branch.

**Fix:** Insert the required system_settings keys (and values) so that settings status and dependent features work.

---

## 9. Timetable slots (missing)

- **`timetable_slots`**: No rows for ABC class_sections. So no actual timetable is generated.

**Fix:** After timing templates and class_timing_assignments exist, seed `timetable_slots` (class_section_id, day, period, subject, staff, etc.) so that the timetable UI has data.

---

## 10. What the seed does correctly (for reference)

- Tenant and branches (ABC School Networks, Main + Secondary).
- Academic year 2025–2026 (tenant-scoped).
- **class_sections**: 40 created (20 per branch) with correct `class_id`, `section_id`, `branch_id`, `academic_year_id`. Only `class_teacher_id` is missing.
- **assessment_types**: 8 (4 per branch).
- **staff**: Created with auth users, profiles, user_branches, user_roles.
- **students**: Created with auth users where applicable, linked to class_sections.
- **parents** and **parent_students**.
- **Attendance**, **assessments**, **student_grades**, **behavioral_assessments**, **events** (depending on script steps).

So the main gaps are: **branch-scoped lookups (classes/sections/subjects)**, **levels**, **teacher assignments**, **timing/schedule**, **grade_templates per branch**, **subject templates**, **leave_settings**, **system_settings**, and **timetable_slots**.

---

## Recommended order to fix the seed

1. **Scope:** Create (or update) **classes**, **sections**, **subjects** per **branch** (or set `branch_id` correctly) so core lookups return data.
2. **Levels:** Seed **levels** and **level_classes** per branch.
3. **Teachers:** Set **class_sections.class_teacher_id** and insert **teacher_assignments**.
4. **Schedule:** Seed **timing_templates**, **timing_template_slots**, **school_days**, **class_timing_assignments**.
5. **Grading:** Create **grade_templates** (and ranges) per branch; fix **class_grade_assignments** if needed.
6. **Subject templates:** Seed **subject_templates**, **subject_template_subjects**, and assignments.
7. **Leave & system:** **leave_settings** for ABC academic year; required **system_settings** keys.
8. **Timetable:** **timetable_slots** once timing and teacher assignments exist.

This order respects foreign keys and matches how the app and settings status expect data to be structured (branch-scoped where the code uses `branch_id`).
