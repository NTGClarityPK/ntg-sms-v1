import { AxiosError } from 'axios';
import { apiClient } from '@/lib/api-client';
import type { Attendance, AttendanceStatus } from '@/types/attendance';
import {
  clearSyncedRecords,
  getPendingRecords,
  markAsError,
  markAsSynced,
  markAsSyncing,
  resetErrorRecordsForRetry,
  revertSyncingToPending,
  type AttendanceOutboxRecord,
} from './attendance-outbox';

const SYNCED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface SyncResult {
  synced: number;
  failed: number;
  lastErrorMessage?: string;
}

let syncInProgress = false;
/** Resolvers waiting for the in-flight flush to finish (Save must not no-op). */
let syncWaiters: Array<() => void> = [];

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function groupByClassDate(
  records: AttendanceOutboxRecord[],
): Map<string, AttendanceOutboxRecord[]> {
  const map = new Map<string, AttendanceOutboxRecord[]>();
  for (const record of records) {
    const key = `${record.classSectionId}|${record.date}`;
    const existing = map.get(key);
    if (existing) {
      existing.push(record);
    } else {
      map.set(key, [record]);
    }
  }
  return map;
}

function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.response?.status === 401;
  }
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { status?: number } }).response;
    return response?.status === 401;
  }
  return false;
}

function isTransientError(error: unknown): boolean {
  if (isUnauthorizedError(error)) return true;
  if (error && typeof error === 'object' && 'isOfflineError' in error) {
    if ((error as { isOfflineError?: boolean }).isOfflineError) return true;
  }
  if (error instanceof AxiosError) {
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') return true;
    if (error.message === 'Network Error') return true;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('no internet')) return true;
    if (msg.includes('unable to reach the api')) return true;
    if (msg.includes('timed out')) return true;
    if (msg.includes('network error')) return true;
  }
  return false;
}

function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as
      | { error?: { message?: string | string[] }; message?: string | string[] }
      | undefined;
    const raw = body?.error?.message ?? body?.message;
    const text = Array.isArray(raw) ? raw.join(', ') : typeof raw === 'string' ? raw : '';
    if (text.trim()) return text.trim();
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Sync failed';
}

/** Normalise optional time fields for the bulk API (omit blanks). */
function cleanTime(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Accept HH:MM or HH:MM:SS from inputs / Postgres
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const parts = trimmed.split(':');
    const hh = parts[0]?.padStart(2, '0') ?? '00';
    const mm = parts[1] ?? '00';
    return `${hh}:${mm}`;
  }
  return undefined;
}

function toBulkRecord(r: AttendanceOutboxRecord): {
  studentId: string;
  status: AttendanceStatus;
  entryTime?: string;
  exitTime?: string;
  notes?: string;
} {
  const entryTime = cleanTime(r.entryTime);
  const exitTime = cleanTime(r.exitTime);
  const notes = r.notes?.trim() ? r.notes.trim() : undefined;
  return {
    studentId: r.studentId,
    status: r.status,
    ...(entryTime ? { entryTime } : {}),
    ...(exitTime ? { exitTime } : {}),
    ...(notes ? { notes } : {}),
  };
}

function notifySyncWaiters(): void {
  const waiters = syncWaiters;
  syncWaiters = [];
  for (const resolve of waiters) resolve();
}

async function waitForSyncSlot(): Promise<void> {
  if (!syncInProgress) return;
  await new Promise<void>((resolve) => {
    syncWaiters.push(resolve);
  });
}

export async function flushOutbox(): Promise<SyncResult> {
  // If a flush is already running, wait for it then run again so Save/Retry never no-op.
  while (syncInProgress) {
    await waitForSyncSlot();
  }
  if (!isOnline()) {
    return { synced: 0, failed: 0, lastErrorMessage: 'No internet connection' };
  }

  syncInProgress = true;
  let synced = 0;
  let failed = 0;
  let lastErrorMessage: string | undefined;

  try {
    const pending = await getPendingRecords();
    if (pending.length === 0) {
      return { synced: 0, failed: 0 };
    }

    const localIds = pending.map((r) => r.localId);
    await markAsSyncing(localIds);

    const groups = groupByClassDate(pending);

    for (const group of groups.values()) {
      const classSectionId = group[0]?.classSectionId;
      const date = group[0]?.date;
      if (!classSectionId || !date) continue;

      const groupIds = group.map((r) => r.localId);

      try {
        const response = await apiClient.post<Attendance[]>(
          '/api/v1/attendance/bulk',
          {
            classSectionId,
            date,
            records: group.map(toBulkRecord),
          },
          { timeout: 30000 },
        );

        const serverRows = response.data ?? [];
        const byStudent = new Map(serverRows.map((row) => [row.studentId, row]));

        for (const local of group) {
          const server = byStudent.get(local.studentId);
          const serverId = server?.id && server.id.length > 0 ? server.id : local.localId;
          await markAsSynced(local.localId, serverId);
          synced += 1;
        }
      } catch (error) {
        if (isTransientError(error)) {
          // Soft fail: keep pending so Retry / reconnect can succeed without burning attempts.
          await revertSyncingToPending(groupIds);
          lastErrorMessage = errorMessageFromUnknown(error);
          continue;
        }

        const message = errorMessageFromUnknown(error);
        lastErrorMessage = message;
        for (const local of group) {
          await markAsError(local.localId, message);
          failed += 1;
        }
      }
    }

    await clearSyncedRecords(SYNCED_RETENTION_MS);
    return { synced, failed, lastErrorMessage };
  } finally {
    syncInProgress = false;
    notifySyncWaiters();
  }
}

export async function retryFailedAndFlush(
  classSectionId?: string,
  date?: string,
): Promise<SyncResult> {
  await resetErrorRecordsForRetry(classSectionId, date);
  return flushOutbox();
}

export { resetErrorRecordsForRetry };
