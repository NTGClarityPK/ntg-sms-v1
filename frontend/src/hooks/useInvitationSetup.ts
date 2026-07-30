import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type InvitationSetupInfo = {
  invitationId: string;
  invitationType: 'student' | 'parent' | 'parent_account' | 'staff';
  loginEmail: string;
  name: string;
  expiresAt: string;
};

export function useInvitationInfo(token: string | null) {
  return useQuery({
    queryKey: ['invitations', 'setup', token],
    queryFn: async () => {
      if (!token) return null;
      const res = await apiClient.get<InvitationSetupInfo>(`/api/v1/invitations/setup/${token}`);
      return res.data;
    },
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

export function useSetInvitationPassword(token: string | null) {
  return useMutation({
    mutationFn: async (input: { password: string }) => {
      if (!token) throw new Error('Missing token');
      const res = await apiClient.post<{ success: true }>(
        `/api/v1/invitations/setup/${token}`,
        input,
      );
      return res.data;
    },
  });
}

