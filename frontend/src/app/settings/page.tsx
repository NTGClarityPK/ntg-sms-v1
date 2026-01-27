'use client';

import { Button, Card, Group, SimpleGrid, Stack, Text, Title, Loader, Alert } from '@mantine/core';
import Link from 'next/link';
import { useDisclosure } from '@mantine/hooks';
import { useSettingsStatus } from '@/hooks/useSettingsStatus';
import { useTenantBranches } from '@/hooks/useBranches';
import { SetupWizard } from '@/components/features/settings/SetupWizard';
import { CopySettingsModal } from '@/components/features/settings/CopySettingsModal';
import { useSaveSetupWizard } from '@/hooks/useSetupWizard';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useQueryClient } from '@tanstack/react-query';
import { IconRocket, IconCopy } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';

export default function SettingsPage() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [wizardOpened, { open: openWizard, close: closeWizard }] = useDisclosure(false);
  const [copyModalOpened, { open: openCopyModal, close: closeCopyModal }] = useDisclosure(false);
  const statusQuery = useSettingsStatus();
  const branchesQuery = useTenantBranches();
  const saveWizard = useSaveSetupWizard();
  const qc = useQueryClient();

  const hasCurrentBranch = !!user?.currentBranch?.id;
  const isInitialized = statusQuery.data?.data?.isInitialized ?? false;
  const branches = branchesQuery.data?.data ?? [];
  const hasMultipleBranches = branches.length > 1;

  const handleWizardComplete = async () => {
    // The wizard data is saved in useSaveSetupWizard hook
    // We just need to refresh the status
    await qc.invalidateQueries({ queryKey: ['settingsStatus'] });
    closeWizard();
  };

  const handleCopySuccess = () => {
    void qc.invalidateQueries({ queryKey: ['settingsStatus'] });
  };

  // Show message if no branch is selected
  if (!hasCurrentBranch) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>Settings</Title>
          </Group>
        </div>
        <Alert color={colors.warning} title="No Branch Selected">
          <Text size="sm">
            Please select a branch from the branch switcher in the header to access settings.
          </Text>
        </Alert>
      </>
    );
  }

  if (statusQuery.isLoading || branchesQuery.isLoading) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>Settings</Title>
          </Group>
        </div>
        <Group justify="center" py="xl">
          <Loader color={colors.primary} />
        </Group>
      </>
    );
  }

  if (statusQuery.error) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>Settings</Title>
          </Group>
        </div>
        <Alert color={colors.error} title="Failed to load settings status">
          <Text size="sm">Please try again. If the issue persists, ensure you have access to the selected branch.</Text>
        </Alert>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Settings</Title>
          {!isInitialized && (
            <Group gap="sm">
              {hasMultipleBranches && (
                <Button
                  variant="light"
                  leftSection={<IconCopy size={16} />}
                  onClick={openCopyModal}
                >
                  Copy Settings from Other Branch
                </Button>
              )}
              <Button
                leftSection={<IconRocket size={16} />}
                onClick={openWizard}
                color={colors.primary}
              >
                Start School Setup
              </Button>
            </Group>
          )}
        </Group>
      </div>

      <Stack gap="md">
        {!isInitialized && (
          <Alert color={colors.info} title="Setup Required">
            <Text size="sm">
              Your school settings are not yet configured. Click "Start School Setup" to begin the guided setup process,
              or copy settings from another branch if available.
            </Text>
          </Alert>
        )}

        <Text c="dimmed">Configure the core system settings used across the application.</Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" style={{ opacity: isInitialized ? 1 : 0.6 }}>
          <Card component={Link} href="/settings/permissions" withBorder p="md">
            <Title order={3}>Permissions</Title>
            <Text c="dimmed" size="sm">
              Configure role-based permissions for each feature.
            </Text>
          </Card>

          <Card component={Link} href="/settings/academic-years" withBorder p="md">
            <Title order={3}>Academic years</Title>
            <Text c="dimmed" size="sm">
              Create, activate, and lock academic years.
            </Text>
          </Card>

          <Card component={Link} href="/settings/academic" withBorder p="md">
            <Title order={3}>Academic</Title>
            <Text c="dimmed" size="sm">
              Subjects, classes, sections, and levels.
            </Text>
          </Card>

          <Card component={Link} href="/settings/schedule" withBorder p="md">
            <Title order={3}>Schedule</Title>
            <Text c="dimmed" size="sm">
              School days, timing templates, and holidays.
            </Text>
          </Card>

          <Card component={Link} href="/settings/assessment" withBorder p="md">
            <Title order={3}>Assessment</Title>
            <Text c="dimmed" size="sm">
              Assessment types, grade templates, and leave quota.
            </Text>
          </Card>

          <Card component={Link} href="/settings/communication" withBorder p="md">
            <Title order={3}>Communication</Title>
            <Text c="dimmed" size="sm">
              Messaging direction and library categories.
            </Text>
          </Card>

          <Card component={Link} href="/settings/behavior" withBorder p="md">
            <Title order={3}>Behavior</Title>
            <Text c="dimmed" size="sm">
              Behavioral assessment settings and attributes.
            </Text>
          </Card>
        </SimpleGrid>
      </Stack>

      <SetupWizard
        opened={wizardOpened}
        onClose={closeWizard}
        onComplete={handleWizardComplete}
      />

      <CopySettingsModal
        opened={copyModalOpened}
        onClose={closeCopyModal}
        onSuccess={handleCopySuccess}
      />
    </>
  );
}


