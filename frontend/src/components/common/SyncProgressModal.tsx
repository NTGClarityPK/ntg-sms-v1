'use client';

import { useEffect, useState, useRef } from 'react';
import { Modal, Progress, Text, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { addSyncProgressListener, getIsSyncing, OFFLINE_SYNC_START_EVENT } from '@/lib/offline/sync';
import { getPendingCount } from '@/lib/offline/queue';
import { queryClient } from '@/lib/query-client';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export function SyncProgressModal() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { isOnline, pendingCount } = useOfflineSync();
  const prevOnlineRef = useRef(isOnline);

  // When we come back online and have pending items, open modal immediately so it's visible before sync drains the queue
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (wasOffline && isOnline && pendingCount > 0) {
      setTotal(pendingCount);
      setCurrent(0);
      setError(null);
      setOpen(true);
    }
  }, [isOnline, pendingCount]);

  useEffect(() => {
    const checkPending = async () => {
      const count = await getPendingCount();
      if (count > 0 && window.navigator.onLine) {
        setTotal(count);
        setCurrent(0);
        setError(null);
        setOpen(true);
      }
    };

    const onSyncStart = (e: Event) => {
      const count = (e as CustomEvent<{ count: number }>).detail?.count ?? 0;
      if (count > 0) {
        setTotal(count);
        setCurrent(0);
        setError(null);
        setOpen(true);
      }
    };

    window.addEventListener('online', checkPending);
    window.addEventListener(OFFLINE_SYNC_START_EVENT, onSyncStart);
    checkPending();

    return () => {
      window.removeEventListener('online', checkPending);
      window.removeEventListener(OFFLINE_SYNC_START_EVENT, onSyncStart);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = addSyncProgressListener((c, t, _item, err) => {
      setCurrent(c);
      setTotal(t);
      setError(err);
      if (t > 0 && c >= t && !getIsSyncing()) {
        const hadError = !!err;
        if (!hadError && t > 0) {
          notifications.show({
            title: 'Synced',
            message: 'Your changes have been synced successfully.',
            color: 'green',
          });
          queryClient.invalidateQueries({ queryKey: ['leaves'], exact: false });
        }
        setTimeout(() => setOpen(false), 1500);
      }
    });
    return unsubscribe;
  }, []);

  const progress = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <Modal
      opened={open}
      onClose={() => setOpen(false)}
      title="Syncing changes"
      closeOnClickOutside={false}
      withCloseButton={!getIsSyncing()}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {total > 0 ? `Syncing ${current} of ${total} change(s)…` : 'Preparing sync…'}
        </Text>
        <Progress value={progress} size="lg" />
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
