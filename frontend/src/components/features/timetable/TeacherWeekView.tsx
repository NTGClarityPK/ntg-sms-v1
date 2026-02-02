'use client';

import { Table, Paper, Badge } from '@mantine/core';
import type { TimetableSlot, FreePeriod } from '@/types/timetable';
import { TimetableSlotComponent } from './TimetableSlot';

interface TeacherWeekViewProps {
  staffId: string;
  slots: TimetableSlot[];
  freePeriods: FreePeriod[];
  isLoading?: boolean;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TeacherWeekView({
  slots,
  freePeriods,
  isLoading,
}: TeacherWeekViewProps) {
  // Group slots by day and period
  const slotMap = new Map<string, TimetableSlot>();
  slots.forEach((slot) => {
    const key = `${slot.dayOfWeek}-${slot.periodNumber}`;
    slotMap.set(key, slot);
  });

  // Group free periods
  const freePeriodMap = new Map<string, boolean>();
  freePeriods.forEach((fp) => {
    const key = `${fp.dayOfWeek}-${fp.periodNumber}`;
    freePeriodMap.set(key, true);
  });

  // Find max period
  const maxPeriod = slots.length > 0
    ? Math.max(...slots.map((s) => s.periodNumber))
    : 8; // Default to 8 periods

  // Get active days
  const activeDays = Array.from(new Set(slots.map((s) => s.dayOfWeek))).sort();
  if (activeDays.length === 0) {
    activeDays.push(1, 2, 3, 4, 5); // Default to Monday-Friday
  }

  return (
    <Paper withBorder p="md">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Period</Table.Th>
            {activeDays.map((day) => (
              <Table.Th key={day}>{dayNames[day]}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {Array.from({ length: maxPeriod }, (_, i) => i + 1).map((period) => (
            <Table.Tr key={period}>
              <Table.Td fw={500}>{period}</Table.Td>
              {activeDays.map((day) => {
                const key = `${day}-${period}`;
                const slot = slotMap.get(key);
                const isFree = freePeriodMap.get(key);

                return (
                  <Table.Td
                    key={day}
                    style={{
                      minWidth: '150px',
                      padding: '4px',
                    }}
                  >
                    {slot ? (
                      <TimetableSlotComponent slot={slot} />
                    ) : isFree ? (
                      <div
                        style={{
                          height: '80px',
                          border: '1px solid #e0e0e0',
                          borderRadius: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f5f5f5',
                        }}
                      >
                        <Badge size="sm" variant="light" color="green">
                          Free
                        </Badge>
                      </div>
                    ) : (
                      <div
                        style={{
                          height: '80px',
                          border: '1px dashed #ccc',
                          borderRadius: '4px',
                        }}
                      />
                    )}
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

