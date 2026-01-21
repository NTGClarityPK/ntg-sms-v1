import { Group, Title, Text } from '@mantine/core';

export default function AttendancePage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Attendance</Title>
        </Group>
      </div>
      <div>
        <Text c="dimmed">Attendance management coming soon</Text>
      </div>
    </>
  );
}

