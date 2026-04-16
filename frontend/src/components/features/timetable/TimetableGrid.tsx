'use client';

import { useMemo } from 'react';
import { Paper, Text, Group } from '@mantine/core';
import type { TimetableSlot, Conflict, TimingTemplateInfo } from '@/types/timetable';
import { TimetableSlotComponent } from './TimetableSlot';

interface TimetableGridProps {
  classSectionId: string;
  slots: TimetableSlot[];
  onSlotClick: (slot: TimetableSlot | null, day: number, timeRange: string, target: HTMLElement) => void;
  templateInfo?: TimingTemplateInfo | null;
  conflicts?: Conflict[];
  isLoading?: boolean;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Format time from HH:MM or HH:MM:SS to HH:MM AM/PM
const formatTime = (time: string | undefined | null): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours || '0', 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes || '00'} ${ampm}`;
};

const parseTimeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map((n) => parseInt(n || '0', 10));
  return h * 60 + m;
};

const minutesToTimeString = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
};

const templateKey = (slot: TimetableSlot): string => slot.subjectTemplateId ?? 'null';

const timesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
  const s1 = parseTimeToMinutes(start1);
  const e1 = parseTimeToMinutes(end1);
  const s2 = parseTimeToMinutes(start2);
  const e2 = parseTimeToMinutes(end2);
  return s1 < e2 && s2 < e1;
};

/** Split the day lane into columns when multiple slots overlap in time (same template group). */
function buildOverlapColumnLayout(slots: TimetableSlot[]): Map<string, { index: number; count: number }> {
  const result = new Map<string, { index: number; count: number }>();
  const byDayTemplate = new Map<string, TimetableSlot[]>();
  for (const s of slots) {
    const k = `${s.dayOfWeek}-${templateKey(s)}`;
    const arr = byDayTemplate.get(k) ?? [];
    arr.push(s);
    byDayTemplate.set(k, arr);
  }
  for (const group of byDayTemplate.values()) {
    if (group.length === 0) continue;
    if (group.length === 1) {
      result.set(group[0].id, { index: 0, count: 1 });
      continue;
    }
    let slotGroups: TimetableSlot[][] = group.map((s) => [s]);
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < slotGroups.length; i++) {
        for (let j = i + 1; j < slotGroups.length; j++) {
          const g1 = slotGroups[i];
          const g2 = slotGroups[j];
          let hasOverlap = false;
          for (const s1 of g1) {
            for (const s2 of g2) {
              if (timesOverlap(s1.startTime, s1.endTime, s2.startTime, s2.endTime)) {
                hasOverlap = true;
                break;
              }
            }
            if (hasOverlap) break;
          }
          if (hasOverlap) {
            slotGroups[i] = [...g1, ...g2];
            slotGroups.splice(j, 1);
            changed = true;
            break outer;
          }
        }
      }
    }
    for (const cluster of slotGroups) {
      if (cluster.length < 2) {
        for (const s of cluster) result.set(s.id, { index: 0, count: 1 });
      } else {
        const sorted = [...cluster].sort(
          (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
        );
        sorted.forEach((s, idx) => result.set(s.id, { index: idx, count: sorted.length }));
      }
    }
  }
  return result;
}

export function TimetableGrid({
  slots,
  onSlotClick,
  templateInfo,
  conflicts,
  isLoading,
}: TimetableGridProps) {
  // If no timing template is available, we can't build a proper vertical timeline
  if (!templateInfo) {
    return (
      <Paper withBorder p="md">
        <Text size="sm">
          No timing template is assigned to this class. Please assign one in Schedule Settings to
          see the vertical timetable.
        </Text>
      </Paper>
    );
  }

  // Time calculations based on timing template
  const schoolStartMinutes = useMemo(
    () => parseTimeToMinutes(templateInfo.startTime),
    [templateInfo.startTime],
  );
  const schoolEndMinutes = useMemo(
    () => parseTimeToMinutes(templateInfo.endTime),
    [templateInfo.endTime],
  );
  const totalMinutes = Math.max(schoolEndMinutes - schoolStartMinutes, 0);
  const periodMinutes = templateInfo.periodDurationMinutes || 60;
  const rowCount = Math.max(Math.ceil(totalMinutes / periodMinutes), 1);

  const ROW_HEIGHT = 80; // px per logical period row (taller for better readability)
  const laneHeight = rowCount * ROW_HEIGHT;

  // Build time labels at each period boundary
  const timeRows = useMemo(
    () =>
      Array.from({ length: rowCount + 1 }, (_, i) => schoolStartMinutes + i * periodMinutes).filter(
        (m) => m <= schoolEndMinutes,
      ),
    [rowCount, schoolStartMinutes, schoolEndMinutes, periodMinutes],
  );

  // Active days (columns)
  const activeDays = useMemo(() => {
    const daysFromSlots = Array.from(new Set(slots.map((s) => s.dayOfWeek))).sort();
    if (daysFromSlots.length === 0) {
      return [1, 2, 3, 4, 5]; // Default to Monday-Friday
    }
    // Ensure we show all school days (Monday-Friday) even if no slots exist
    const allSchoolDays = [1, 2, 3, 4, 5];
    const result = new Set([...daysFromSlots, ...allSchoolDays]);
    return Array.from(result).sort();
  }, [slots]);

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const map = new Map<number, TimetableSlot[]>();
    slots.forEach((slot) => {
      const arr = map.get(slot.dayOfWeek) ?? [];
      arr.push(slot);
      map.set(slot.dayOfWeek, arr);
    });
    return map;
  }, [slots]);

  // Conflict slot IDs
  const conflictSlotIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts?.forEach((conflict) => {
      conflict.slotIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [conflicts]);

  const overlapColumnLayout = useMemo(() => buildOverlapColumnLayout(slots), [slots]);

  const minutesToOffset = (minutes: number): number => {
    if (totalMinutes <= 0) return 0;
    const clamped = Math.max(schoolStartMinutes, Math.min(minutes, schoolEndMinutes));
    return ((clamped - schoolStartMinutes) / totalMinutes) * laneHeight;
  };

  const handleLaneClick = (day: number, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const clickedMinutes = schoolStartMinutes + (y / laneHeight) * totalMinutes;

    // Snap to nearest period boundary
    const snappedOffset =
      Math.round((clickedMinutes - schoolStartMinutes) / periodMinutes) * periodMinutes;
    const startMinutes = Math.min(
      Math.max(schoolStartMinutes, schoolStartMinutes + snappedOffset),
      schoolEndMinutes - periodMinutes,
    );
    const endMinutes = Math.min(startMinutes + periodMinutes, schoolEndMinutes);

    const startTime = minutesToTimeString(startMinutes);
    const endTime = minutesToTimeString(endMinutes);
    const timeRange = `${startTime}-${endTime}`;

    onSlotClick(null, day, timeRange, e.currentTarget as HTMLElement);
  };

  return (
    <Paper withBorder p="md">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `80px repeat(${activeDays.length}, 1fr)`,
          columnGap: '8px',
        }}
      >
        {/* Time axis */}
        <div
          style={{
            position: 'relative',
            height: laneHeight,
          }}
        >
          {timeRows.map((minutes, index) => {
            const top = minutesToOffset(minutes);
            // Lower all labels except the last one to align with grid lines
            const isLast = index === timeRows.length - 1;
            const offset = isLast ? 0 : 6; // Offset to align with grid border
            return (
              <div
                key={minutes}
                style={{
                  position: 'absolute',
                  top: top + offset,
                  transform: isLast ? 'none' : 'none', // No centering, just position at grid line
                  fontSize: '11px',
                  color: 'var(--mantine-color-gray-6)',
                }}
              >
                {formatTime(minutesToTimeString(minutes))}
              </div>
            );
          })}
        </div>

        {/* Day lanes */}
        {activeDays.map((day) => {
          const daySlots = slotsByDay.get(day) ?? [];
          return (
            <div key={day}>
              <Group justify="center" mb={4}>
                <Text size="xs" fw={500}>
                  {dayNames[day]}
                </Text>
              </Group>
              <div
                style={{
                  position: 'relative',
                  height: laneHeight,
                  borderLeft: '1px solid var(--mantine-color-gray-3)',
                  borderRight: '1px solid var(--mantine-color-gray-3)',
                  background: `repeating-linear-gradient(to bottom, transparent, transparent ${
                    ROW_HEIGHT - 1
                  }px, var(--mantine-color-gray-1) ${ROW_HEIGHT}px)`,
                  cursor: 'pointer',
                }}
                onClick={(e) => handleLaneClick(day, e)}
              >
                {/* Slots */}
                {daySlots.map((slot) => {
                  const startMinutes = parseTimeToMinutes(slot.startTime);
                  const endMinutes = parseTimeToMinutes(slot.endTime);
                  // If slot aligns exactly to period boundaries, snap to grid rows for pixel-perfect alignment
                  const alignsToGrid =
                    (startMinutes - schoolStartMinutes) % periodMinutes === 0 &&
                    (endMinutes - schoolStartMinutes) % periodMinutes === 0;

                  const top = alignsToGrid
                    ? ((startMinutes - schoolStartMinutes) / periodMinutes) * ROW_HEIGHT
                    : minutesToOffset(startMinutes);
                  const bottom = alignsToGrid
                    ? ((endMinutes - schoolStartMinutes) / periodMinutes) * ROW_HEIGHT
                    : minutesToOffset(endMinutes);
                  const height = Math.max(bottom - top, 24);
                  const overlapInfo = overlapColumnLayout.get(slot.id) ?? { index: 0, count: 1 };
                  const hasOverlapLayout = overlapInfo.count > 1;
                  const hasConflict = conflictSlotIds.has(slot.id) || hasOverlapLayout;

                  // Calculate duration to determine if compact layout needed
                  const durationMinutes = endMinutes - startMinutes;
                  const isCompact = durationMinutes < 15 || height < 50;

                  return (
                    <div
                      key={slot.id}
                      style={{
                        position: 'absolute',
                        top,
                        ...(hasOverlapLayout
                          ? {
                              left: `calc(4px + (100% - 8px) * ${overlapInfo.index} / ${overlapInfo.count})`,
                              width: `calc((100% - 8px) / ${overlapInfo.count})`,
                              zIndex: overlapInfo.index + 2,
                            }
                          : {
                              insetInlineStart: 4,
                              insetInlineEnd: 4,
                              zIndex: 1,
                            }),
                        height,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const timeRange = `${slot.startTime}-${slot.endTime}`;
                        onSlotClick(slot, day, timeRange, e.currentTarget as HTMLElement);
                      }}
                    >
                      <TimetableSlotComponent
                        slot={slot}
                        onClick={() => {}}
                        showConflict={hasConflict}
                        height={height}
                        periodNumber={!isCompact ? slot.periodNumber : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Paper>
  );
}

