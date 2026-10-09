'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Attendance, AttendanceStatus } from '@/types/attendance';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAttendanceByClassAndDate } from '@/hooks/useAttendance';
import { useAuth } from '@/hooks/useAuth';
import {
  cacheRoster,
  getCachedRoster,
  getOutboxForClassDate,
  isAttendanceDbAvailable,
  upsertOutbox,
  type AttendanceOutboxRecord,
} from '@/lib/offline/attendance-outbox';
import { flushOutbox, retryFailedAndFlush } from '@/lib/offline/attendance-sync';

export interface AttendanceSyncState {
  pending: number;
  syncing: number;
  errors: number;
}

export interface PersistMarkInput {
  studentId: string;
  status: AttendanceStatus;
  entryTime?: string | null;
  exitTime?: string | null;
  notes?: string | null;
}

function mergeAttendanceWithOutbox(
  base: Attendance[],
  outbox: AttendanceOutboxRecord[],
): Attendance[] {
  if (outbox.length === 0) return base;
  const active = outbox.filter((r) => r.syncStatus !== 'synced');
  if (active.length === 0) return base;

  const byStudent = new Map(active.map((r) => [r.studentId, r]));
  return base.map((row) => {
    const local = byStudent.get(row.studentId);
    if (!local) return row;
    return {
      ...row,
      status: local.status,
      entryTime: local.entryTime ?? undefined,
      exitTime: local.exitTime ?? undefined,
      notes: local.notes ?? undefined,
      id: local.serverRecordId || row.id,
    };
  });
}

function countSyncState(outbox: AttendanceOutboxRecord[]): AttendanceSyncState {
  let pending = 0;
  let syncing = 0;
  let errors = 0;
  for (const r of outbox) {
    if (r.syncStatus === 'pending') pending += 1;
    else if (r.syncStatus === 'syncing') syncing += 1;
    else if (r.syncStatus === 'error') errors += 1;
  }
  return { pending, syncing, errors };
}

export function useOfflineAttendance(
  classSectionId: string | null,
  date: string | null,
) {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  const onlineQuery = useAttendanceByClassAndDate(classSectionId, date);

  const [cachedRecords, setCachedRecords] = useState<Attendance[] | null>(null);
  const [outboxRows, setOutboxRows] = useState<AttendanceOutboxRecord[]>([]);
  const [dbAvailable, setDbAvailable] = useState(true);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);

  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onlineFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshOutbox = useCallback(async () => {
    if (!classSectionId || !date) {
      setOutboxRows([]);
      return;
    }
    const rows = await getOutboxForClassDate(classSectionId, date);
    setOutboxRows(rows);
  }, [classSectionId, date]);

  // Probe IDB availability once
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await isAttendanceDbAvailable();
      if (!cancelled) setDbAvailable(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cache successful online loads; load roster cache when offline / error
  useEffect(() => {
    if (!classSectionId || !date) {
      setCachedRecords(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      if (onlineQuery.data && onlineQuery.data.length >= 0 && !onlineQuery.isError) {
        // Successful network payload (including empty class)
        if (!onlineQuery.isFetching) {
          await cacheRoster(classSectionId, date, onlineQuery.data);
          if (!cancelled) setCachedRecords(onlineQuery.data);
        }
        return;
      }

      // Offline or failed: try IndexedDB roster
      if (!isOnline || onlineQuery.isError || (!onlineQuery.data && !onlineQuery.isLoading)) {
        setIsLoadingCache(true);
        const cached = await getCachedRoster(classSectionId, date);
        if (!cancelled) {
          setCachedRecords(cached?.records ?? null);
          setIsLoadingCache(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    classSectionId,
    date,
    isOnline,
    onlineQuery.data,
    onlineQuery.isError,
    onlineQuery.isFetching,
    onlineQuery.isLoading,
  ]);

  // Load outbox for this class+date
  useEffect(() => {
    void refreshOutbox();
  }, [refreshOutbox]);

  const scheduleFlush = useCallback(
    (delayMs: number) => {
      if (!isOnline || !dbAvailable) return;
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        void (async () => {
          setIsFlushing(true);
          try {
            await flushOutbox();
            await refreshOutbox();
            if (branchId) {
              void queryClient.invalidateQueries({ queryKey: ['attendance'] });
            }
          } finally {
            setIsFlushing(false);
          }
        })();
      }, delayMs);
    },
    [isOnline, dbAvailable, refreshOutbox, queryClient, branchId],
  );

  // Flush on reconnect (debounced 2s) and on focus/visibility
  useEffect(() => {
    const flushOnOnline = () => {
      if (onlineFlushTimerRef.current) clearTimeout(onlineFlushTimerRef.current);
      onlineFlushTimerRef.current = setTimeout(() => {
        scheduleFlush(0);
      }, 2000);
    };

    const flushOnFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!navigator.onLine) return;
      scheduleFlush(500);
    };

    window.addEventListener('online', flushOnOnline);
    window.addEventListener('focus', flushOnFocus);
    document.addEventListener('visibilitychange', flushOnFocus);

    return () => {
      window.removeEventListener('online', flushOnOnline);
      window.removeEventListener('focus', flushOnFocus);
      document.removeEventListener('visibilitychange', flushOnFocus);
      if (onlineFlushTimerRef.current) clearTimeout(onlineFlushTimerRef.current);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, [scheduleFlush]);

  const baseAttendance = useMemo(() => {
    if (isOnline && onlineQuery.data) return onlineQuery.data;
    if (cachedRecords) return cachedRecords;
    if (onlineQuery.data) return onlineQuery.data;
    return [];
  }, [isOnline, onlineQuery.data, cachedRecords]);

  const attendance = useMemo(
    () => mergeAttendanceWithOutbox(baseAttendance, outboxRows),
    [baseAttendance, outboxRows],
  );

  const syncState = useMemo(() => countSyncState(outboxRows), [outboxRows]);

  const errorStudentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of outboxRows) {
      if (r.syncStatus === 'error') ids.add(r.studentId);
    }
    return ids;
  }, [outboxRows]);

  const lastSyncErrorMessage = useMemo(() => {
    const withMessage = outboxRows.find(
      (r) => r.syncStatus === 'error' && r.errorMessage && r.errorMessage.trim().length > 0,
    );
    return withMessage?.errorMessage ?? null;
  }, [outboxRows]);

  const isLoading =
    (!!classSectionId && !!date && onlineQuery.isLoading && !cachedRecords) || isLoadingCache;

  const usingCacheOnly =
    Boolean(cachedRecords) && (!isOnline || onlineQuery.isError) && !onlineQuery.data;

  const persistMark = useCallback(
    async (input: PersistMarkInput) => {
      if (!classSectionId || !date || !dbAvailable) return false;
      const localId = await upsertOutbox({
        classSectionId,
        date,
        studentId: input.studentId,
        status: input.status,
        entryTime: input.entryTime,
        exitTime: input.exitTime,
        notes: input.notes,
      });
      await refreshOutbox();
      if (localId && isOnline) {
        scheduleFlush(500);
      }
      return localId !== null;
    },
    [classSectionId, date, dbAvailable, isOnline, refreshOutbox, scheduleFlush],
  );

  const flush = useCallback(async () => {
    if (!dbAvailable) return { synced: 0, failed: 0 };
    setIsFlushing(true);
    try {
      const result = await flushOutbox();
      await refreshOutbox();
      if (branchId) {
        void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      }
      return result;
    } finally {
      setIsFlushing(false);
    }
  }, [dbAvailable, refreshOutbox, queryClient, branchId]);

  const retryFailed = useCallback(async () => {
    if (!dbAvailable || !classSectionId || !date) return { synced: 0, failed: 0 };
    setIsFlushing(true);
    try {
      const result = await retryFailedAndFlush(classSectionId, date);
      await refreshOutbox();
      if (branchId) {
        void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      }
      return result;
    } finally {
      setIsFlushing(false);
    }
  }, [dbAvailable, classSectionId, date, refreshOutbox, queryClient, branchId]);

  return {
    attendance,
    isLoading,
    isOnline,
    dbAvailable,
    usingCacheOnly,
    syncState,
    errorStudentIds,
    lastSyncErrorMessage,
    isFlushing,
    persistMark,
    flush,
    retryFailed,
    refreshOutbox,
    onlineError: onlineQuery.error,
  };
}
