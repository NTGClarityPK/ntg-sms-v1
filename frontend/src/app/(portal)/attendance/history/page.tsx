'use client';

import { Group, Title } from '@mantine/core';
import { AttendanceHistoryContent } from '@/components/features/attendance/AttendanceHistoryContent';

export default function AttendanceHistoryPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Attendance History</Title>
        </Group>
      </div>
      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <AttendanceHistoryContent />
      </div>
    </>
  );
}
