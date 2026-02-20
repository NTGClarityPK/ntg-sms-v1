'use client';

import { Modal, Text, Stack, List, Button } from '@mantine/core';
import { IconShare } from '@tabler/icons-react';
import { useInstallApp } from '@/lib/install-app-context';

/**
 * Shows instructions for installing the app as PWA in Safari (Add to Home Screen).
 */
export function SafariInstallModal() {
  const { showSafariModal, setShowSafariModal, isInstalled } = useInstallApp();

  if (isInstalled) return null;

  return (
    <Modal
      opened={showSafariModal}
      onClose={() => setShowSafariModal(false)}
      title="Install app (Safari)"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          To install this app on your device and use push notifications in Safari:
        </Text>
        <List size="sm" spacing="xs" icon={<IconShare size={16} />}>
          <List.Item>
            <strong>iPhone or iPad:</strong> Tap the Share button (square with arrow) at the bottom of Safari, then tap &quot;Add to Home Screen&quot;.
          </List.Item>
          <List.Item>
            <strong>Mac:</strong> In the menu bar, choose File → &quot;Add to Dock&quot; or use the Share button in the toolbar.
          </List.Item>
        </List>
        <Text size="xs" c="dimmed">
          After adding to Home Screen, open the app from your home screen. Push notifications work when the app is installed this way.
        </Text>
        <Button variant="light" onClick={() => setShowSafariModal(false)}>
          Got it
        </Button>
      </Stack>
    </Modal>
  );
}
