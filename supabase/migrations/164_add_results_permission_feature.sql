-- Report Cards (results) as a dedicated permission-matrix column.
-- Previously /results was gated via usePermissions fallbacks to reports/assessment,
-- which incorrectly showed Report Cards for parents who had Assessment or Reports view.

insert into public.features (code, name)
values ('results', 'Report Cards')
on conflict (code) do update
set name = excluded.name;

-- Staff / teacher roles: copy Assessment permission so existing access is preserved
-- after removing the assessment/reports fallback.
insert into public.role_permissions (role_id, feature_id, permission, branch_id, updated_at, created_by, updated_by)
select
  rp.role_id,
  f_results.id,
  rp.permission,
  rp.branch_id,
  now(),
  'migration',
  'migration'
from public.role_permissions rp
join public.features f_assessment
  on f_assessment.id = rp.feature_id
 and f_assessment.code = 'assessment'
join public.roles r
  on r.id = rp.role_id
cross join public.features f_results
where f_results.code = 'results'
  and r.name not in ('parent', 'student')
  and not exists (
    select 1
    from public.role_permissions existing
    where existing.role_id = rp.role_id
      and existing.feature_id = f_results.id
      and existing.branch_id = rp.branch_id
  );

-- Parents and students: explicit none (they use My Child / student views, not staff Report Cards).
insert into public.role_permissions (role_id, feature_id, permission, branch_id, updated_at, created_by, updated_by)
select
  r.id,
  f.id,
  'none',
  b.id,
  now(),
  'migration',
  'migration'
from public.roles r
cross join public.features f
cross join public.branches b
where f.code = 'results'
  and r.name in ('parent', 'student')
  and not exists (
    select 1
    from public.role_permissions existing
    where existing.role_id = r.id
      and existing.feature_id = f.id
      and existing.branch_id = b.id
  );

-- Ensure Conflicts rows exist for parent/student as none where missing
-- (matrix may show none via default UI, but a row makes saves consistent).
insert into public.role_permissions (role_id, feature_id, permission, branch_id, updated_at, created_by, updated_by)
select
  r.id,
  f.id,
  'none',
  b.id,
  now(),
  'migration',
  'migration'
from public.roles r
cross join public.features f
cross join public.branches b
where f.code = 'conflict_management'
  and r.name in ('parent', 'student')
  and not exists (
    select 1
    from public.role_permissions existing
    where existing.role_id = r.id
      and existing.feature_id = f.id
      and existing.branch_id = b.id
  );
