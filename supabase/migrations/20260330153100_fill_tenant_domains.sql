-- One-time data migration to ensure every tenant has a unique, normalised domain.
-- This is required before enforcing NOT NULL + unique constraints on public.tenants.domain.

-- Normalise existing domains
UPDATE public.tenants
SET domain = lower(btrim(domain))
WHERE domain IS NOT NULL;

-- Fill missing domains deterministically (based on code/id)
WITH base AS (
  SELECT
    id,
    COALESCE(
      NULLIF(lower(regexp_replace(COALESCE(code, ''), '[^a-z0-9]+', '', 'g')), ''),
      substr(replace(id::text, '-', ''), 1, 10)
    ) AS slug
  FROM public.tenants
  WHERE domain IS NULL OR btrim(domain) = ''
), numbered AS (
  SELECT
    id,
    slug,
    row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
  FROM base
)
UPDATE public.tenants t
SET domain = lower(CASE
  WHEN n.rn = 1 THEN n.slug || '.ntg.local'
  ELSE n.slug || '-' || n.rn::text || '.ntg.local'
END)
FROM numbered n
WHERE t.id = n.id;

-- De-dupe any remaining collisions by suffixing the left-most label
WITH ranked AS (
  SELECT
    id,
    lower(btrim(domain)) AS d,
    split_part(lower(btrim(domain)), '.', 1) AS first_label,
    regexp_replace(lower(btrim(domain)), '^([^\\.]+)\\.', '') AS rest,
    substr(replace(id::text, '-', ''), 1, 4) AS id4,
    row_number() OVER (PARTITION BY lower(btrim(domain)) ORDER BY id) AS rn,
    count(*) OVER (PARTITION BY lower(btrim(domain))) AS cnt
  FROM public.tenants
  WHERE domain IS NOT NULL AND btrim(domain) <> ''
)
UPDATE public.tenants t
SET domain = r.first_label || '-' || r.id4 || '.' || r.rest
FROM ranked r
WHERE t.id = r.id AND r.cnt > 1 AND r.rn > 1;

-- Final normalise
UPDATE public.tenants
SET domain = lower(btrim(domain))
WHERE domain IS NOT NULL;

