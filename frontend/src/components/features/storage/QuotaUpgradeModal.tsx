'use client';

import { Modal, Text, Button, Stack } from '@mantine/core';
import { useTranslations } from 'next-intl';

interface QuotaUpgradeModalProps {
  opened: boolean;
  onClose: () => void;
}

export function QuotaUpgradeModal({ opened, onClose }: QuotaUpgradeModalProps) {
  const t = useTranslations('storage');

  return (
    <Modal opened={opened} onClose={onClose} title={t('quotaModalTitle')} size="sm">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t('quotaModalDescription')}
        </Text>
        <Button variant="light" onClick={onClose}>
          {t('quotaModalCloseButton')}
        </Button>
      </Stack>
    </Modal>
  );
}
