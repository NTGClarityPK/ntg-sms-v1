import { Group, Title, Text } from '@mantine/core';

export default function StudentsPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Students</Title>
        </Group>
      </div>
      <div>
        <Text c="dimmed">Students management coming soon</Text>
      </div>
    </>
  );
}

