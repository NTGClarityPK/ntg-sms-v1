import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import type { SetupWizardData } from '@/components/features/settings/wizard-steps/types';
import { validateSetupWizardDataBeforeSave } from '@/lib/setup-wizard/validate-setup-wizard-data';
import { notifications } from '@mantine/notifications';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';

export function useSaveSetupWizard() {
  const qc = useQueryClient();
  const locale = useLocale();
  const notifyColors = useNotificationColors();

  return useMutation({
    mutationFn: async (data: SetupWizardData) => {
      validateSetupWizardDataBeforeSave(data);
      const res = await apiClient.post<{ success: boolean; academicYearId?: string | null }>(
        '/api/v1/setup-wizard/commit',
        data,
        { params: { language: locale } },
      );
      return res.data;
    },
    onSuccess: async () => {
      // Setup can create users/roles and update session context. If we only invalidate, some screens can still
      // render cached data (staleTime) and show "None" for roles until a hard refresh. Remove + refetch fixes it.
      qc.removeQueries({ queryKey: ['users'] });
      qc.removeQueries({ queryKey: ['roles'] });
      qc.removeQueries({ queryKey: ['auth', 'me'] });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['settingsStatus'] }),
        qc.invalidateQueries({ queryKey: ['permissions'] }),
        qc.invalidateQueries({ queryKey: ['features'] }),
        qc.invalidateQueries({ queryKey: ['academicYears'] }),
        qc.invalidateQueries({ queryKey: ['subjects'] }),
        qc.invalidateQueries({ queryKey: ['classes'] }),
        qc.invalidateQueries({ queryKey: ['sections'] }),
        qc.invalidateQueries({ queryKey: ['levels'] }),
        qc.invalidateQueries({ queryKey: ['schedule'] }),
        qc.invalidateQueries({ queryKey: ['assessment'] }),
        qc.invalidateQueries({ queryKey: ['systemSettings'] }),
        // Force immediate session refresh so branch/roles are correct without reload.
        qc.refetchQueries({ queryKey: ['auth', 'me'] }),
      ]);
      notifications.show({
        title: 'Success',
        message: 'All settings saved successfully',
        color: notifyColors.success,
      });
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save settings',
        color: notifyColors.error,
      });
    },
  });
}

