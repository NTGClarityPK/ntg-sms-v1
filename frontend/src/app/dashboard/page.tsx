'use client';

import { Stack, Title, Text } from '@mantine/core';

export default function DashboardPage() {
  return (
    <Stack gap="md">
      <Title order={1}>
        Dashboard
      </Title>
      <Text c="dimmed">Dashboard coming soon</Text>
    </Stack>
  );
}

