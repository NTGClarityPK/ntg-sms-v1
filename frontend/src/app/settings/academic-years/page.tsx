'use client';

import { Alert, Button, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { AcademicYearForm, type AcademicYearFormValues } from '@/components/features/settings/AcademicYearForm';
import { AcademicYearCard } from '@/components/features/settings/AcademicYearCard';
import { useAcademicYearsList, useActivateAcademicYear, useCreateAcademicYear, useLockAcademicYear } from '@/hooks/useAcademicYears';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';

export default function AcademicYearsPage() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);

  const listQuery = useAcademicYearsList({ page: 1, limit: 50, search: '' });
  const createMutation = useCreateAcademicYear();
  const activateMutation = useActivateAcademicYear();
  const lockMutation = useLockAcademicYear();

  const handleCreate = async (values: AcademicYearFormValues) => {
    await createMutation.mutateAsync(values);
  };

  const handleActivate = async (id: string) => {
    try {
      await activateMutation.mutateAsync(id);
      notifications.show({ title: 'Success', message: 'Academic year activated', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleLock = async (id: string) => {
    try {
      await lockMutation.mutateAsync(id);
      notifications.show({ title: 'Success', message: 'Academic year locked', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Academic Years</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Create
          </Button>
        </Group>
      </div>

      <Stack gap="md">
        {listQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader color={colors.primary} />
          </Group>
        ) : listQuery.error ? (
          <Alert color={colors.error} title="Failed to load academic years">
            <Group justify="space-between" mt="sm">
              <Text size="sm">Please try again.</Text>
              <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
                Retry
              </Button>
            </Group>
          </Alert>
        ) : (listQuery.data?.data?.length ?? 0) === 0 ? (
          <Alert color={colors.info} title="No academic years yet">
            <Text size="sm">Create your first academic year to start configuring the system.</Text>
          </Alert>
        ) : (
          <Stack gap="md">
            {listQuery.data?.data.map((year) => (
              <AcademicYearCard
                key={year.id}
                year={year}
                onActivate={handleActivate}
                onLock={handleLock}
                isActivating={activateMutation.isPending}
                isLocking={lockMutation.isPending}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <AcademicYearForm
        opened={opened}
        onClose={close}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
      />
    </>
  );
}


