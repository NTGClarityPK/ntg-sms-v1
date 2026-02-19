'use client';

import { Modal, Text, Button, Stack } from '@mantine/core';

interface QuotaUpgradeModalProps {
  opened: boolean;
  onClose: () => void;
}

export function QuotaUpgradeModal({ opened, onClose }: QuotaUpgradeModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Request more storage" size="sm">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          To request additional storage for your branch, please contact your system administrator or
          support. Include your branch name and the amount of storage you need.
        </Text>
        <Button variant="light" onClick={onClose}>
          Close
        </Button>
      </Stack>
    </Modal>
  );
}
