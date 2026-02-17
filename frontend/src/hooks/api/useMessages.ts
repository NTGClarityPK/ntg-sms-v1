import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flushSync } from 'react-dom';
import { apiClient } from '@/lib/api-client';
import type {
  Conversation,
  ConversationListItem,
  Message,
  CreateMessageInput,
  CreateConversationInput,
} from '@/types/messages';
import { useAuth } from '@/hooks/useAuth';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { QueryKey } from '@tanstack/react-query';

interface QueryConversationsParams {
  page?: number;
  limit?: number;
}

interface QueryMessagesParams {
  page?: number;
  limit?: number;
}

/** List conversations for current user (paginated). Returns full response: { data, meta }. */
export function useConversations(params: QueryConversationsParams = {}) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['conversations', branchId, params],
    queryFn: async () => {
      if (!branchId) return null;
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      const response = await apiClient.get<ConversationListItem[]>(
        `/api/v1/conversations?${searchParams.toString()}`,
      );
      return response;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

/** Get a single conversation by id. Returns conversation (response.data). */
export function useConversation(conversationId: string | null) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['conversation', conversationId, branchId],
    queryFn: async () => {
      if (!conversationId || !branchId) return null;
      const response = await apiClient.get<Conversation>(
        `/api/v1/conversations/${conversationId}`,
      );
      return (response as { data?: Conversation })?.data ?? null;
    },
    enabled: !!conversationId && !!branchId,
    staleTime: 2 * 60 * 1000,
  });
}

/** List messages in a conversation (paginated). Returns full response: { data, meta }. */
export function useConversationMessages(
  conversationId: string | null,
  params: QueryMessagesParams = {},
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['conversation-messages', conversationId, params],
    queryFn: async () => {
      if (!conversationId) return null;
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      const response = await apiClient.get<Message[]>(
        `/api/v1/conversations/${conversationId}/messages?${searchParams.toString()}`,
      );
      return response;
    },
    enabled: !!conversationId,
    staleTime: 2 * 60 * 1000,
  });
}

/** Send a message in a conversation. */
export function useSendMessage(conversationId: string | null) {
  const queryClient = useQueryClient();
  const notifyColors = useThemeColors();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateMessageInput) => {
      if (!conversationId) throw new Error('No conversation selected');
      const response = await apiClient.post<Message>(
        `/api/v1/conversations/${conversationId}/messages`,
        input,
      );
      return (response as { data?: Message })?.data;
    },
    onMutate: async (input) => {
      if (!conversationId || !user?.id) return;

      // Snapshot previous value for rollback (synchronous)
      const previousData = queryClient.getQueriesData({
        queryKey: ['conversation-messages', conversationId],
      });

      // Optimistically add message to cache IMMEDIATELY (synchronous)
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId,
        senderId: user.id,
        messageType: input.messageType ?? 'other',
        subject: input.subject ?? '',
        body: input.body ?? '',
        createdAt: new Date().toISOString(),
        isRead: true,
        senderName: user.fullName,
      };

      // Update ALL matching queries IMMEDIATELY (synchronous)
      // Use flushSync to ensure React processes the update synchronously and triggers immediate re-render
      flushSync(() => {
        queryClient.setQueriesData(
          {
            predicate: (query) => {
              const key = query.queryKey;
              return (
                Array.isArray(key) &&
                key.length >= 2 &&
                key[0] === 'conversation-messages' &&
                key[1] === conversationId
              );
            },
          },
          (prev: { data?: Message[]; meta?: unknown } | null | undefined) => {
            if (!prev) {
              return { data: [optimisticMessage], meta: undefined };
            }
            const list = prev.data ?? [];
            // Create new array reference to ensure React Query detects the change
            return { ...prev, data: [...list, optimisticMessage] };
          },
        );
      });

      // Cancel outgoing refetches AFTER optimistic update (non-blocking)
      queryClient.cancelQueries({ queryKey: ['conversation-messages', conversationId] }).catch(() => {});

      return { previousData };
    },
    onSuccess: (data, variables, context) => {
      if (!conversationId || !data) return;

      // Replace optimistic message with real one from server
      queryClient.setQueriesData(
        {
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key.length >= 2 &&
              key[0] === 'conversation-messages' &&
              key[1] === conversationId
            );
          },
        },
        (prev: { data?: Message[]; meta?: unknown } | null | undefined) => {
          if (!prev) return { data: [data], meta: undefined };
          const list = prev.data ?? [];
          
          // Check if real message already exists (from Realtime)
          if (list.some((m) => m.id === data.id)) {
            // Already added by Realtime, just remove any temp messages
            const filtered = list.filter((m) => !m.id.startsWith('temp-'));
            return { ...prev, data: filtered };
          }
          
          // Replace optimistic message(s) with real one
          const filtered = list.filter((m) => !m.id.startsWith('temp-'));
          return { ...prev, data: [...filtered, data] };
        },
      );

      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      const message = error instanceof Error ? error.message : 'Failed to send message';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    },
  });
}

/** Mark a message as read. */
export function useMarkMessageRead() {
  const queryClient = useQueryClient();
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const response = await apiClient.put<Message>(
        `/api/v1/messages/${messageId}/read`,
        {},
      );
      return (response as { data?: Message })?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to mark as read';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    },
  });
}

/** Mark all messages in a conversation as read for the current user (e.g. when viewing the thread). */
export function useMarkConversationRead(conversationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!conversationId) return;
      await apiClient.put(`/api/v1/conversations/${conversationId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/** Create a new conversation (one_to_one or broadcast). */
export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (input: CreateConversationInput) => {
      const response = await apiClient.post<Conversation>(
        '/api/v1/conversations',
        input,
      );
      return (response as { data?: Conversation })?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', branchId] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create conversation';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    },
  });
}
