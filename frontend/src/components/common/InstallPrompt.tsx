'use client';

import { useState, useEffect } from 'react';
import { Button, Modal, Text, Group } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALL_DISMISSED_KEY = 'pwa-install-dismissed';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const colors = useThemeColors();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = sessionStorage.getItem(INSTALL_DISMISSED_KEY);
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    const checkStandalone = () => {
      const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
      const isPwa = window.matchMedia('(display-mode: standalone)').matches || standalone === true;
      setIsInstalled(isPwa);
    };

    window.addEventListener('beforeinstallprompt', handler);
    checkStandalone();

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
  };

  if (!showPrompt || isInstalled || !deferredPrompt) return null;

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
