/**
 * Custom worker code injected by next-pwa. Handles push and notificationclick.
 * Runs in ServiceWorkerGlobalScope; use sw for typed access to registration/clients.
 */
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
  if (!e.data) return;
  const payload = (() => {
    try {
      return e.data.json() as { title?: string; body?: string; url?: string; tag?: string };
    } catch {
      return { title: 'Notification', body: e.data.text(), url: '/', tag: 'notification' };
    }
  })();
  const title = payload.title ?? 'Notification';
  const options: NotificationOptions = {
    body: payload.body ?? '',
    tag: payload.tag ?? 'notification',
    data: { url: payload.url ?? '/' },
    requireInteraction: false,
  };
  // Only show system notification when no window is visible (app closed or in background tab).
  // When a window is visible, in-app toast (Realtime) is shown instead to avoid duplicate.
  const promise = sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    const hasVisibleWindow = clientList.some((c) => (c as WindowClient).visibilityState === 'visible');
    if (!hasVisibleWindow) {
      return sw.registration.showNotification(title, options);
    }
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
