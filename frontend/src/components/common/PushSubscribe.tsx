'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';
import { urlBase64ToUint8Array } from '@/lib/push/vapid';

/**
 * When the user is authenticated, requests notification permission and subscribes
 * to Web Push, then sends the subscription to the backend. Renders nothing.
 */
export function PushSubscribe() {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || subscribedRef.current) return;

      const res = await apiClient.get<{ vapidPublicKey: string | null }>('/api/v1/push/vapid-public-key');
      const vapidPublicKey = res.data?.vapidPublicKey ?? null;
      if (!vapidPublicKey) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

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
        // Permission denied or subscribe failed; ignore
      }
    };

    run();
  }, []);

  return null;
}
