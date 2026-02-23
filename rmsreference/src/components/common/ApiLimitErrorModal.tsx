'use client';

import { Modal, Text, Button, Stack, Group, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useLanguageStore } from '@/lib/store/language-store';

interface ApiLimitErrorModalProps {
  opened: boolean;
  onClose: () => void;
  dailyLimit?: number;
  currentCount?: number;
}

export function ApiLimitErrorModal({
  opened,
  onClose,
  dailyLimit = 10000,
  currentCount,
}: ApiLimitErrorModalProps) {
  const language = useLanguageStore((state) => state.language);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="API Request Limit Exceeded"
      centered
      size="md"
    >
      <Stack gap="md">
        <Alert
          icon={<IconAlertCircle size={20} />}
          title="Daily API Limit Reached"
          color="red"
          variant="light"
        >
          <Text size="sm" c="dimmed">
            You have exceeded the daily API request limit of{' '}
            <Text component="span" fw={700} c="red">
              {dailyLimit.toLocaleString()}
            </Text>{' '}
            requests per day.
          </Text>
          {currentCount !== undefined && (
            <Text size="sm" c="dimmed" mt="xs">
              Current usage: <Text component="span" fw={700}>{currentCount.toLocaleString()}</Text> requests
            </Text>
          )}
        </Alert>

        <Text size="sm" c="dimmed">
          Please try again tomorrow or contact support if you need a higher limit.
        </Text>

        <Group justify="flex-end" mt="md">
          <Button onClick={onClose} color="red">
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

