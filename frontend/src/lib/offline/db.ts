import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'ntg-sms-offline';
const DB_VERSION = 2;
const STORE_SYNC_QUEUE = 'sync_queue';
const STORE_OFFLINE_DOCUMENTS = 'offline_documents';

export interface SyncQueueItem {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  createdAt: number;
  retryCount: number;
  status: 'pending' | 'complete' | 'failed';
  errorMessage?: string;
}

export interface OfflineDocumentItem {
  id: string;
  title: string;
  type: string;
  url: string;
  blob: Blob;
  savedAt: number;
  size: number;
}

interface OfflineDBSchema {
  [STORE_SYNC_QUEUE]: { key: string; value: SyncQueueItem; indexes: { byStatus: string; byCreated: string } };
  [STORE_OFFLINE_DOCUMENTS]: { key: string; value: OfflineDocumentItem; indexes: { byType: string; bySaved: string } };
}

let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

export function getOfflineDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB only available in browser'));
  }
  if (!dbPromise) {
    dbPromise = openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
          const queueStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' });
          queueStore.createIndex('byStatus', 'status');
          queueStore.createIndex('byCreated', 'createdAt');
        }
        if (!db.objectStoreNames.contains(STORE_OFFLINE_DOCUMENTS)) {
          const docStore = db.createObjectStore(STORE_OFFLINE_DOCUMENTS, { keyPath: 'id' });
          docStore.createIndex('byType', 'type');
          docStore.createIndex('bySaved', 'savedAt');
        }
      },
    });
  }
  return dbPromise;
}

export { STORE_SYNC_QUEUE, STORE_OFFLINE_DOCUMENTS };
