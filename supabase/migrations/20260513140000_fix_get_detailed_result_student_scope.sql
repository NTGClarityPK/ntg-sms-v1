-- Detailed result PDFs call get_detailed_result; it previously required
-- students.academic_year_id = _academic_year_id. Enrolment is year-scoped on
-- student_enrolments, and students.academic_year_id can differ, so the RPC
-- returned no row while class results / basic PDFs (TS path) still worked.

CREATE OR REPLACE FUNCTION public.get_detailed_result(
  _student_id uuid,
  _class_section_id uuid,
  _branch_id uuid,
  _academic_year_id uuid
)
RETURNS jsonb
LANGUAGE sql
AS $function$
with a_scope as (
  select id, subject_id, total_marks, title
  from assessments
  where class_section_id = _class_section_id
    and branch_id = _branch_id
    and academic_year_id = _academic_year_id
),
student_grades_scope as (
  select assessment_id, coalesce(marks_obtained, 0)::numeric as marks_obtained
  from student_grades
  where student_id = _student_id
    and branch_id = _branch_id
    and academic_year_id = _academic_year_id
),
by_subject as (
  select
    a.subject_id,
    sum(sg.marks_obtained) as marks_obtained,
    sum(a.total_marks) as total_marks
  from a_scope a
  left join student_grades_scope sg on sg.assessment_id = a.id
  group by a.subject_id
),
subjects_calc as (
  select
    s.id as subject_id,
    s.name as subject_name,
    coalesce(b.marks_obtained, 0) as marks_obtained,
    coalesce(b.total_marks, 0) as total_marks,
    case when coalesce(b.total_marks, 0) > 0
      then round((coalesce(b.marks_obtained, 0) / b.total_marks) * 100)::int
      else 0
    end as percentage
  from by_subject b
  join subjects s on s.id = b.subject_id
),
class_row as (
  select class_id
  from class_sections
  where id = _class_section_id
    and branch_id = _branch_id
    and academic_year_id = _academic_year_id
),
class_grade as (
  select grade_template_id
  from class_grade_assignments
  where class_id = (select class_id from class_row)
  limit 1
),
ranges as (
  select letter, min_percentage, max_percentage
  from grade_ranges
  where grade_template_id = (select grade_template_id from class_grade)
),
subjects_with_letter as (
  select
    sc.*,
    (select letter from ranges r
      where sc.percentage >= r.min_percentage and sc.percentage <= r.max_percentage
      order by min_percentage
      limit 1) as letter_grade
  from subjects_calc sc
),
subjects_json as (
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'subjectId', subject_id,
          'subjectName', subject_name,
          'marksObtained', marks_obtained,
          'totalMarks', total_marks,
          'percentage', percentage,
          'letterGrade', letter_grade
        ) order by subject_name
      ),
      '[]'::jsonb
    ) as subjects,
    case when count(*) > 0 then round(avg(percentage))::int else 0 end as overall_pct
  from subjects_with_letter
),
overall_letter as (
  select
    overall_pct,
    (select letter from ranges r
      where overall_pct >= r.min_percentage and overall_pct <= r.max_percentage
      order by min_percentage
      limit 1) as overall_letter
  from subjects_json
),
assessment_entries as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'assessmentId', a.id,
        'assessmentTitle', a.title,
        'subjectName', s.name,
        'marksObtained', coalesce(g.marks_obtained, 0),
        'totalMarks', a.total_marks,
        'percentage', case when a.total_marks > 0 then round((coalesce(g.marks_obtained, 0) / a.total_marks) * 100)::int else 0 end
      ) order by s.name, a.title
    ),
    '[]'::jsonb
  ) as assessment_entries
  from a_scope a
  join subjects s on s.id = a.subject_id
  left join student_grades_scope g on g.assessment_id = a.id
),
student_info as (
  select
    s.id as student_id,
    s.student_id as student_student_id,
    coalesce(p.full_name, 'Student') as student_name
  from students s
  left join profiles p on p.id = s.user_id
  inner join class_sections cs on cs.id = _class_section_id
    and cs.branch_id = _branch_id
    and cs.academic_year_id = _academic_year_id
  inner join student_enrolments e on e.student_id = s.id
    and e.branch_id = _branch_id
    and e.academic_year_id = _academic_year_id
    and e.class_id = cs.class_id
    and e.section_id = cs.section_id
    and e.status = 'active'
  where s.id = _student_id
    and s.branch_id = _branch_id
)
select jsonb_build_object(
  'studentId', student_info.student_id,
  'studentName', student_info.student_name,
  'studentStudentId', student_info.student_student_id,
  'subjects', subjects_json.subjects,
  'overallPercentage', overall_letter.overall_pct,
  'overallLetterGrade', overall_letter.overall_letter,
  'assessmentWiseEntries', assessment_entries.assessment_entries
)
from student_info, subjects_json, overall_letter, assessment_entries;
$function$;
