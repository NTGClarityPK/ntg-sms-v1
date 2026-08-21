-- Invitation lifecycle: pending until password set; expired removes auth link.
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
CHECK (account_status IN ('active', 'pending_verification', 'link_expired'));

COMMENT ON COLUMN public.students.account_status IS 'active: can log in; pending_verification: invite sent, password not set; link_expired: invite expired, auth user removed';

ALTER TABLE public.students ALTER COLUMN user_id DROP NOT NULL;
