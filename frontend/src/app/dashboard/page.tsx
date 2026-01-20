'use client';

import { Container, Title, Text } from '@mantine/core';

export default function DashboardPage() {
  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="md">
        Dashboard
      </Title>
      <Text c="dimmed">Dashboard coming soon</Text>
    </Container>
  );
}

