-- Backfill id_cards permissions for common admin roles on existing branches

insert into public.role_permissions (role_id, feature_id, permission, branch_id, updated_at, created_by, updated_by)
select
  r.id,
  f.id,
  case when r.name in ('school_admin', 'principal', 'academic_coordinator') then 'edit' else 'view' end,
  b.id,
  now(),
  'migration',
  'migration'
from public.roles r
cross join public.features f
cross join public.branches b
where f.code = 'id_cards'
  and r.name in ('school_admin', 'principal', 'academic_coordinator', 'admin_assistant')
  and not exists (
    select 1
    from public.role_permissions rp
    where rp.role_id = r.id
      and rp.feature_id = f.id
      and rp.branch_id = b.id
  );
