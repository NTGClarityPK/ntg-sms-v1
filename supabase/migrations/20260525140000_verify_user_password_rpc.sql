-- Verify password without creating a new auth session (avoids logging out other clients).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.verify_user_password(p_user_id uuid, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  stored text;
BEGIN
  IF p_password IS NULL OR length(trim(p_password)) = 0 THEN
    RETURN false;
  END IF;

  SELECT encrypted_password INTO stored
  FROM auth.users
  WHERE id = p_user_id
    AND deleted_at IS NULL;

  IF stored IS NULL OR stored = '' THEN
    RETURN false;
  END IF;

  RETURN stored = crypt(p_password, stored);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_user_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_user_password(uuid, text) TO service_role;
