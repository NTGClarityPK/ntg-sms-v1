import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['support-messages', branchId, variables.conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ['support-conversations', branchId] });
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
