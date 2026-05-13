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

      const optimisticId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        conversationId,
        senderId: user.id,
        messageType: input.messageType ?? 'other',
        subject: input.subject ?? '',
        body: input.body ?? '',
        createdAt: new Date().toISOString(),
        isDeleted: false,
        isRead: true,
        senderName: user.fullName,
      };

      // Update ALL matching queries IMMEDIATELY (synchronous)
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
            return { ...prev, data: [optimisticMessage, ...list] };
          },
        );
      });

      queryClient.cancelQueries({ queryKey: ['conversation-messages', conversationId] }).catch(() => {});

      return { previousData, optimisticId };
    },
    onSuccess: (data, variables, context) => {
      if (!conversationId || !data) return;

      const optimisticId = context?.optimisticId as string | undefined;

      // Replace only this mutation's optimistic message with the real one (keeps other in-flight messages visible)
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
          // Already added by Realtime
          if (list.some((m) => m.id === data.id)) {
            const withoutThisTemp = optimisticId ? list.filter((m) => m.id !== optimisticId) : list;
            return { ...prev, data: withoutThisTemp };
          }
          if (optimisticId) {
            const next = list.map((m) => (m.id === optimisticId ? data : m));
            return { ...prev, data: next };
          }
          const filtered = list.filter((m) => !m.id.startsWith('temp-'));
          return { ...prev, data: [data, ...filtered] };
        },
      );

      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error, variables, context) => {
      const optimisticId = context?.optimisticId as string | undefined;
      if (optimisticId) {
        // Remove only the failed optimistic message so other in-flight messages stay
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
            if (!prev?.data) return prev;
            return { ...prev, data: prev.data.filter((m) => m.id !== optimisticId) };
          },
        );
      } else if (context?.previousData) {
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
      if (conversationId) {
        queryClient.setQueriesData(
          {
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              q.queryKey[0] === 'conversation-messages' &&
              q.queryKey[1] === conversationId,
          },
          (prev: { data?: Message[]; meta?: unknown } | null | undefined) => {
            if (!prev?.data?.length) return prev;
            return {
              ...prev,
              data: prev.data.map((m) => ({ ...m, isRead: true })),
            };
          },
        );
      }
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

/** Delete a conversation (removes it from the list and deletes all messages). */
export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      await apiClient.delete(`/api/v1/conversations/${conversationId}`);
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', branchId] });
      queryClient.removeQueries({ queryKey: ['conversation', conversationId] });
      queryClient.removeQueries({ queryKey: ['conversation-messages', conversationId] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete conversation';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    },
  });
}

/** Soft-delete one message for all participants (sender only). */
export function useDeleteMessage(conversationId: string | null) {
  const queryClient = useQueryClient();
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async (messageId: string) => {
      await apiClient.delete(`/api/v1/messages/${messageId}`);
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete message';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    },
  });
}

/** Clear all messages in the current conversation. */
export function useClearConversationMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  const notifyColors = useThemeColors();

  return useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('No conversation selected');
      await apiClient.delete(`/api/v1/conversations/${conversationId}/messages`);
    },
    onSuccess: () => {
      if (!conversationId) return;
      queryClient.setQueriesData(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'conversation-messages' &&
            query.queryKey[1] === conversationId,
        },
        () => ({ data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0 } }),
      );
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to clear messages';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    },
  });
}
