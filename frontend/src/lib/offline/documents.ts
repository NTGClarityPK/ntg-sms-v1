import { getOfflineDB, STORE_OFFLINE_DOCUMENTS, type OfflineDocumentItem } from './db';

function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export async function saveDocumentForOffline(
  title: string,
  type: string,
  url: string,
  blob: Blob
): Promise<OfflineDocumentItem> {
  const db = await getOfflineDB();
  const item: OfflineDocumentItem = {
    id: generateId(),
    title,
    type,
    url,
    blob,
    savedAt: Date.now(),
    size: blob.size,
  };
  await db.put(STORE_OFFLINE_DOCUMENTS, item);
  return item;
}

export async function listOfflineDocuments(typeFilter?: string): Promise<OfflineDocumentItem[]> {
  const db = await getOfflineDB();
  let items: OfflineDocumentItem[];
  if (typeFilter) {
    items = await db.getAllFromIndex(STORE_OFFLINE_DOCUMENTS, 'byType', typeFilter);
  } else {
    items = await db.getAll(STORE_OFFLINE_DOCUMENTS);
  }
  return items.sort((a, b) => b.savedAt - a.savedAt);
}

export async function getOfflineDocument(id: string): Promise<OfflineDocumentItem | undefined> {
  const db = await getOfflineDB();
  return db.get(STORE_OFFLINE_DOCUMENTS, id);
}

export async function deleteOfflineDocument(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete(STORE_OFFLINE_DOCUMENTS, id);
}

export async function getOfflineDocumentsTotalSize(): Promise<number> {
  const items = await listOfflineDocuments();
  return items.reduce((sum, doc) => sum + doc.size, 0);
}

export async function deleteOfflineDocumentsOlderThan(ms: number): Promise<number> {
  const db = await getOfflineDB();
  const items = await db.getAll(STORE_OFFLINE_DOCUMENTS);
  const cutoff = Date.now() - ms;
  let deleted = 0;
  for (const item of items) {
    if (item.savedAt < cutoff) {
      await db.delete(STORE_OFFLINE_DOCUMENTS, item.id);
      deleted++;
    }
  }
  return deleted;
}
