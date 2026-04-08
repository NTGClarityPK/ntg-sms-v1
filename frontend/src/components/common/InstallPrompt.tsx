'use client';

import { Button, Modal, Text, Group, Stack } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useInstallApp } from '@/lib/install-app-context';

export function InstallPrompt() {
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
      title="Install NTG Alma App"
      centered
      styles={{
        title: { fontWeight: 600 },
      }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Your official school app for messages, notifications, and quick updates.
          <br />
          <Text component="span" fw={600}>
            Mobile app is perfect for staying connected while desktop is best for a complete experience with all the
            features.
          </Text>
        </Text>

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleDismiss}>
            Skip
          </Button>
          <Button leftSection={<IconDownload size={16} />} onClick={handleInstall}>
            Install
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
