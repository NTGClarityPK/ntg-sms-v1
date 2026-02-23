'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';
import { urlBase64ToUint8Array } from '@/lib/push/vapid';

/** Cached VAPID key and SW registration so subscribe is fast after permission. */
interface PushCache {
  vapidPublicKey: string | null;
  registration: ServiceWorkerRegistration | null;
}

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
  const [isSubscribing, setIsSubscribing] = useState(false);
  const cacheRef = useRef<PushCache>({ vapidPublicKey: null, registration: null });

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  /** Pre-warm VAPID and SW so subscribe is fast when user grants permission. */
  useEffect(() => {
    if (!enabled || !isSupported || typeof window === 'undefined') return;
    const cache = cacheRef.current;
    (async () => {
      try {
        const [vapidRes, registration] = await Promise.all([
          apiClient.get<{ vapidPublicKey: string | null }>('/api/v1/push/vapid-public-key'),
          navigator.serviceWorker.ready,
        ]);
        cache.vapidPublicKey = vapidRes.data?.vapidPublicKey ?? null;
        cache.registration = registration;
      } catch {
        // ignore; performSubscribe will fetch again
      }
    })();
  }, [enabled, isSupported]);

  const performSubscribe = useCallback(async () => {
    if (!isSupported) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const cache = cacheRef.current;
    let vapidPublicKey = cache.vapidPublicKey;
    let registration = cache.registration;
    if (!vapidPublicKey) {
      const res = await apiClient.get<{ vapidPublicKey: string | null }>('/api/v1/push/vapid-public-key');
      vapidPublicKey = res.data?.vapidPublicKey ?? null;
      if (vapidPublicKey) cache.vapidPublicKey = vapidPublicKey;
    }
    if (!registration) {
      registration = await navigator.serviceWorker.ready;
      cache.registration = registration;
    }
    if (!vapidPublicKey || !registration) return;

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
      setIsLoading(false);
      if (perm !== 'granted') return;
      setIsSubscribing(true);
      try {
        await performSubscribe();
      } catch {
        // subscribe failed; permission still granted
      } finally {
        setIsSubscribing(false);
      }
    } catch {
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
    isSubscribing,
    needsPermission: isSupported && permission !== 'granted',
  };
}
