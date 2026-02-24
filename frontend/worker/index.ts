/**
 * Custom worker code injected by next-pwa. Handles push and notificationclick.
 * Runs in ServiceWorkerGlobalScope; use sw for typed access to registration/clients.
 *
 * We also handle fetch for API requests first: pass them through to the network only.
 * This prevents Workbox's cross-origin NetworkFirst route from intercepting them and
 * throwing "no-response" when the network fails (e.g. backend unreachable).
 */
function isApiRequest(url: URL): boolean {
  return url.pathname.includes('/api/');
}

interface FetchEventLike {
  request: Request;
  respondWith(r: Promise<Response> | Response): void;
}

self.addEventListener('fetch', (event: Event) => {
  const ev = event as unknown as FetchEventLike;
  const req = ev.request;
  try {
    const url = new URL(req.url);
    if (!isApiRequest(url)) return;
    ev.respondWith(fetch(req));
  } catch {
    // Ignore URL parse errors; let other handlers deal with it
  }
}, { capture: true });

interface SWScope {
  registration: { showNotification(title: string, options?: NotificationOptions): Promise<void> };
  location: { origin: string };
  clients: {
    matchAll(opts: { type: string; includeUncontrolled: boolean }): Promise<WindowClient[]>;
    openWindow?(url: string): Promise<WindowClient | null>;
  };
}
interface WindowClient {
  url: string;
  visibilityState?: string;
  focused?: boolean;
  navigate(url: string): Promise<WindowClient | null>;
  focus(): Promise<WindowClient>;
}
const sw = self as unknown as SWScope;

self.addEventListener('push', (event: Event) => {
  const e = event as unknown as { data?: { json(): unknown; text(): string }; waitUntil(p: Promise<unknown>): void };
  let payload: { title?: string; body?: string; url?: string; tag?: string };
  if (!e.data) {
    payload = { title: 'Notification', body: '', url: '/', tag: 'notification' };
  } else {
    try {
      payload = e.data.json() as { title?: string; body?: string; url?: string; tag?: string };
    } catch {
      payload = { title: 'Notification', body: e.data.text(), url: '/', tag: 'notification' };
    }
  }
  const title = payload.title ?? 'Notification';
  const options: NotificationOptions = {
    body: payload.body ?? '',
    tag: payload.tag ?? 'notification',
    data: { url: payload.url ?? '/' },
    requireInteraction: false,
  };
  // Always show system notification so it appears in the OS tray when the app is minimized.
  const promise = sw.registration
    .showNotification(title, options)
    .catch((err: unknown) => {
      // Permission revoked or browser blocked; log for debugging (visible in SW devtools).
      console.error('[SW] showNotification failed:', err);
    });
  e.waitUntil(promise);
});

self.addEventListener('notificationclick', (event: Event) => {
  const e = event as unknown as { notification: { close(): void; data?: { url?: string } }; waitUntil(p: Promise<unknown>): void };
  e.notification.close();
  const url = (e.notification.data?.url as string) ?? '/';
  const fullUrl = new URL(url, sw.location.origin).href;
  e.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(sw.location.origin) && 'focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(fullUrl);
      }
    }),
  );
});
