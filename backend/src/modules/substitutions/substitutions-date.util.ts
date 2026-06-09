export function eachDateInRange(startDate: string, endDate?: string): string[] {
  const end = endDate ?? startDate;
  if (end < startDate) {
    throw new Error('endDate must be on or after startDate');
  }
  const dates: string[] = [];
  const [sy, sm, sd] = startDate.split('-').map((v) => parseInt(v, 10));
  const [ey, em, ed] = end.split('-').map((v) => parseInt(v, 10));
  const cursor = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  while (cursor <= last) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function dayOfWeekFromDate(date: string): number {
  const [y, m, d] = date.split('-').map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d).getDay();
}

export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function assertDateRangeNotInPast(startDate: string): void {
  if (startDate < todayDateString()) {
    throw new Error('PAST_DATE');
  }
}
