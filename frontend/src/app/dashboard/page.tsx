import { Group, Title, Text } from '@mantine/core';

export default function DashboardPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Dashboard</Title>
        </Group>
      </div>
      <div>
        <Text c="dimmed">Dashboard coming soon</Text>
      </div>
    </>
  );
}

