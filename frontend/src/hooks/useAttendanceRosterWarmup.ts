'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFeaturePermission, usePermissions } from '@/hooks/usePermissions';
import { useMyStaff } from '@/hooks/useStaff';
import { useClassSections } from '@/hooks/useClassSections';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { User } from '@/types/auth';
import {
  localDateString,
  warmAttendanceRosters,
} from '@/lib/offline/attendance-roster-warmup';

/** Delay after portal is ready so login / dashboard paint first. */
const WARMUP_START_DELAY_MS = 4000;

/** Session dedupe: branchId:date:staffId. */
const warmedSessionKeys = new Set<string>();

function isAttendanceTeacher(user: User | undefined): boolean {
  return Boolean(
    user?.roles?.some((r) => {
      const role = r.roleName?.toLowerCase();
      return role === 'class_teacher' || role === 'subject_teacher';
    }),
  );
}

/**
 * Background-warm today's attendance rosters for the teacher's class sections.
 * Safe: teachers with attendance edit only, today only, capped + concurrent limit,
 * skips fresh cache, does not block UI.
 */
export function useAttendanceRosterWarmup(): void {
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const branchId = userTyped?.currentBranch?.id;
  const isOnline = useOnlineStatus();
  const { isLoading: permissionsLoading } = usePermissions();
  const { canEdit } = useFeaturePermission('attendance');
  const isTeacher = isAttendanceTeacher(userTyped);

  const { data: myStaffData, isLoading: staffLoading } = useMyStaff();
  const staffId = myStaffData?.data?.id;

  const shouldWarm = Boolean(isTeacher && canEdit && branchId && staffId && isOnline);

  const { data: classSectionsData, isLoading: sectionsLoading } = useClassSections({
    isActive: true,
    classTeacherId: shouldWarm && staffId ? staffId : undefined,
    minimal: true,
    enabled: shouldWarm,
  });

  const sectionIdsKey = useMemo(() => {
    const ids = classSectionsData?.data?.map((cs) => cs.id).filter(Boolean) ?? [];
    return ids.slice().sort().join(',');
  }, [classSectionsData?.data]);

  const inFlightRef = useRef(false);

  useEffect(() => {
    inFlightRef.current = false;
  }, [branchId]);

  useEffect(() => {
    if (!shouldWarm) return;
    if (permissionsLoading || staffLoading || sectionsLoading) return;
    if (!sectionIdsKey) return;
    if (inFlightRef.current) return;

    const date = localDateString();
    const sessionKey = `${branchId}:${date}:${staffId}`;
    if (warmedSessionKeys.has(sessionKey)) return;

    const classSectionIds = sectionIdsKey.split(',').filter(Boolean);
    if (classSectionIds.length === 0) return;

    inFlightRef.current = true;
    const controller = new AbortController();
    let idleHandle: number | undefined;
    let delayHandle: ReturnType<typeof setTimeout> | undefined;
    let nestedDelayHandle: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      void (async () => {
        try {
          await warmAttendanceRosters({
            classSectionIds,
            date,
            signal: controller.signal,
          });
          if (!controller.signal.aborted) {
            warmedSessionKeys.add(sessionKey);
          }
        } catch {
          // Non-blocking
        } finally {
          if (controller.signal.aborted) {
            inFlightRef.current = false;
          }
        }
      })();
    };

    const scheduleIdle = () => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleHandle = window.requestIdleCallback(() => run(), { timeout: 8000 });
      } else {
        nestedDelayHandle = setTimeout(run, 500);
      }
    };

    delayHandle = setTimeout(scheduleIdle, WARMUP_START_DELAY_MS);

    return () => {
      controller.abort();
      inFlightRef.current = false;
      if (delayHandle) clearTimeout(delayHandle);
      if (nestedDelayHandle) clearTimeout(nestedDelayHandle);
      if (
        idleHandle !== undefined &&
        typeof window !== 'undefined' &&
        'cancelIdleCallback' in window
      ) {
        window.cancelIdleCallback(idleHandle);
      }
    };
  }, [
    shouldWarm,
    permissionsLoading,
    staffLoading,
    sectionsLoading,
    sectionIdsKey,
    branchId,
    staffId,
  ]);
}
