'use client';

import { Alert, Button, Group, Loader, Modal, Select, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { useBranchesWithSettings, useCopySettingsFromBranch } from '@/hooks/useSettingsStatus';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';

interface CopySettingsModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CopySettingsModal({ opened, onClose, onSuccess }: CopySettingsModalProps) {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const branchesWithSettingsQuery = useBranchesWithSettings();
  const copyMutation = useCopySettingsFromBranch();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const branchesWithSettings = branchesWithSettingsQuery.data?.data ?? [];

  const handleCopy = async () => {
    if (!selectedBranchId) return;

    try {
      await copyMutation.mutateAsync(selectedBranchId);
      notifications.show({
        title: 'Success',
        message: 'Settings copied successfully',
        color: notifyColors.success,
      });
      onSuccess();
      onClose();
      setSelectedBranchId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({
        title: 'Error',
        message,
        color: notifyColors.error,
      });
    }
  };

  if (branchesWithSettingsQuery.isLoading) {
    return (
      <Modal opened={opened} onClose={onClose} title="Copy Settings from Other Branch" size="md">
        <Stack gap="md" align="center" py="xl">
          <Loader color={colors.primary} />
          <Text size="sm" c="dimmed">
            Checking available branches...
          </Text>
        </Stack>
      </Modal>
    );
  }

  if (branchesWithSettingsQuery.error) {
    return (
      <Modal opened={opened} onClose={onClose} title="Copy Settings from Other Branch" size="md">
        <Alert color={colors.error} title="Error">
          <Text size="sm">
            Failed to load branches. Please try again.
          </Text>
        </Alert>
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Modal>
    );
  }

  if (branchesWithSettings.length === 0) {
    return (
      <Modal opened={opened} onClose={onClose} title="Copy Settings from Other Branch" size="md">
        <Stack gap="md">
          <Alert color={colors.info} title="No Branches Available">
            <Text size="sm">
              No other branches have settings configured yet. Please configure settings for at least one branch first.
            </Text>
          </Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={onClose}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Copy Settings from Other Branch" size="md">
      <Stack gap="md">
        <Alert color={colors.warning} title="Warning">
          <Text size="sm">
            This will overwrite all existing settings for this branch. Are you sure you want to continue?
          </Text>
        </Alert>

        <Select
          label="Source Branch"
          placeholder="Select a branch to copy settings from"
          data={branchesWithSettings.map((b) => ({
            value: b.id,
            label: b.name || b.code || b.id,
          }))}
          value={selectedBranchId}
          onChange={(value) => setSelectedBranchId(value)}
          disabled={copyMutation.isPending}
        />

        <Text size="sm" c="dimmed">
          All settings from the selected branch will be copied to the current branch, including:
          subjects, classes, sections, levels, timing templates, assessment types, grade templates,
          communication settings, behavior settings, and permissions.
        </Text>

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose} disabled={copyMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            color={colors.primary}
            disabled={!selectedBranchId || copyMutation.isPending}
            loading={copyMutation.isPending}
          >
            Replicate Settings
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

