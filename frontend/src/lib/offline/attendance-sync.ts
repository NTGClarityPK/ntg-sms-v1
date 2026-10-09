import { AxiosError } from 'axios';
import { apiClient } from '@/lib/api-client';
import type { Attendance } from '@/types/attendance';
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
}

let syncInProgress = false;

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

function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Sync failed';
}

export async function flushOutbox(): Promise<SyncResult> {
  if (syncInProgress) {
    return { synced: 0, failed: 0 };
  }
  if (!isOnline()) {
    return { synced: 0, failed: 0 };
  }

  syncInProgress = true;
  let synced = 0;
  let failed = 0;

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
            records: group.map((r) => ({
              studentId: r.studentId,
              status: r.status,
              entryTime: r.entryTime ?? undefined,
              exitTime: r.exitTime ?? undefined,
              notes: r.notes ?? undefined,
            })),
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
        if (isUnauthorizedError(error)) {
          // Interceptor already tried refresh; do not burn attempts — leave pending.
          await revertSyncingToPending(groupIds);
          continue;
        }

        const message = errorMessageFromUnknown(error);
        for (const local of group) {
          await markAsError(local.localId, message);
          failed += 1;
        }
      }
    }

    await clearSyncedRecords(SYNCED_RETENTION_MS);
    return { synced, failed };
  } finally {
    syncInProgress = false;
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
