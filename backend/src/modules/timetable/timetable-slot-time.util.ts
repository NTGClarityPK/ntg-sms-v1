/**
 * Timetable slot end times are stored in the database as the inclusive last minute of the slot.
 * The API and UI use an exclusive clock boundary for the end (the instant the next slot may start).
 *
 * Example: user chooses 09:00–10:00 → stored end_time is 09:59 → API endTime is 10:00.
 */

const MINUTES_PER_DAY = 24 * 60;

function normaliseClockToHhMm(input: string): string {
  const trimmed = input.trim();
  const parts = trimmed.split(':');
  const h = Math.min(23, Math.max(0, parseInt(parts[0] || '0', 10)));
  const m = Math.min(59, Math.max(0, parseInt(parts[1] || '0', 10)));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function clockTimeToMinutes(input: string): number {
  const [h, m] = normaliseClockToHhMm(input).split(':').map((v) => parseInt(v, 10));
  return h * 60 + m;
}

export function minutesToClockTime(totalMinutes: number): string {
  const wrapped = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convert user-selected / API display end to inclusive last minute for persistence. */
export function userSlotEndDisplayToStoredEnd(displayEnd: string): string {
  const mins = clockTimeToMinutes(displayEnd);
  return minutesToClockTime(mins - 1);
}

/** Convert stored inclusive end minute to exclusive display end for API/UI. */
export function storedSlotEndToUserDisplay(storedEnd: string): string {
  const mins = clockTimeToMinutes(storedEnd);
  return minutesToClockTime(mins + 1);
}

/**
 * Half-open overlap on wall-clock intervals [start, displayEnd),
 * using stored inclusive end columns from the database.
 */
export function storedTimetableSlotRangesOverlap(
  startA: string,
  storedEndA: string,
  startB: string,
  storedEndB: string,
): boolean {
  const sA = clockTimeToMinutes(startA);
  const sB = clockTimeToMinutes(startB);
  const exA = clockTimeToMinutes(storedSlotEndToUserDisplay(storedEndA));
  const exB = clockTimeToMinutes(storedSlotEndToUserDisplay(storedEndB));
  return sA < exB && sB < exA;
}
