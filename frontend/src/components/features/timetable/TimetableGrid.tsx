'use client';

import { Table, Paper } from '@mantine/core';
import type { TimetableSlot, Conflict } from '@/types/timetable';
import { TimetableSlotComponent } from './TimetableSlot';

interface TimetableGridProps {
  classSectionId: string;
  slots: TimetableSlot[];
  onSlotClick: (slot: TimetableSlot | null, day: number, period: number) => void;
  conflicts?: Conflict[];
  isLoading?: boolean;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TimetableGrid({
  slots,
  onSlotClick,
  conflicts,
  isLoading,
}: TimetableGridProps) {
  // Group slots by day and period
  const slotMap = new Map<string, TimetableSlot>();
  slots.forEach((slot) => {
    const key = `${slot.dayOfWeek}-${slot.periodNumber}`;
    slotMap.set(key, slot);
  });

  // Get conflict slot IDs
  const conflictSlotIds = new Set<string>();
  conflicts?.forEach((conflict) => {
    conflict.slotIds.forEach((id) => conflictSlotIds.add(id));
  });

  // Find max period - always show minimum 8 periods, or more if slots exist beyond that
  const maxPeriodFromSlots = slots.length > 0
    ? Math.max(...slots.map((s) => s.periodNumber))
    : 0;
  const maxPeriod = Math.max(maxPeriodFromSlots, 8); // Always show at least 8 periods

  // Get active days from school days configuration (not just from existing slots)
  // This ensures all active school days are shown even if no slots exist yet
  const activeDays = Array.from(new Set(slots.map((s) => s.dayOfWeek))).sort();

  if (activeDays.length === 0) {
    activeDays.push(1, 2, 3, 4, 5); // Default to Monday-Friday
  } else {
    // Ensure we show all school days (Monday-Friday) even if no slots exist
    const allSchoolDays = [1, 2, 3, 4, 5]; // Monday to Friday
    allSchoolDays.forEach((day) => {
      if (!activeDays.includes(day)) {
        activeDays.push(day);
      }
    });
    activeDays.sort();
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
                const hasConflict = slot && conflictSlotIds.has(slot.id);

                return (
                  <Table.Td
                    key={day}
                    style={{
                      minWidth: '150px',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                    onClick={() => onSlotClick(slot || null, day, period)}
                  >
                    {slot ? (
                      <TimetableSlotComponent
                        slot={slot}
                        onClick={() => onSlotClick(slot, day, period)}
                        showConflict={hasConflict}
                      />
                    ) : (
                      <div
                        style={{
                          height: '80px',
                          border: '1px dashed #ccc',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#999',
                          fontSize: '12px',
                        }}
                      >
                        Empty
                      </div>
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

