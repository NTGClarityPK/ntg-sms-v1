import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';

export function useResendInvitationForUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      userId: string;
      invitationType: 'student' | 'parent' | 'parent_account' | 'staff';
      recipientEmail?: string;
    }) => {
      const res = await apiClient.post<{ token: string; expiresAt: string }>(
        '/api/v1/invitations/resend-for-user',
        input,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      notifications.show({
        title: 'Success',
        message: 'Invitation resent successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to resend invitation',
        color: 'red',
      });
    },
  });
}

