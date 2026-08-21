-- Junction-table audits (e.g. user_roles) use composite identifiers like
-- "userId_roleId_branchId", which are not valid UUIDs. record_id is an opaque
-- entity key, so store it as text.
ALTER TABLE public.audit_logs
  ALTER COLUMN record_id TYPE text USING record_id::text;
