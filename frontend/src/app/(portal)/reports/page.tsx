import { Group, Title, Text } from '@mantine/core';

export default function ReportsPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Reports</Title>
        </Group>
      </div>
      <div>
        <Text c="dimmed">Reports coming soon</Text>
      </div>
    </>
  );
}

