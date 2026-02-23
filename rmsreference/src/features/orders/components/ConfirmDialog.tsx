'use client';

import { Modal, Stack, Text, Group, Button } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';

interface ConfirmDialogProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmColor = 'red',
  loading = false,
}: ConfirmDialogProps) {
  const { language } = useLanguageStore();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title || t('common.confirm', language) || 'Confirm'}
      size="sm"
      centered
      zIndex={400}
    >
      <Stack gap="md">
        <Group gap="sm">
          <IconAlertTriangle size={24} color="var(--mantine-color-yellow-6)" />
          <Text>{message}</Text>
        </Group>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose} disabled={loading}>
            {cancelLabel || t('common.cancel', language) || 'Cancel'}
          </Button>
          <Button
            color={confirmColor}
            onClick={() => {
              onConfirm();
            }}
            loading={loading}
          >
            {confirmLabel || t('common.confirm', language) || 'Confirm'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}










