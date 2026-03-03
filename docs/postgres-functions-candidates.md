# Postgres Functions vs Multiple Supabase Queries — Analysis

Critical analysis of which backend modules should move complex or multi-query logic into Postgres functions (e.g. `supabase.rpc('fn_name', {...})`) to reduce round-trips and improve performance.

---

## 1. Reports (`reports.service.ts`) — **Highest priority**

**Why:** 50+ `.from()` calls across the file. Many report methods do the same pattern: load class sections → for each section load classes, sections, students (often in parallel) → then assessments → then student_grades → then profiles. Rank/percentile logic repeats 4–5 sequential queries (class_sections → students → assessments → student_grades + heavy in-memory aggregation).

**Examples:**
- `getAcademicReportBySubject`: loop over each allowed class section; per section: class_sections → classes + sections + students (Promise.all) → assessments → student_grades → profiles. With many sections this becomes dozens of round-trips.
- `getRanksForStudentInSubjects` / `getRankForStudentInSubject`: class_sections → students → assessments → student_grades, then rank/percentile computed in JS.
- PDF/export flows reuse the same multi-step data gathering.

**Recommendation:** Introduce Postgres functions that return JSON (or JSONB) for:
- **Report by subject:** e.g. `get_academic_report_by_subject(branch_id, academic_year_id, subject_id, allowed_section_ids)` returning one result set (or JSON) with class section info, student IDs, assessment IDs, grades, and optionally profile names.
- **Rank/percentile:** e.g. `get_student_rank_in_subject(class_section_id, subject_id, student_id, branch_id, academic_year_id)` returning rank and percentile in one round-trip.

This reduces N×5+ queries per report to 1–2 RPCs and moves aggregation (averages, ranks) into the DB where it scales better.

---

## 2. Assessments (`assessments.service.ts`) — **High priority**

**Why:** Several endpoints perform 4–8+ sequential or dependent Supabase queries and then aggregate in application code.

**Examples:**
- `getAssessmentStatistics`: assessment → class section (via service) → students count → student_grades → then counts and averages computed in JS.
- `getAssessmentStudentStatuses`: assessment → class section → students → student_assessment_statuses → profiles (for names).
- `getClassStatistics`: active year → class section → students count → assessments → student_grades → in-memory totals and averages.
- `getSubjectStatistics`: active year → subject → assessments → student_grades → per-assessment averages in a loop.
- `getStudentPerformance`: active year → student → assessments → student_grades → totals/percentages in JS.
- `getMyAssessmentsForCurrentStudent`: student → class_section → assessments → student template → subject_template_subjects (twice) → attachments → statuses. Many sequential steps.
- `notifyAssessmentRead`: class section → staff → user_roles (school_admin) → profile (student name). Multiple lookups for one notification.

**Recommendation:** Add Postgres functions such as:
- `get_assessment_statistics(assessment_id, branch_id)` — returns counts, averages, submission rate in one call.
- `get_class_statistics(class_section_id, branch_id, academic_year_id)` — returns student count, assessment counts, grade totals, overall average.
- `get_student_assessments_with_status(user_id, branch_id)` — returns assessments, statuses, and attachment summary for “my assessments” in one go.

This cuts 4–8 round-trips per request to 1 and keeps aggregation in the database.

---

## 3. Grades (`grades.service.ts`) — **Medium–high priority**

**Why:** Single-grade and bulk-grade flows do several validation queries then multiple writes. Bulk flow runs many update queries in parallel (one per existing grade) plus one insert.

**Examples:**
- `createGrade`: getAssessmentById (1) + class_section (1) + student (1) + existing grade check (1) + insert (1) = 5 round-trips.
- `bulkCreateGrades`: assessment + class_section + students + existing grades (4), then N parallel updates + 1 batch insert. With 30 students this is 4 + 30 + 1 = 35 round-trips in the worst case.
- `queryGrades` with `classSectionId` or `subjectId`: extra assessments lookup then main grades query (2 round-trips where one joined query could suffice).

**Recommendation:** Consider:
- **Bulk upsert grades:** e.g. `upsert_grades_for_assessment(assessment_id, branch_id, academic_year_id, grades_json)` that validates assessment/class/student and inserts or updates in one transaction. Replaces N updates + 1 insert with one RPC.
- **Query with filters:** a function or a single query that joins grades ↔ assessments so class_section_id/subject_id filters don’t require a separate assessments fetch.

---

## 4. Attendance (`attendance.service.ts`) — **Medium priority**

**Why:** List endpoint does one main query then 6 follow-up queries to attach names and class/section labels. Bulk mark can do 2+ queries per absent student (leave check + parent lookup) before creating an unrequested leave.

**Examples:**
- `listAttendance`: attendance → students → profiles → class_sections → classes → sections → “marked by” profiles. Seven queries that could be one joined query or one RPC returning denormalised rows.
- `createUnrequestedLeaveRequest` (used when marking absent): `hasExistingLeaveRequest` (1) + `getParentUserIdForStudent` (1) + insert (1). Called per absent student in bulk operations.

**Recommendation:** 
- **List with related data:** e.g. `list_attendance_with_relations(branch_id, academic_year_id, filters...)` returning attendance rows with student name, class/section names, marked_by name in one call (single query with joins or a function returning JSON/setof).
- **Bulk mark with leave/parent logic:** e.g. `bulk_mark_attendance_and_create_leaves(...)` that, in one transaction, marks attendance and creates unrequested leave requests only where no leave exists and parent is known, reducing per-student round-trips.

---

## 5. Students (`students.service.ts`) — **Medium priority**

**Why:** List does one or two table queries (parent_students for parents, then students with joins) then N× `auth.admin.getUserById` calls for emails and template assignments. The DB part (students + classes/sections + template assignments) could be one or two calls.

**Examples:**
- `listStudents`: parent_students (if parent) → students (with classes/sections) → **one getUserById per student** → student_subject_template_assignments. The auth calls are not Supabase table queries but are still N round-trips; the rest is 3–4 DB round-trips that could be collapsed.

**Recommendation:** A Postgres function cannot replace `auth.admin.getUserById`. You can still:
- Combine “students + class/section + template assignments” into one RPC or one query (e.g. `list_students_with_templates(branch_id, filters, limit, offset)`) returning rows with template info, so only auth and this single DB call remain. Optionally batch or cache email lookups if needed.

---

## 6. Bulk import (`bulk-import.service.ts`) — **Medium priority**

**Why:** Resolution and validation are done with 2–3 queries per entity (class, section, subject template) and repeated for many rows or unique values, so total round-trips scale with rows × unique refs.

**Examples:**
- `resolveClassId`: by id (1) or by name (1) or by display_name (1) — up to 3 queries per class.
- `resolveSectionId` / `resolveSubjectTemplateId`: similar pattern.
- These are called per row or per unique value during import, leading to many sequential validations.

**Recommendation:** A function such as `resolve_import_refs(branch_id, class_refs_json, section_refs_json, template_refs_json)` that returns resolved IDs (and validation errors) in one round-trip. The service would then use this once per batch of rows instead of per value.

---

## 7. Dashboard (`dashboard.service.ts`) — **Low priority**

**Why:** `getPreferences` and `savePreferences` are 1–2 simple queries; `getDashboardData` returns `{}`. Widgets load their own data via existing APIs.

**Recommendation:** No need for Postgres functions here unless dashboard widgets are moved to server-side aggregation with multiple queries.

---

## Summary table

| Module      | Priority   | Main issue                                      | Suggested change                                      |
|------------|------------|--------------------------------------------------|--------------------------------------------------------|
| Reports    | Highest    | 50+ queries; loops over sections + 5+ queries each; rank logic 4–5 queries | RPCs for report-by-subject, rank/percentile, PDF data  |
| Assessments| High       | 4–8 queries per stats/status/class/subject/student | RPCs for statistics, class stats, “my assessments”     |
| Grades     | Medium–high| 5 per create; N updates + 1 insert for bulk     | Bulk upsert RPC; single query for filtered list        |
| Attendance | Medium     | 7 queries for list; 2+ per absent on bulk mark   | One “list with relations”; optional “bulk mark + leaves”|
| Students   | Medium     | 3–4 DB queries + N auth calls for list          | One “students with templates” RPC (auth unchanged)     |
| Bulk import| Medium     | 2–3 queries per class/section/template per row   | Single “resolve refs” RPC per batch                    |
| Dashboard  | Low        | 1–2 queries                                     | No change                                              |

---

## Implementation notes

- **RLS:** Postgres functions run with the role used by the client (or a `SECURITY DEFINER` role if you explicitly switch). Ensure RLS and branch/tenant isolation are enforced either inside the function (e.g. by passing `branch_id` and filtering) or by using a role that still respects RLS.
- **Contract:** Keep API response shape unchanged; have the service call `supabase.rpc('...', { ... })` and map the returned JSON/rows to existing DTOs so controllers and frontend stay unchanged.
- **Incremental rollout:** Replace one heavy method at a time (e.g. start with `get_assessment_statistics` or report-by-subject), compare results and performance, then extend to other methods.
