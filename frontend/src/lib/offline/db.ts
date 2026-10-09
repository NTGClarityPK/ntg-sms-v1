import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Attendance, AttendanceStatus } from '@/types/attendance';

const DB_NAME = 'ntg-sms-offline';
const DB_VERSION = 3;
const STORE_OFFLINE_DOCUMENTS = 'offline_documents';
const STORE_ATTENDANCE_OUTBOX = 'attendance_outbox';
const STORE_ATTENDANCE_ROSTER_CACHE = 'attendance_roster_cache';

export interface OfflineDocumentItem {
  id: string;
  title: string;
  type: string;
  url: string;
  blob: Blob;
  savedAt: number;
  size: number;
}

export type AttendanceOutboxSyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface AttendanceOutboxRecord {
  localId: string;
  classSectionId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  entryTime: string | null;
  exitTime: string | null;
  notes: string | null;
  syncStatus: AttendanceOutboxSyncStatus;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
  attemptCount: number;
  serverRecordId: string | null;
}

export interface AttendanceRosterCacheRecord {
  cacheKey: string;
  classSectionId: string;
  date: string;
  records: Attendance[];
  cachedAt: number;
  expiresAt: number;
}

interface OfflineDBSchema extends DBSchema {
  [STORE_OFFLINE_DOCUMENTS]: {
    key: string;
    value: OfflineDocumentItem;
    indexes: { byType: string; bySaved: number };
  };
  [STORE_ATTENDANCE_OUTBOX]: {
    key: string;
    value: AttendanceOutboxRecord;
    indexes: {
      'by-status': string;
      'by-class-date-student': [string, string, string];
    };
  };
  [STORE_ATTENDANCE_ROSTER_CACHE]: {
    key: string;
    value: AttendanceRosterCacheRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

export function getOfflineDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB only available in browser'));
  }
  if (!dbPromise) {
    dbPromise = openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_OFFLINE_DOCUMENTS)) {
          const docStore = db.createObjectStore(STORE_OFFLINE_DOCUMENTS, { keyPath: 'id' });
          docStore.createIndex('byType', 'type');
          docStore.createIndex('bySaved', 'savedAt');
        }
        if (!db.objectStoreNames.contains(STORE_ATTENDANCE_OUTBOX)) {
          const outboxStore = db.createObjectStore(STORE_ATTENDANCE_OUTBOX, {
            keyPath: 'localId',
          });
          outboxStore.createIndex('by-status', 'syncStatus');
          outboxStore.createIndex('by-class-date-student', [
            'classSectionId',
            'date',
            'studentId',
          ]);
        }
        if (!db.objectStoreNames.contains(STORE_ATTENDANCE_ROSTER_CACHE)) {
          db.createObjectStore(STORE_ATTENDANCE_ROSTER_CACHE, { keyPath: 'cacheKey' });
        }
      },
    });
  }
  return dbPromise;
}

/** Reset cached DB promise (tests / version migration recovery). */
export function resetOfflineDBPromise(): void {
  dbPromise = null;
}

export {
  STORE_OFFLINE_DOCUMENTS,
  STORE_ATTENDANCE_OUTBOX,
  STORE_ATTENDANCE_ROSTER_CACHE,
};
