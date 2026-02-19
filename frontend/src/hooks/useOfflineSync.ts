'use client';

import { useState, useEffect } from 'react';
import { getPendingCount } from '@/lib/offline/queue';
import { setupOnlineReconnect, getIsSyncing, addSyncProgressListener } from '@/lib/offline/sync';

export function useOfflineSync(): {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncError: string | null;
} {
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== 'undefined' ? window.navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOnline = () => setIsOnline(window.navigator.onLine);
    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    const unsubscribeReconnect = setupOnlineReconnect();

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      unsubscribeReconnect();
    };
  }, []);

  // Always poll pending count so "X pending" appears soon after an offline action
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const count = await getPendingCount();
      setPendingCount(count);
      setIsSyncing(getIsSyncing());
      if (!cancelled) setTimeout(tick, 500);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = addSyncProgressListener((_current, _total, _item, error) => {
      setIsSyncing(getIsSyncing());
      setLastSyncError(error);
      if (!error) {
        getPendingCount().then(setPendingCount);
      }
    });
    return unsubscribe;
  }, []);

  return { isOnline, pendingCount, isSyncing, lastSyncError };
}
