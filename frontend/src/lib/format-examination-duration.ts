/** Format stored examination duration (minutes) for UI. */
export function formatExaminationDurationMinutes(
  minutes: number,
  locale: string,
): string {
  const m = Math.round(minutes);
  if (m < 60) {
    return locale === 'ar' ? `${m} دقيقة` : `${m} min`;
  }
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (locale === 'ar') {
    return r === 0 ? `${h} ساعة` : `${h} س ${r} د`;
  }
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}
