-- Enforce mandatory + unique tenant domains (case-insensitive).
-- NOTE: production data may have missing/duplicate domains; fill/de-dupe those before applying this migration.

ALTER TABLE public.tenants
  ALTER COLUMN domain SET NOT NULL;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_domain_format_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_domain_format_check
  CHECK (
    domain !~* '@' AND
    domain !~ '[[:space:]]' AND
    domain ~* '^[a-z0-9]([a-z0-9-]*[a-z0-9])?([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  );

DROP INDEX IF EXISTS public.tenants_domain_lower_uq;
CREATE UNIQUE INDEX tenants_domain_lower_uq ON public.tenants (lower(domain));

