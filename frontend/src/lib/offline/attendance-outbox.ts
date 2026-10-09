import type { Attendance, AttendanceStatus } from '@/types/attendance';
import {
  getOfflineDB,
  STORE_ATTENDANCE_OUTBOX,
  STORE_ATTENDANCE_ROSTER_CACHE,
  type AttendanceOutboxRecord,
  type AttendanceRosterCacheRecord,
} from './db';

const MAX_AUTO_RETRY_ATTEMPTS = 5;
const ROSTER_TTL_MS = 24 * 60 * 60 * 1000;

export type { AttendanceOutboxRecord, AttendanceRosterCacheRecord };

export interface UpsertOutboxInput {
  classSectionId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  entryTime?: string | null;
  exitTime?: string | null;
  notes?: string | null;
}

function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function rosterCacheKey(classSectionId: string, date: string): string {
  return `${classSectionId}:${date}`;
}

let attendanceDbAvailable: boolean | null = null;

export async function isAttendanceDbAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (attendanceDbAvailable !== null) return attendanceDbAvailable;
  try {
    await getOfflineDB();
    attendanceDbAvailable = true;
  } catch {
    attendanceDbAvailable = false;
  }
  return attendanceDbAvailable;
}

/** Clear cached availability (e.g. after a later IDB failure). */
export function resetAttendanceDbAvailability(): void {
  attendanceDbAvailable = null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function upsertOutbox(input: UpsertOutboxInput): Promise<string | null> {
  try {
    const db = await getOfflineDB();
    const existing = await db.getFromIndex(STORE_ATTENDANCE_OUTBOX, 'by-class-date-student', [
      input.classSectionId,
      input.date,
      input.studentId,
    ]);

    const entryTime = normalizeOptionalText(input.entryTime);
    const exitTime = normalizeOptionalText(input.exitTime);
    const notes = normalizeOptionalText(input.notes);

    const now = Date.now();
    if (existing) {
      const updated: AttendanceOutboxRecord = {
        ...existing,
        status: input.status,
        entryTime,
        exitTime,
        notes,
        syncStatus: 'pending',
        errorMessage: null,
        // Keep attemptCount so we don't reset a failing record forever on re-tap;
        // Retry button is the explicit reset path.
        updatedAt: now,
      };
      await db.put(STORE_ATTENDANCE_OUTBOX, updated);
      return updated.localId;
    }

    const localId = generateLocalId();
    const record: AttendanceOutboxRecord = {
      localId,
      classSectionId: input.classSectionId,
      studentId: input.studentId,
      date: input.date,
      status: input.status,
      entryTime,
      exitTime,
      notes,
      syncStatus: 'pending',
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      attemptCount: 0,
      serverRecordId: null,
    };
    await db.put(STORE_ATTENDANCE_OUTBOX, record);
    return localId;
  } catch {
    resetAttendanceDbAvailability();
    return null;
  }
}

export async function getPendingRecords(): Promise<AttendanceOutboxRecord[]> {
  try {
    const db = await getOfflineDB();
    const all = await db.getAll(STORE_ATTENDANCE_OUTBOX);
    // Include "syncing" so a crashed/aborted flush cannot leave rows stuck forever.
    return all.filter(
      (r) =>
        r.syncStatus === 'pending' ||
        r.syncStatus === 'syncing' ||
        (r.syncStatus === 'error' && r.attemptCount < MAX_AUTO_RETRY_ATTEMPTS),
    );
  } catch {
    resetAttendanceDbAvailability();
    return [];
  }
}

export async function getOutboxForClassDate(
  classSectionId: string,
  date: string,
): Promise<AttendanceOutboxRecord[]> {
  try {
    const db = await getOfflineDB();
    const all = await db.getAll(STORE_ATTENDANCE_OUTBOX);
    return all.filter((r) => r.classSectionId === classSectionId && r.date === date);
  } catch {
    resetAttendanceDbAvailability();
    return [];
  }
}

export async function markAsSyncing(localIds: string[]): Promise<void> {
  if (localIds.length === 0) return;
  try {
    const db = await getOfflineDB();
    const tx = db.transaction(STORE_ATTENDANCE_OUTBOX, 'readwrite');
    await Promise.all(
      localIds.map(async (id) => {
        const record = await tx.store.get(id);
        if (!record) return;
        await tx.store.put({ ...record, syncStatus: 'syncing', errorMessage: null });
      }),
    );
    await tx.done;
  } catch {
    resetAttendanceDbAvailability();
  }
}

export async function markAsSynced(localId: string, serverRecordId: string): Promise<void> {
  try {
    const db = await getOfflineDB();
    const record = await db.get(STORE_ATTENDANCE_OUTBOX, localId);
    if (!record) return;
    await db.put(STORE_ATTENDANCE_OUTBOX, {
      ...record,
      syncStatus: 'synced',
      serverRecordId,
      errorMessage: null,
      updatedAt: Date.now(),
    });
  } catch {
    resetAttendanceDbAvailability();
  }
}

export async function markAsError(localId: string, errorMessage: string): Promise<void> {
  try {
    const db = await getOfflineDB();
    const record = await db.get(STORE_ATTENDANCE_OUTBOX, localId);
    if (!record) return;
    await db.put(STORE_ATTENDANCE_OUTBOX, {
      ...record,
      syncStatus: 'error',
      errorMessage,
      attemptCount: record.attemptCount + 1,
      updatedAt: Date.now(),
    });
  } catch {
    resetAttendanceDbAvailability();
  }
}

/** Revert syncing rows back to pending without burning an attempt (e.g. after 401). */
export async function revertSyncingToPending(localIds: string[]): Promise<void> {
  if (localIds.length === 0) return;
  try {
    const db = await getOfflineDB();
    const tx = db.transaction(STORE_ATTENDANCE_OUTBOX, 'readwrite');
    await Promise.all(
      localIds.map(async (id) => {
        const record = await tx.store.get(id);
        if (!record || record.syncStatus !== 'syncing') return;
        await tx.store.put({ ...record, syncStatus: 'pending', errorMessage: null });
      }),
    );
    await tx.done;
  } catch {
    resetAttendanceDbAvailability();
  }
}

export async function resetErrorRecordsForRetry(
  classSectionId?: string,
  date?: string,
): Promise<void> {
  try {
    const db = await getOfflineDB();
    const all = await db.getAll(STORE_ATTENDANCE_OUTBOX);
    const targets = all.filter((r) => {
      if (r.syncStatus !== 'error') return false;
      if (classSectionId && r.classSectionId !== classSectionId) return false;
      if (date && r.date !== date) return false;
      return true;
    });
    const tx = db.transaction(STORE_ATTENDANCE_OUTBOX, 'readwrite');
    await Promise.all(
      targets.map((r) =>
        tx.store.put({
          ...r,
          syncStatus: 'pending',
          errorMessage: null,
          attemptCount: 0,
          updatedAt: Date.now(),
        }),
      ),
    );
    await tx.done;
  } catch {
    resetAttendanceDbAvailability();
  }
}

export async function clearSyncedRecords(olderThanMs: number): Promise<void> {
  try {
    const db = await getOfflineDB();
    const cutoff = Date.now() - olderThanMs;
    const all = await db.getAll(STORE_ATTENDANCE_OUTBOX);
    const toDelete = all.filter((r) => r.syncStatus === 'synced' && r.updatedAt < cutoff);
    if (toDelete.length === 0) return;
    const tx = db.transaction(STORE_ATTENDANCE_OUTBOX, 'readwrite');
    await Promise.all(toDelete.map((r) => tx.store.delete(r.localId)));
    await tx.done;
  } catch {
    resetAttendanceDbAvailability();
  }
}

export async function cacheRoster(
  classSectionId: string,
  date: string,
  records: Attendance[],
): Promise<void> {
  try {
    const db = await getOfflineDB();
    const now = Date.now();
    const entry: AttendanceRosterCacheRecord = {
      cacheKey: rosterCacheKey(classSectionId, date),
      classSectionId,
      date,
      records,
      cachedAt: now,
      expiresAt: now + ROSTER_TTL_MS,
    };
    await db.put(STORE_ATTENDANCE_ROSTER_CACHE, entry);
  } catch {
    resetAttendanceDbAvailability();
  }
}

export async function getCachedRoster(
  classSectionId: string,
  date: string,
): Promise<AttendanceRosterCacheRecord | null> {
  try {
    const db = await getOfflineDB();
    const entry = await db.get(
      STORE_ATTENDANCE_ROSTER_CACHE,
      rosterCacheKey(classSectionId, date),
    );
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;
    return entry;
  } catch {
    resetAttendanceDbAvailability();
    return null;
  }
}

export async function invalidateRosterCache(classSectionId: string): Promise<void> {
  try {
    const db = await getOfflineDB();
    const all = await db.getAll(STORE_ATTENDANCE_ROSTER_CACHE);
    const toDelete = all.filter((r) => r.classSectionId === classSectionId);
    if (toDelete.length === 0) return;
    const tx = db.transaction(STORE_ATTENDANCE_ROSTER_CACHE, 'readwrite');
    await Promise.all(toDelete.map((r) => tx.store.delete(r.cacheKey)));
    await tx.done;
  } catch {
    resetAttendanceDbAvailability();
  }
}

export { MAX_AUTO_RETRY_ATTEMPTS };
