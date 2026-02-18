'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const ALERTS_CHANGED_EVENT = 'notification-alerts-changed';

function getStorageKey(userId: string) {
  return `notification-alerts-enabled:${userId}`;
}

function readInitialValue(storageKey: string) {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(storageKey);
  if (raw == null) return true;
  return raw === 'true';
}

export function useNotificationAlertSettings(userId: string | undefined) {
  const storageKey = useMemo(
    () => (userId ? getStorageKey(userId) : null),
    [userId],
  );

  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(() => {
    if (!storageKey) return true;
    return readInitialValue(storageKey);
  });

  useEffect(() => {
    if (!storageKey) return;
    setAlertsEnabled(readInitialValue(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    if (typeof window === 'undefined') return;

    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      setAlertsEnabled(readInitialValue(storageKey));
    };

    const onCustom = (e: Event) => {
      const custom = e as CustomEvent<{ storageKey?: string }>;
      if (custom.detail?.storageKey !== storageKey) return;
      setAlertsEnabled(readInitialValue(storageKey));
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(ALERTS_CHANGED_EVENT, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ALERTS_CHANGED_EVENT, onCustom);
    };
  }, [storageKey]);

  const update = useCallback(
    (value: boolean) => {
      setAlertsEnabled(value);
      if (!storageKey) return;
      try {
        window.localStorage.setItem(storageKey, String(value));
        window.dispatchEvent(
          new CustomEvent(ALERTS_CHANGED_EVENT, { detail: { storageKey } }),
        );
      } catch {
        // Ignore storage errors (private mode / quota)
      }
    },
    [storageKey],
  );

  const toggleAlertsEnabled = useCallback(() => {
    update(!alertsEnabled);
  }, [alertsEnabled, update]);

  return { alertsEnabled, setAlertsEnabled: update, toggleAlertsEnabled };
}

