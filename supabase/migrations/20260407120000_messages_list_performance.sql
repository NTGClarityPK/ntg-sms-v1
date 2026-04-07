-- Batched helpers for conversation list + mark-read to avoid loading every message id into the app.

CREATE OR REPLACE FUNCTION public.last_message_preview_for_conversations(p_conversation_ids uuid[])
RETURNS TABLE (
  conversation_id uuid,
  subject text,
  body text,
  created_at timestamptz,
  message_type text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.subject,
    m.body,
    m.created_at,
    m.message_type::text
  FROM messages m
  WHERE m.conversation_id = ANY(p_conversation_ids)
  ORDER BY m.conversation_id, m.created_at DESC;
$fn$;

CREATE OR REPLACE FUNCTION public.count_unread_per_conversation(
  p_conversation_ids uuid[],
  p_user_id uuid
)
RETURNS TABLE (
  conversation_id uuid,
  unread_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT m.conversation_id, COUNT(*)::bigint AS unread_count
  FROM message_reads mr
  INNER JOIN messages m ON m.id = mr.message_id
  WHERE m.conversation_id = ANY(p_conversation_ids)
    AND mr.user_id = p_user_id
    AND mr.read_at IS NULL
  GROUP BY m.conversation_id;
$fn$;

CREATE OR REPLACE FUNCTION public.mark_conversation_messages_read(
  p_conversation_id uuid,
  p_user_id uuid,
  p_now timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $fn$
  UPDATE message_reads mr
  SET read_at = p_now
  FROM messages m
  WHERE mr.message_id = m.id
    AND m.conversation_id = p_conversation_id
    AND mr.user_id = p_user_id
    AND mr.read_at IS NULL;
$fn$;

GRANT EXECUTE ON FUNCTION public.last_message_preview_for_conversations(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_unread_per_conversation(uuid[], uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_conversation_messages_read(uuid, uuid, timestamptz) TO authenticated, service_role;
