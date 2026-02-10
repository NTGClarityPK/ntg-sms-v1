'use client';

import { useMemo } from 'react';
import { Table, Paper, Text } from '@mantine/core';
import type { TimetableSlot, FreePeriod } from '@/types/timetable';
import { TimetableSlotComponent } from './TimetableSlot';

interface TeacherWeekViewProps {
  staffId: string;
  slots: TimetableSlot[];
  freePeriods: FreePeriod[];
  isLoading?: boolean;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Format time from HH:MM:SS to HH:MM AM/PM
const formatTime = (time: string | undefined | null): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours || '0', 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes || '00'} ${ampm}`;
};

// Format time range
const formatTimeRange = (start: string | undefined | null, end: string | undefined | null): string => {
  if (!start || !end) return '';
  return `${formatTime(start)} - ${formatTime(end)}`;
};

export function TeacherWeekView({
  slots,
  freePeriods,
  isLoading,
}: TeacherWeekViewProps) {
  // Group slots by day and time range (time-range primary approach)
  const slotMap = useMemo(() => {
    const map = new Map<string, TimetableSlot>();
    slots.forEach((slot) => {
      const timeRange = `${slot.startTime}-${slot.endTime}`;
      const key = `${slot.dayOfWeek}-${timeRange}`;
      map.set(key, slot);
    });
    return map;
  }, [slots]);

  // Get all unique time ranges, sorted chronologically
  const timeRanges = useMemo(() => {
    const uniqueRanges = new Set<string>();
    slots.forEach((slot) => {
      uniqueRanges.add(`${slot.startTime}-${slot.endTime}`);
    });
    return Array.from(uniqueRanges).sort((a, b) => {
      const startA = a.split('-')[0];
      const startB = b.split('-')[0];
      return startA.localeCompare(startB);
    });
  }, [slots]);

  // Get active days
  const activeDays = useMemo(() => {
    const daysFromSlots = Array.from(new Set(slots.map((s) => s.dayOfWeek))).sort();
    if (daysFromSlots.length === 0) {
      return [1, 2, 3, 4, 5]; // Default to Monday-Friday
    }
    return daysFromSlots;
  }, [slots]);

  return (
    <Paper withBorder p="md">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Time</Table.Th>
            {activeDays.map((day) => (
              <Table.Th key={day}>{dayNames[day]}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {timeRanges.map((timeRange) => {
            const [startTime, endTime] = timeRange.split('-');

            return (
              <Table.Tr key={timeRange}>
                <Table.Td fw={500} style={{ minWidth: '150px' }}>
                  <Text size="sm">{formatTimeRange(startTime, endTime)}</Text>
                </Table.Td>
                {activeDays.map((day) => {
                  const key = `${day}-${timeRange}`;
                  const slot = slotMap.get(key);

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
            );
          })}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

