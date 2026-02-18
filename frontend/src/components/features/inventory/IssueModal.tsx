'use client';

import { Modal, Text, Stack, Button, Group } from '@mantine/core';
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
  const handleConfirm = () => {
    if (!request) return;
    onConfirm(request.id);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Mark as issued"
    >
      {request && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            This will deduct stock for the requested items and mark the request
            as issued. Continue?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={isPending} onClick={handleConfirm}>
              Issue
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
