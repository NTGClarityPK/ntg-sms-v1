import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flushSync } from 'react-dom';
import type {
  SendSupportMessageInput,
  SupportConversation,
  SupportCoverage,
  SupportMessage,
  SupportMinutesSummary,
  SupportRealtimeToken,
  SupportUnreadSummary,
  SupportUploadResult,
  SupportUploadType,
} from '@/types/support';

function matchesSupportMessagesQuery(
  queryKey: readonly unknown[],
  branchId: string | undefined,
  conversationId: string,
): boolean {
  return (
    Array.isArray(queryKey) &&
    queryKey[0] === 'support-messages' &&
    queryKey[1] === branchId &&
    queryKey[2] === conversationId
  );
}

function karachiYearMonth(offsetMonths = 0): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? '2026');
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '1');
  const d = new Date(Date.UTC(year, month - 1 + offsetMonths, 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getSupportMonthKeys() {
  return {
    thisMonth: karachiYearMonth(0),
    lastMonth: karachiYearMonth(-1),
  };
}

/** Format English Reach inbox title: `New chat — 24 Aug 14:30` */
export function formatNewSupportChatTitle(date = new Date()): string {
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    day: '2-digit',
  }).format(date);
  const mon = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    month: 'short',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `New chat — ${day} ${mon} ${time}`;
}

export function useSupportCoverage() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['support-coverage', branchId],
    queryFn: async () => {
      const response = await apiClient.get<SupportCoverage>('/api/v1/support/coverage');
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 30 * 1000,
    refetchInterval: 30_000,
  });
}

export function useSupportMinutesSummary(month: string) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['support-minutes', branchId, month],
    queryFn: async () => {
      const response = await apiClient.get<SupportMinutesSummary>(
        `/api/v1/support/minutes-summary?month=${encodeURIComponent(month)}`,
      );
      return response.data;
    },
    enabled: !!branchId && !!month,
    staleTime: 60 * 1000,
  });
}

export function useSupportUnreadSummary(enabled = true) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['support-unread', branchId],
    queryFn: async () => {
      const response = await apiClient.get<SupportUnreadSummary>(
        '/api/v1/support/unread-summary',
      );
      return response.data;
    },
    enabled: enabled && !!branchId,
    staleTime: 10 * 1000,
    refetchInterval: 20_000,
  });
}

export function useSupportConversations() {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['support-conversations', branchId],
    queryFn: async () => {
      const response = await apiClient.get<SupportConversation[]>(
        '/api/v1/support/conversations?limit=100',
      );
      return response.data;
    },
    enabled: !!branchId,
    staleTime: 30 * 1000,
  });
}

export function useSupportMessages(
  conversationId: string | null,
  options?: { after?: string; refetchIntervalMs?: number | false },
) {
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useQuery({
    queryKey: ['support-messages', branchId, conversationId, options?.after ?? null],
    queryFn: async () => {
      if (!conversationId) return [];
      const params = new URLSearchParams({ limit: '200' });
      if (options?.after) params.set('after', options.after);
      const response = await apiClient.get<SupportMessage[]>(
        `/api/v1/support/conversations/${conversationId}/messages?${params.toString()}`,
      );
      return response.data;
    },
    enabled: !!branchId && !!conversationId,
    staleTime: 5 * 1000,
    refetchInterval:
      options?.refetchIntervalMs === false || options?.refetchIntervalMs == null
        ? false
        : options.refetchIntervalMs,
  });
}

export function useCreateSupportConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (title?: string) => {
      const response = await apiClient.post<SupportConversation>(
        '/api/v1/support/conversations',
        { title: title ?? formatNewSupportChatTitle() },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support-conversations', branchId] });
    },
  });
}

export function useSendSupportMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (input: SendSupportMessageInput) => {
      const response = await apiClient.post<SupportMessage>('/api/v1/support/messages', input);
      return response.data;
    },
    onMutate: async (input) => {
      if (!user?.id) return;

      const previousEntries = queryClient.getQueriesData<SupportMessage[]>({
        predicate: (query) =>
          matchesSupportMessagesQuery(query.queryKey, branchId, input.conversationId),
      });

      const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticMessage: SupportMessage = {
        id: optimisticId,
        conversationId: input.conversationId,
        senderId: user.id,
        senderType: 'customer',
        senderDisplayName: user.fullName ?? null,
        messageType: input.messageType,
        content: input.content ?? null,
        fileUrl: input.fileUrl ?? null,
        createdAt: new Date().toISOString(),
        readAt: null,
        expiresAt: input.expiresAt ?? null,
      };

      flushSync(() => {
        queryClient.setQueriesData<SupportMessage[]>(
          {
            predicate: (query) =>
              matchesSupportMessagesQuery(query.queryKey, branchId, input.conversationId),
          },
          (prev) => {
            const list = prev ?? [];
            if (list.some((m) => m.id === optimisticId)) return list;
            return [...list, optimisticMessage];
          },
        );
      });

      void queryClient.cancelQueries({
        predicate: (query) =>
          matchesSupportMessagesQuery(query.queryKey, branchId, input.conversationId),
      });

      return { previousEntries, optimisticId };
    },
    onSuccess: (data, variables, context) => {
      const optimisticId = context?.optimisticId;
      if (data) {
        queryClient.setQueriesData<SupportMessage[]>(
          {
            predicate: (query) =>
              matchesSupportMessagesQuery(query.queryKey, branchId, variables.conversationId),
          },
          (prev) => {
            const list = prev ?? [];
            if (list.some((m) => m.id === data.id)) {
              return optimisticId ? list.filter((m) => m.id !== optimisticId) : list;
            }
            if (optimisticId) {
              return list.map((m) => (m.id === optimisticId ? data : m));
            }
            return [...list.filter((m) => !m.id.startsWith('temp-')), data];
          },
        );
      }
      void queryClient.invalidateQueries({ queryKey: ['support-conversations', branchId] });
    },
    onError: (_error, variables, context) => {
      const optimisticId = context?.optimisticId;
      if (optimisticId) {
        queryClient.setQueriesData<SupportMessage[]>(
          {
            predicate: (query) =>
              matchesSupportMessagesQuery(query.queryKey, branchId, variables.conversationId),
          },
          (prev) => (prev ? prev.filter((m) => m.id !== optimisticId) : prev),
        );
        return;
      }
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
  });
}

export function useUploadSupportFile() {
  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      messageType: SupportUploadType;
      file: Blob;
      fileName: string;
    }) => {
      const form = new FormData();
      form.append('conversationId', input.conversationId);
      form.append('messageType', input.messageType);
      form.append('file', input.file, input.fileName);
      const response = await apiClient.post<SupportUploadResult>(
        '/api/v1/support/uploads',
        form,
      );
      return response.data;
    },
  });
}

export function useMarkSupportConversationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await apiClient.post<{ ok: true }>(
        `/api/v1/support/conversations/${conversationId}/mark-read`,
        {},
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support-unread', branchId] });
    },
  });
}

export function useNoteSupportAgentActivity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (input: { conversationId: string; at?: string }) => {
      const response = await apiClient.post<{ ok: true }>(
        `/api/v1/support/conversations/${input.conversationId}/note-agent-activity`,
        input.at ? { at: input.at } : {},
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support-unread', branchId] });
      void queryClient.invalidateQueries({ queryKey: ['support-conversations', branchId] });
    },
  });
}

export function useSupportRealtimeToken() {
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await apiClient.post<SupportRealtimeToken>(
        '/api/v1/support/realtime-token',
        { conversationId },
      );
      return response.data;
    },
  });
}

export function useDeleteSupportMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  return useMutation({
    mutationFn: async (input: { messageId: string; conversationId: string }) => {
      const response = await apiClient.delete<{ ok: true }>(
        `/api/v1/support/messages/${input.messageId}`,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['support-messages', branchId, variables.conversationId],
      });
    },
  });
}
