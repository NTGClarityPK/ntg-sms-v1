'use client';

import { useEffect } from 'react';

export function PortalServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-blocking: app should still work without service worker.
    });
  }, []);

  return null;
}
