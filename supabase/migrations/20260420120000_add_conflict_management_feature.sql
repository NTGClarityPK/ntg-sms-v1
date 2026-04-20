-- Adds a dedicated permission feature for viewing timetable conflicts.
-- This drives Settings → Permission matrix → "Show tabs" and nav gating for /conflict-management.

insert into public.features (code, name)
values ('conflict_management', 'Conflicts')
on conflict (code) do update
set name = excluded.name;

