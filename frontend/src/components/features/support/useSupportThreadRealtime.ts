'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import {
  useNoteSupportAgentActivity,
  useSupportRealtimeToken,
} from '@/hooks/api/useSupport';
import type { SupportMessage } from '@/types/support';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

type ReachMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'customer' | 'agent';
  sender_display_name: string | null;
  message_type: SupportMessage['messageType'];
  content: string | null;
  file_url: string | null;
  created_at: string;
  read_at: string | null;
  expires_at: string | null;
};

function mapRow(row: ReachMessageRow): SupportMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderType: row.sender_type,
    senderDisplayName: row.sender_display_name,
    messageType: row.message_type,
    content: row.content,
    fileUrl: row.file_url,
    createdAt: row.created_at,
    readAt: row.read_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Subscribe to Reach support_messages for an open conversation.
 * Returns whether the page should poll as fallback.
 */
export function useSupportThreadRealtime(
  conversationId: string | null,
  onMessage: (message: SupportMessage) => void,
): { usePollFallback: boolean } {
  const tokenMutation = useSupportRealtimeToken();
  const noteAgent = useNoteSupportAgentActivity();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const [usePollFallback, setUsePollFallback] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setUsePollFallback(true);
      return;
    }

    let cancelled = false;
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    setUsePollFallback(true);

    const cleanup = () => {
      if (refreshTimer) clearInterval(refreshTimer);
      if (channel && client) {
        void client.removeChannel(channel);
      }
      channel = null;
      client = null;
    };

    const connect = async () => {
      try {
        const token = await tokenMutation.mutateAsync(conversationId);
        if (cancelled) return;

        if (token.mode === 'poll') {
          setUsePollFallback(true);
          return;
        }

        client = createClient(token.supabaseUrl, token.supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await client.realtime.setAuth(token.accessToken);

        channel = client
          .channel(`alma-support:${conversationId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'support_messages',
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
              const row = payload.new as ReachMessageRow;
              const message = mapRow(row);
              onMessageRef.current(message);
              if (message.senderType === 'agent') {
                void noteAgent.mutateAsync({
                  conversationId,
                  at: message.createdAt,
                });
              }
              void queryClient.invalidateQueries({
                queryKey: ['support-messages', branchId, conversationId],
              });
              void queryClient.invalidateQueries({
                queryKey: ['support-conversations', branchId],
              });
              void queryClient.invalidateQueries({
                queryKey: ['support-unread', branchId],
              });
            },
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setUsePollFallback(false);
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setUsePollFallback(true);
            }
          });

        const refreshMs = Math.max(60_000, (token.refreshAfterSeconds || 300) * 1000);
        refreshTimer = setInterval(() => {
          void (async () => {
            try {
              const next = await tokenMutation.mutateAsync(conversationId);
              if (cancelled || next.mode !== 'realtime' || !client) {
                setUsePollFallback(true);
                return;
              }
              await client.realtime.setAuth(next.accessToken);
            } catch {
              setUsePollFallback(true);
            }
          })();
        }, refreshMs);
      } catch {
        setUsePollFallback(true);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      cleanup();
    };
    // Intentionally only re-bind when conversation changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, branchId]);

  return { usePollFallback };
}
