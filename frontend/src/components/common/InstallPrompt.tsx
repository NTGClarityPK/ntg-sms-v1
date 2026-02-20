'use client';

import { Button, Modal, Text, Group } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useInstallApp } from '@/lib/install-app-context';

export function InstallPrompt() {
  const colors = useThemeColors();
  const {
    promptInstall,
    canInstallDirectly,
    isInstalled,
    installPromptDismissed,
    setInstallPromptDismissed,
  } = useInstallApp();

  const showPrompt = canInstallDirectly && !isInstalled && !installPromptDismissed;

  const handleInstall = async () => {
    await promptInstall();
  };

  const handleDismiss = () => {
    setInstallPromptDismissed(true);
  };

  if (!showPrompt) return null;

  return (
    <Modal
      opened={showPrompt}
      onClose={handleDismiss}
      title="Install app"
      centered
      styles={{
        title: { fontWeight: 600 },
      }}
    >
      <Text size="sm" c="dimmed" mb="md">
        Install the School Management System on your device for quick access and offline use.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="gray" onClick={handleDismiss}>
          Not now
        </Button>
        <Button
          leftSection={<IconDownload size={16} />}
          onClick={handleInstall}
          style={{ backgroundColor: colors.primary }}
        >
          Install
        </Button>
      </Group>
    </Modal>
  );
}
