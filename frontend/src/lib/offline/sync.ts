import { apiClient } from '@/lib/api-client';
import { getPending, getPendingCount, markComplete, markFailed } from './queue';
import type { SyncQueueItem } from './db';

export const OFFLINE_SYNC_START_EVENT = 'offline-sync-start';

export type SyncProgressListener = (current: number, total: number, item: SyncQueueItem | null, error: string | null) => void;

let listeners: Set<SyncProgressListener> = new Set();
let isSyncing = false;

export function addSyncProgressListener(listener: SyncProgressListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getIsSyncing(): boolean {
  return isSyncing;
}

function notifyProgress(current: number, total: number, item: SyncQueueItem | null, error: string | null): void {
  listeners.forEach((fn) => fn(current, total, item, error));
}

export async function processQueue(): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined') return { synced: 0, failed: 0 };
  if (isSyncing) return { synced: 0, failed: 0 };

  const pending = await getPending();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  isSyncing = true;
  let synced = 0;
  let failed = 0;
  const total = pending.length;

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    notifyProgress(i + 1, total, item, null);
    try {
      switch (item.method) {
        case 'POST':
          await apiClient.post(item.url, item.body);
          break;
        case 'PUT':
          await apiClient.put(item.url, item.body);
          break;
        case 'PATCH':
          await apiClient.patch(item.url, item.body);
          break;
        case 'DELETE':
          await apiClient.delete(item.url);
          break;
        default:
          throw new Error(`Unknown method: ${item.method}`);
      }
      await markComplete(item.id);
      synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await markFailed(item.id, message);
      failed++;
      notifyProgress(i + 1, total, item, message);
    }
  }

  notifyProgress(total, total, null, null);
  isSyncing = false;
  return { synced, failed };
}

export function setupOnlineReconnect(): () => void {
  if (typeof window === 'undefined') return () => {};

  const runSync = () => {
    processQueue();
  };

  const handler = () => {
    runSync();
  };

  window.addEventListener('online', handler);

  // When app loads already online with pending items (e.g. after a refresh), run sync and notify so modal can show
  getPendingCount().then((count) => {
    if (count > 0 && window.navigator.onLine) {
      window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_START_EVENT, { detail: { count } }));
      runSync();
    }
  });

  return () => window.removeEventListener('online', handler);
}
