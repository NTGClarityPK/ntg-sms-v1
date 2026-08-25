-- Campus-shared unread tracking for Reach Support chats (Alma DB, not Reach).
-- Nest service role writes; RLS restricts direct client access to branch members.

CREATE TABLE public.support_conversation_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NULL,
  last_agent_message_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_conversation_reads_tenant_branch_conversation_uid
    UNIQUE (tenant_id, branch_id, conversation_id)
);

CREATE INDEX idx_support_conversation_reads_branch
  ON public.support_conversation_reads (branch_id);

CREATE INDEX idx_support_conversation_reads_unread
  ON public.support_conversation_reads (branch_id, tenant_id)
  WHERE last_agent_message_at IS NOT NULL;

COMMENT ON TABLE public.support_conversation_reads IS
  'Campus-shared read/agent-activity markers for Reach support conversations';

ALTER TABLE public.support_conversation_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_conversation_reads_branch_isolation
  ON public.support_conversation_reads
  FOR ALL
  USING (
    branch_id IN (
      SELECT ub.branch_id
      FROM public.user_branches ub
      WHERE ub.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    branch_id IN (
      SELECT ub.branch_id
      FROM public.user_branches ub
      WHERE ub.user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.update_support_conversation_reads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_conversation_reads_updated_at
  BEFORE UPDATE ON public.support_conversation_reads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_conversation_reads_updated_at();
