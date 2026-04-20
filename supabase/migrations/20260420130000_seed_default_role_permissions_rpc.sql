-- Seeds the same default role permissions as Setup Wizard.
-- Used by bulk import so both setup paths yield identical permission defaults.

create or replace function public.seed_default_role_permissions(
  p_branch_id uuid,
  p_user_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_admin_role_id uuid;
  v_missing_roles text;
  v_missing_features text;
begin
  if p_branch_id is null then
    raise exception 'branchId is required';
  end if;

  -- Validate required roles/features exist (fail loudly if seed data is incomplete)
  with desired as (
    select * from (values
      -- Principal
      ('principal','assessment','view'),
      ('principal','attendance','view'),
      ('principal','behavioral','view'),
      ('principal','class_sections','edit'),
      ('principal','communication','edit'),
      ('principal','dashboard','edit'),
      ('principal','early_departure','view'),
      ('principal','events_management','edit'),
      ('principal','events_personal','edit'),
      ('principal','leaves','view'),
      ('principal','library','view'),
      ('principal','my_assessments','none'),
      ('principal','parent_associations','edit'),
      ('principal','reports','view'),
      ('principal','settings','edit'),
      ('principal','user_management','edit'),
      ('principal','students','edit'),
      ('principal','teacher_mapping','edit'),
      ('principal','timetable_management','edit'),
      ('principal','timetable_personal','none'),
      ('principal','inventory','view'),

      -- Academic Coordinator
      ('academic_coordinator','assessment','edit'),
      ('academic_coordinator','attendance','edit'),
      ('academic_coordinator','behavioral','edit'),
      ('academic_coordinator','class_sections','edit'),
      ('academic_coordinator','communication','edit'),
      ('academic_coordinator','dashboard','view'),
      ('academic_coordinator','early_departure','edit'),
      ('academic_coordinator','events_management','edit'),
      ('academic_coordinator','events_personal','edit'),
      ('academic_coordinator','leaves','edit'),
      ('academic_coordinator','library','view'),
      ('academic_coordinator','my_assessments','none'),
      ('academic_coordinator','parent_associations','view'),
      ('academic_coordinator','reports','view'),
      ('academic_coordinator','settings','none'),
      ('academic_coordinator','user_management','view'),
      ('academic_coordinator','students','edit'),
      ('academic_coordinator','teacher_mapping','edit'),
      ('academic_coordinator','timetable_management','edit'),
      ('academic_coordinator','timetable_personal','none'),
      ('academic_coordinator','inventory','view'),

      -- Admin Assistant
      ('admin_assistant','assessment','none'),
      ('admin_assistant','attendance','edit'),
      ('admin_assistant','behavioral','none'),
      ('admin_assistant','class_sections','view'),
      ('admin_assistant','communication','edit'),
      ('admin_assistant','dashboard','view'),
      ('admin_assistant','early_departure','edit'),
      ('admin_assistant','events_management','edit'),
      ('admin_assistant','events_personal','edit'),
      ('admin_assistant','leaves','edit'),
      ('admin_assistant','library','edit'),
      ('admin_assistant','my_assessments','none'),
      ('admin_assistant','parent_associations','edit'),
      ('admin_assistant','reports','none'),
      ('admin_assistant','settings','view'),
      ('admin_assistant','user_management','edit'),
      ('admin_assistant','students','edit'),
      ('admin_assistant','teacher_mapping','view'),
      ('admin_assistant','timetable_management','view'),
      ('admin_assistant','timetable_personal','none'),
      ('admin_assistant','inventory','edit'),

      -- Class Teacher
      ('class_teacher','assessment','edit'),
      ('class_teacher','attendance','edit'),
      ('class_teacher','behavioral','edit'),
      ('class_teacher','class_sections','view'),
      ('class_teacher','communication','edit'),
      ('class_teacher','dashboard','view'),
      ('class_teacher','early_departure','edit'),
      ('class_teacher','events_management','view'),
      ('class_teacher','events_personal','edit'),
      ('class_teacher','leaves','edit'),
      ('class_teacher','library','view'),
      ('class_teacher','my_assessments','edit'),
      ('class_teacher','parent_associations','view'),
      ('class_teacher','reports','view'),
      ('class_teacher','settings','none'),
      ('class_teacher','user_management','none'),
      ('class_teacher','students','view'),
      ('class_teacher','teacher_mapping','view'),
      ('class_teacher','timetable_management','view'),
      ('class_teacher','timetable_personal','edit'),
      ('class_teacher','inventory','none'),

      -- Subject Teacher
      ('subject_teacher','assessment','edit'),
      ('subject_teacher','attendance','edit'),
      ('subject_teacher','behavioral','view'),
      ('subject_teacher','class_sections','view'),
      ('subject_teacher','communication','edit'),
      ('subject_teacher','dashboard','view'),
      ('subject_teacher','early_departure','none'),
      ('subject_teacher','events_management','view'),
      ('subject_teacher','events_personal','edit'),
      ('subject_teacher','leaves','view'),
      ('subject_teacher','library','view'),
      ('subject_teacher','my_assessments','edit'),
      ('subject_teacher','parent_associations','none'),
      ('subject_teacher','reports','view'),
      ('subject_teacher','settings','none'),
      ('subject_teacher','user_management','none'),
      ('subject_teacher','students','view'),
      ('subject_teacher','teacher_mapping','view'),
      ('subject_teacher','timetable_management','view'),
      ('subject_teacher','timetable_personal','edit'),
      ('subject_teacher','inventory','none'),

      -- Guidance Counselor
      ('guidance_counselor','assessment','view'),
      ('guidance_counselor','attendance','view'),
      ('guidance_counselor','behavioral','edit'),
      ('guidance_counselor','class_sections','view'),
      ('guidance_counselor','communication','edit'),
      ('guidance_counselor','dashboard','view'),
      ('guidance_counselor','early_departure','view'),
      ('guidance_counselor','events_management','view'),
      ('guidance_counselor','events_personal','edit'),
      ('guidance_counselor','leaves','view'),
      ('guidance_counselor','library','view'),
      ('guidance_counselor','my_assessments','none'),
      ('guidance_counselor','parent_associations','view'),
      ('guidance_counselor','reports','view'),
      ('guidance_counselor','settings','none'),
      ('guidance_counselor','user_management','none'),
      ('guidance_counselor','students','view'),
      ('guidance_counselor','teacher_mapping','view'),
      ('guidance_counselor','timetable_management','view'),
      ('guidance_counselor','timetable_personal','none'),
      ('guidance_counselor','inventory','none'),

      -- Parent
      ('parent','assessment','view'),
      ('parent','attendance','view'),
      ('parent','behavioral','view'),
      ('parent','class_sections','none'),
      ('parent','communication','edit'),
      ('parent','dashboard','view'),
      ('parent','early_departure','view'),
      ('parent','events_management','view'),
      ('parent','events_personal','edit'),
      ('parent','leaves','view'),
      ('parent','library','view'),
      ('parent','my_assessments','none'),
      ('parent','parent_associations','none'),
      ('parent','reports','view'),
      ('parent','settings','none'),
      ('parent','user_management','none'),
      ('parent','students','none'),
      ('parent','teacher_mapping','none'),
      ('parent','timetable_management','view'),
      ('parent','timetable_personal','none'),
      ('parent','inventory','none'),

      -- Student
      ('student','assessment','view'),
      ('student','attendance','view'),
      ('student','behavioral','view'),
      ('student','class_sections','none'),
      ('student','communication','edit'),
      ('student','dashboard','view'),
      ('student','early_departure','view'),
      ('student','events_management','view'),
      ('student','events_personal','edit'),
      ('student','leaves','view'),
      ('student','library','view'),
      ('student','my_assessments','none'),
      ('student','parent_associations','none'),
      ('student','reports','view'),
      ('student','settings','none'),
      ('student','user_management','none'),
      ('student','students','none'),
      ('student','teacher_mapping','none'),
      ('student','timetable_management','view'),
      ('student','timetable_personal','none'),
      ('student','inventory','edit')
    ) as t(role_name, feature_code, perm)
  ),
  missing_roles as (
    select string_agg(distinct d.role_name, ', ' order by d.role_name) as missing
    from desired d
    left join public.roles r on r.name::text = d.role_name
    where r.id is null
  ),
  missing_features as (
    select string_agg(distinct d.feature_code, ', ' order by d.feature_code) as missing
    from desired d
    left join public.features f on f.code = d.feature_code
    where f.id is null
  )
  select mr.missing, mf.missing into v_missing_roles, v_missing_features
  from missing_roles mr cross join missing_features mf;

  if v_missing_roles is not null then
    raise exception 'Default permissions: missing roles: %', v_missing_roles;
  end if;
  if v_missing_features is not null then
    raise exception 'Default permissions: missing features: %', v_missing_features;
  end if;

  with desired as (
    select * from (values
      ('principal','assessment','view'),
      ('principal','attendance','view'),
      ('principal','behavioral','view'),
      ('principal','class_sections','edit'),
      ('principal','communication','edit'),
      ('principal','dashboard','edit'),
      ('principal','early_departure','view'),
      ('principal','events_management','edit'),
      ('principal','events_personal','edit'),
      ('principal','leaves','view'),
      ('principal','library','view'),
      ('principal','my_assessments','none'),
      ('principal','parent_associations','edit'),
      ('principal','reports','view'),
      ('principal','settings','edit'),
      ('principal','user_management','edit'),
      ('principal','students','edit'),
      ('principal','teacher_mapping','edit'),
      ('principal','timetable_management','edit'),
      ('principal','timetable_personal','none'),
      ('principal','inventory','view'),

      ('academic_coordinator','assessment','edit'),
      ('academic_coordinator','attendance','edit'),
      ('academic_coordinator','behavioral','edit'),
      ('academic_coordinator','class_sections','edit'),
      ('academic_coordinator','communication','edit'),
      ('academic_coordinator','dashboard','view'),
      ('academic_coordinator','early_departure','edit'),
      ('academic_coordinator','events_management','edit'),
      ('academic_coordinator','events_personal','edit'),
      ('academic_coordinator','leaves','edit'),
      ('academic_coordinator','library','view'),
      ('academic_coordinator','my_assessments','none'),
      ('academic_coordinator','parent_associations','view'),
      ('academic_coordinator','reports','view'),
      ('academic_coordinator','settings','none'),
      ('academic_coordinator','user_management','view'),
      ('academic_coordinator','students','edit'),
      ('academic_coordinator','teacher_mapping','edit'),
      ('academic_coordinator','timetable_management','edit'),
      ('academic_coordinator','timetable_personal','none'),
      ('academic_coordinator','inventory','view'),

      ('admin_assistant','assessment','none'),
      ('admin_assistant','attendance','edit'),
      ('admin_assistant','behavioral','none'),
      ('admin_assistant','class_sections','view'),
      ('admin_assistant','communication','edit'),
      ('admin_assistant','dashboard','view'),
      ('admin_assistant','early_departure','edit'),
      ('admin_assistant','events_management','edit'),
      ('admin_assistant','events_personal','edit'),
      ('admin_assistant','leaves','edit'),
      ('admin_assistant','library','edit'),
      ('admin_assistant','my_assessments','none'),
      ('admin_assistant','parent_associations','edit'),
      ('admin_assistant','reports','none'),
      ('admin_assistant','settings','view'),
      ('admin_assistant','user_management','edit'),
      ('admin_assistant','students','edit'),
      ('admin_assistant','teacher_mapping','view'),
      ('admin_assistant','timetable_management','view'),
      ('admin_assistant','timetable_personal','none'),
      ('admin_assistant','inventory','edit'),

      ('class_teacher','assessment','edit'),
      ('class_teacher','attendance','edit'),
      ('class_teacher','behavioral','edit'),
      ('class_teacher','class_sections','view'),
      ('class_teacher','communication','edit'),
      ('class_teacher','dashboard','view'),
      ('class_teacher','early_departure','edit'),
      ('class_teacher','events_management','view'),
      ('class_teacher','events_personal','edit'),
      ('class_teacher','leaves','edit'),
      ('class_teacher','library','view'),
      ('class_teacher','my_assessments','edit'),
      ('class_teacher','parent_associations','view'),
      ('class_teacher','reports','view'),
      ('class_teacher','settings','none'),
      ('class_teacher','user_management','none'),
      ('class_teacher','students','view'),
      ('class_teacher','teacher_mapping','view'),
      ('class_teacher','timetable_management','view'),
      ('class_teacher','timetable_personal','edit'),
      ('class_teacher','inventory','none'),

      ('subject_teacher','assessment','edit'),
      ('subject_teacher','attendance','edit'),
      ('subject_teacher','behavioral','view'),
      ('subject_teacher','class_sections','view'),
      ('subject_teacher','communication','edit'),
      ('subject_teacher','dashboard','view'),
      ('subject_teacher','early_departure','none'),
      ('subject_teacher','events_management','view'),
      ('subject_teacher','events_personal','edit'),
      ('subject_teacher','leaves','view'),
      ('subject_teacher','library','view'),
      ('subject_teacher','my_assessments','edit'),
      ('subject_teacher','parent_associations','none'),
      ('subject_teacher','reports','view'),
      ('subject_teacher','settings','none'),
      ('subject_teacher','user_management','none'),
      ('subject_teacher','students','view'),
      ('subject_teacher','teacher_mapping','view'),
      ('subject_teacher','timetable_management','view'),
      ('subject_teacher','timetable_personal','edit'),
      ('subject_teacher','inventory','none'),

      ('guidance_counselor','assessment','view'),
      ('guidance_counselor','attendance','view'),
      ('guidance_counselor','behavioral','edit'),
      ('guidance_counselor','class_sections','view'),
      ('guidance_counselor','communication','edit'),
      ('guidance_counselor','dashboard','view'),
      ('guidance_counselor','early_departure','view'),
      ('guidance_counselor','events_management','view'),
      ('guidance_counselor','events_personal','edit'),
      ('guidance_counselor','leaves','view'),
      ('guidance_counselor','library','view'),
      ('guidance_counselor','my_assessments','none'),
      ('guidance_counselor','parent_associations','view'),
      ('guidance_counselor','reports','view'),
      ('guidance_counselor','settings','none'),
      ('guidance_counselor','user_management','none'),
      ('guidance_counselor','students','view'),
      ('guidance_counselor','teacher_mapping','view'),
      ('guidance_counselor','timetable_management','view'),
      ('guidance_counselor','timetable_personal','none'),
      ('guidance_counselor','inventory','none'),

      ('parent','assessment','view'),
      ('parent','attendance','view'),
      ('parent','behavioral','view'),
      ('parent','class_sections','none'),
      ('parent','communication','edit'),
      ('parent','dashboard','view'),
      ('parent','early_departure','view'),
      ('parent','events_management','view'),
      ('parent','events_personal','edit'),
      ('parent','leaves','view'),
      ('parent','library','view'),
      ('parent','my_assessments','none'),
      ('parent','parent_associations','none'),
      ('parent','reports','view'),
      ('parent','settings','none'),
      ('parent','user_management','none'),
      ('parent','students','none'),
      ('parent','teacher_mapping','none'),
      ('parent','timetable_management','view'),
      ('parent','timetable_personal','none'),
      ('parent','inventory','none'),

      ('student','assessment','view'),
      ('student','attendance','view'),
      ('student','behavioral','view'),
      ('student','class_sections','none'),
      ('student','communication','edit'),
      ('student','dashboard','view'),
      ('student','early_departure','view'),
      ('student','events_management','view'),
      ('student','events_personal','edit'),
      ('student','leaves','view'),
      ('student','library','view'),
      ('student','my_assessments','none'),
      ('student','parent_associations','none'),
      ('student','reports','view'),
      ('student','settings','none'),
      ('student','user_management','none'),
      ('student','students','none'),
      ('student','teacher_mapping','none'),
      ('student','timetable_management','view'),
      ('student','timetable_personal','none'),
      ('student','inventory','edit')
    ) as t(role_name, feature_code, perm)
  )
  insert into public.role_permissions (role_id, feature_id, permission, branch_id, updated_at, created_by, updated_by)
  select
    r.id,
    f.id,
    d.perm,
    p_branch_id,
    now(),
    p_user_email,
    p_user_email
  from desired d
  join public.roles r on r.name::text = d.role_name
  join public.features f on f.code = d.feature_code
  on conflict (role_id, feature_id, branch_id)
  do update set permission = excluded.permission, updated_at = now(), updated_by = p_user_email;

  select id into v_school_admin_role_id
  from public.roles
  where name::text = 'school_admin'
  limit 1;

  if v_school_admin_role_id is null then
    raise exception 'School Admin role not found';
  end if;

  insert into public.role_permissions (role_id, feature_id, permission, branch_id, updated_at, created_by, updated_by)
  select
    v_school_admin_role_id,
    f.id,
    'edit',
    p_branch_id,
    now(),
    p_user_email,
    p_user_email
  from public.features f
  on conflict (role_id, feature_id, branch_id)
  do update set permission = excluded.permission, updated_at = now(), updated_by = p_user_email;
end;
$$;

