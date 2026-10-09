'use client';

import { useAttendanceRosterWarmup } from '@/hooks/useAttendanceRosterWarmup';

/**
 * Portal-mounted: quietly warms today's attendance rosters for marking teachers.
 * Renders nothing.
 */
export function AttendanceRosterWarmup() {
  useAttendanceRosterWarmup();
  return null;
}
