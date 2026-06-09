-- Add certificates to default permission seed for new branches (existing branches already backfilled)

-- Extend seed_default_role_permissions_rpc: append certificates rows in a follow-up if needed.
-- This migration only ensures feature exists (idempotent from main module migration).

insert into public.features (code, name)
values ('certificates', 'Certificates')
on conflict (code) do update set name = excluded.name;
