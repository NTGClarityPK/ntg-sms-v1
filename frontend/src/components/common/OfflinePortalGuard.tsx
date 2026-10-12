'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  isPortalPathAllowedOffline,
  OFFLINE_FALLBACK_PATH,
} from '@/lib/offline/offline-nav';

/**
 * While offline, soft-redirect away from non-whitelisted portal pages.
 * Uses App Router replace (no document reload) so the shell stays alive.
 */
export function OfflinePortalGuard() {
  const isOnline = useOnlineStatus();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isOnline) return;
    if (isPortalPathAllowedOffline(pathname)) return;
    router.replace(OFFLINE_FALLBACK_PATH);
  }, [isOnline, pathname, router]);

  return null;
}
