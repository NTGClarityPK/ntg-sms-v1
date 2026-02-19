import { getOfflineDB, STORE_SYNC_QUEUE, type SyncQueueItem } from './db';

const MAX_RETRIES = 3;

function generateId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export async function enqueue(
  method: SyncQueueItem['method'],
  url: string,
  body: unknown
): Promise<SyncQueueItem> {
  const db = await getOfflineDB();
  const item: SyncQueueItem = {
    id: generateId(),
    method,
    url,
    body,
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
  };
  await db.put(STORE_SYNC_QUEUE, item);
  return item;
}

export async function getPending(): Promise<SyncQueueItem[]> {
  const db = await getOfflineDB();
  const all = await db.getAllFromIndex(STORE_SYNC_QUEUE, 'byStatus', 'pending');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function markComplete(id: string): Promise<void> {
  const db = await getOfflineDB();
  const item = await db.get(STORE_SYNC_QUEUE, id);
  if (item) {
    await db.put(STORE_SYNC_QUEUE, { ...item, status: 'complete' });
  }
}

export async function markFailed(id: string, errorMessage: string): Promise<void> {
  const db = await getOfflineDB();
  const item = await db.get(STORE_SYNC_QUEUE, id);
  if (item) {
    const retryCount = item.retryCount + 1;
    const status = retryCount >= MAX_RETRIES ? 'failed' : 'pending';
    await db.put(STORE_SYNC_QUEUE, {
      ...item,
      retryCount,
      status,
      errorMessage,
    });
  }
}

export async function getPendingCount(): Promise<number> {
  const db = await getOfflineDB();
  return db.countFromIndex(STORE_SYNC_QUEUE, 'byStatus', 'pending');
}

export async function subscribePendingCount(callback: (count: number) => void): Promise<() => void> {
  let cancelled = false;
  const tick = async () => {
    if (cancelled || typeof window === 'undefined') return;
    const count = await getPendingCount();
    callback(count);
    if (!cancelled) {
      setTimeout(tick, 500);
    }
  };
  tick();
  return () => {
    cancelled = true;
  };
}
