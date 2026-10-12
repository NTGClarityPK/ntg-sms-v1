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
/** After this many soft failures, surface a hard error so the UI stops spinning forever. */
const MAX_SOFT_FAILS = 3;

export interface SyncResult {
  synced: number;
  failed: number;
  lastErrorMessage?: string;
}

let syncInProgress = false;
let syncWaiters: Array<() => void> = [];
/** Soft-fail counters keyed by localId — reset on success. */
const softFailCounts = new Map<string, number>();
let lastFlushErrorMessage: string | null = null;

export function getLastFlushErrorMessage(): string | null {
  return lastFlushErrorMessage;
}

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
    if (existing) existing.push(record);
    else map.set(key, [record]);
  }
  return map;
}

function isOfflineOrNetworkError(error: unknown): boolean {
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

function cleanTime(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
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

/**
 * Push pending outbox rows to POST /api/v1/attendance/bulk.
 * Simple rules:
 * - Only one flush at a time
 * - Network/offline → leave pending (soft), after a few soft fails → error
 * - Any other API error → mark error immediately (show message + Retry)
 */
export async function flushOutbox(): Promise<SyncResult> {
  while (syncInProgress) {
    await waitForSyncSlot();
  }
  if (!isOnline()) {
    lastFlushErrorMessage = 'No internet connection';
    return { synced: 0, failed: 0, lastErrorMessage: lastFlushErrorMessage };
  }

  syncInProgress = true;
  let synced = 0;
  let failed = 0;
  let lastErrorMessage: string | undefined;

  try {
    const pending = await getPendingRecords();
    if (pending.length === 0) {
      lastFlushErrorMessage = null;
      return { synced: 0, failed: 0 };
    }

    const uniqueByStudentDay = new Map<string, AttendanceOutboxRecord>();
    for (const row of pending) {
      const key = `${row.classSectionId}|${row.date}|${row.studentId}`;
      const existing = uniqueByStudentDay.get(key);
      if (!existing || row.updatedAt >= existing.updatedAt) {
        uniqueByStudentDay.set(key, row);
      }
    }
    const uniquePending = Array.from(uniqueByStudentDay.values());
    const localIds = uniquePending.map((r) => r.localId);
    await markAsSyncing(localIds);

    const groups = groupByClassDate(uniquePending);

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
          softFailCounts.delete(local.localId);
          synced += 1;
        }
      } catch (error) {
        const message = errorMessageFromUnknown(error);
        lastErrorMessage = message;
        lastFlushErrorMessage = message;

        if (isOfflineOrNetworkError(error)) {
          // Soft fail a few times, then hard-error so the spinner cannot loop forever.
          let escalate = false;
          for (const id of groupIds) {
            const next = (softFailCounts.get(id) ?? 0) + 1;
            softFailCounts.set(id, next);
            if (next >= MAX_SOFT_FAILS) escalate = true;
          }
          if (escalate) {
            for (const local of group) {
              await markAsError(local.localId, message);
              softFailCounts.delete(local.localId);
              failed += 1;
            }
          } else {
            await revertSyncingToPending(groupIds);
          }
          continue;
        }

        // Real API/validation/auth errors — fail fast with a visible message.
        for (const local of group) {
          await markAsError(local.localId, message);
          softFailCounts.delete(local.localId);
          failed += 1;
        }
      }
    }

    await clearSyncedRecords(SYNCED_RETENTION_MS);
    if (failed === 0 && synced > 0) lastFlushErrorMessage = null;
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
  softFailCounts.clear();
  await resetErrorRecordsForRetry(classSectionId, date);
  return flushOutbox();
}

export { resetErrorRecordsForRetry };
