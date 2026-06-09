import type { TimetableSlot } from '@/types/timetable';
import type { SubstitutionOverlay } from '@/types/substitutions';

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Sunday-based week dates keyed by dayOfWeek (0–6). */
export function weekDatesFromAnchor(anchorDate: string): Record<number, string> {
  const [y, m, d] = anchorDate.split('-').map((v) => parseInt(v, 10));
  const anchor = new Date(y, m - 1, d);
  const sunday = new Date(anchor);
  sunday.setDate(anchor.getDate() - anchor.getDay());
  const map: Record<number, string> = {};
  for (let dow = 0; dow < 7; dow++) {
    const x = new Date(sunday);
    x.setDate(sunday.getDate() + dow);
    map[dow] = formatIso(x);
  }
  return map;
}

export function applySubstitutionOverlaysToSlots(
  slots: TimetableSlot[],
  overlays: SubstitutionOverlay[],
  weekDatesByDay: Record<number, string>,
): TimetableSlot[] {
  const overlayKey = (slotId: string, date: string) => `${slotId}:${date}`;
  const overlayMap = new Map<string, SubstitutionOverlay>();
  for (const o of overlays) {
    overlayMap.set(overlayKey(o.timetableSlotId, o.absenceDate), o);
  }

  return slots.map((slot) => {
    const dateForDay = weekDatesByDay[slot.dayOfWeek];
    if (!dateForDay) return slot;
    const overlay = overlayMap.get(overlayKey(slot.id, dateForDay));
    if (!overlay) return slot;
    return {
      ...slot,
      staffName: overlay.substituteTeacherName,
      originalStaffName: slot.staffName,
      isSubstitutionDisplay: true,
      substitutionId: overlay.substitutionId,
    };
  });
}
