'use client';

import { Modal, Text, Stack, Button, Group } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { UniformRequest } from '@/types/inventory';

interface IssueModalProps {
  opened: boolean;
  onClose: () => void;
  request: UniformRequest | null;
  onConfirm: (id: string) => void;
  isPending?: boolean;
}

export function IssueModal({
  opened,
  onClose,
  request,
  onConfirm,
  isPending,
}: IssueModalProps) {
  const t = useTranslations('inventory');
  const handleConfirm = () => {
    if (!request) return;
    onConfirm(request.id);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('markAsIssued')}
    >
      {request && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('markAsIssuedMessage')}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button loading={isPending} onClick={handleConfirm}>
              {t('issue')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
