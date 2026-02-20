'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';
import { urlBase64ToUint8Array } from '@/lib/push/vapid';

/**
 * When the user is authenticated and has already granted notification permission,
 * ensures push subscription is registered. Does NOT call requestPermission() on load
 * so Safari (and Firefox) work—they require a user gesture for the permission prompt.
 * For first-time / Safari users, use the "Enable push notifications" button (usePushSubscribe).
 */
export function PushSubscribe() {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }
    // Only auto-subscribe when permission was already granted (e.g. returning Chrome user).
    // Never call requestPermission() here—Safari blocks it without a user gesture.
    if (Notification.permission !== 'granted') return;

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || subscribedRef.current) return;

      const res = await apiClient.get<{ vapidPublicKey: string | null }>('/api/v1/push/vapid-public-key');
      const vapidPublicKey = res.data?.vapidPublicKey ?? null;
      if (!vapidPublicKey) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          subscribedRef.current = true;
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
        subscribedRef.current = true;
      } catch {
        // Subscribe failed; ignore
      }
    };

    run();
  }, []);

  return null;
}
