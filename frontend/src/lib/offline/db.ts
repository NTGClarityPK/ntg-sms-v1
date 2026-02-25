import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'ntg-sms-offline';
const DB_VERSION = 2;
const STORE_OFFLINE_DOCUMENTS = 'offline_documents';

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

export { STORE_OFFLINE_DOCUMENTS };
