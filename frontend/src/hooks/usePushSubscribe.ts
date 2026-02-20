'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';
import { urlBase64ToUint8Array } from '@/lib/push/vapid';

/**
 * Push subscription state and user-triggered subscribe.
 * Safari (and Firefox) require a user gesture before Notification.requestPermission();
 * use requestSubscribe() from a button click, then permission and subscribe run.
 */
export function usePushSubscribe(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const performSubscribe = useCallback(async () => {
    if (!isSupported) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await apiClient.get<{ vapidPublicKey: string | null }>('/api/v1/push/vapid-public-key');
    const vapidPublicKey = res.data?.vapidPublicKey ?? null;
    if (!vapidPublicKey) return;

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      setIsSubscribed(true);
      return;
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
    const json = subscription.toJSON();
    await apiClient.post('/api/v1/push/subscribe', {
      endpoint: json.endpoint,
      keys: json.keys,
    });
    setIsSubscribed(true);
  }, [isSupported]);

  /** Call from a user gesture (e.g. button click). Required for Safari/Firefox. */
  const requestSubscribe = useCallback(async () => {
    if (!isSupported) return;
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;
      await performSubscribe();
    } catch {
      // Permission denied or subscribe failed
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, performSubscribe]);

  /** Unsubscribe from push and remove from backend. Call from button click. */
  const disablePush = useCallback(async () => {
    if (!isSupported) return;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await apiClient.delete('/api/v1/push/subscribe', { data: { endpoint } });
      }
      setIsSubscribed(false);
    } catch {
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Sync permission and subscription state on mount
  useEffect(() => {
    if (!enabled || !isSupported || typeof window === 'undefined') return;
    setPermission(Notification.permission);
    let cancelled = false;
    (async () => {
      if (Notification.permission !== 'granted') return;
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (cancelled) return;
        setIsSubscribed(!!existing);
        if (!existing) await performSubscribe();
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, isSupported, performSubscribe]);

  return {
    requestSubscribe,
    disablePush,
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    needsPermission: isSupported && permission !== 'granted',
  };
}
