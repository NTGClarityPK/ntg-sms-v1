-- Soft-delete own messages for everyone (WhatsApp-style placeholder).
-- Remote applied via MCP; keep file in repo for local CLI / drift parity.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.messages.deleted_at IS 'When set, body/subject are not shown; all participants see a deleted placeholder.';

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON public.messages (conversation_id, created_at DESC);

DROP FUNCTION IF EXISTS public.last_message_preview_for_conversations(uuid[]);

CREATE FUNCTION public.last_message_preview_for_conversations(p_conversation_ids uuid[])
RETURNS TABLE (
  conversation_id uuid,
  subject text,
  body text,
  created_at timestamptz,
  message_type text,
  is_deleted boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    CASE WHEN m.deleted_at IS NOT NULL THEN ''::text ELSE m.subject END,
    CASE WHEN m.deleted_at IS NOT NULL THEN ''::text ELSE m.body END,
    m.created_at,
    m.message_type::text,
    (m.deleted_at IS NOT NULL)
  FROM messages m
  WHERE m.conversation_id = ANY(p_conversation_ids)
  ORDER BY m.conversation_id, m.created_at DESC;
$fn$;

GRANT EXECUTE ON FUNCTION public.last_message_preview_for_conversations(uuid[]) TO authenticated, service_role;
