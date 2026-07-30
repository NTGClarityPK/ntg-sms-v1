-- Tenant-aware language defaults:
-- - tenants.default_locale (NOT NULL, default en-GB)
-- - profiles.preferred_locale becomes nullable with no DB default (NULL = inherit tenant)

-- Ensure preferred_locale exists for environments that only have live schema drift
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_locale VARCHAR(5);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_locale_check
  CHECK (
    preferred_locale IS NULL
    OR preferred_locale IN ('en', 'en-US', 'en-GB', 'ar')
  );

-- Legacy bare English → en-GB
UPDATE public.profiles
SET preferred_locale = 'en-GB'
WHERE preferred_locale = 'en';

-- Legacy Arabic DB default cannot be distinguished from intentional Arabic;
-- product decision: clear to NULL so users inherit their tenant default.
UPDATE public.profiles
SET preferred_locale = NULL
WHERE preferred_locale = 'ar';

ALTER TABLE public.profiles
  ALTER COLUMN preferred_locale DROP DEFAULT;

COMMENT ON COLUMN public.profiles.preferred_locale IS
  'User UI language override. NULL means inherit the current tenant default_locale.';

-- Tenant school-wide default language
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS default_locale VARCHAR(5) NOT NULL DEFAULT 'en-GB';

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_default_locale_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_default_locale_check
  CHECK (default_locale IN ('en-GB', 'en-US', 'ar'));

UPDATE public.tenants
SET default_locale = 'en-GB'
WHERE default_locale IS NULL
   OR default_locale NOT IN ('en-GB', 'en-US', 'ar');

COMMENT ON COLUMN public.tenants.default_locale IS
  'School default UI language for users without a personal preferred_locale override.';
