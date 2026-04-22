'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { LOCALE_REPAIR_REFRESH_FLAG } from '@/lib/ui-locale';

/** After /auth/me corrects NEXT_LOCALE on the client, refresh the RSC tree so next-intl matches the new cookie. */
export function LocaleRepairRefresh() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.sessionStorage.getItem(LOCALE_REPAIR_REFRESH_FLAG) === '1') {
        window.sessionStorage.removeItem(LOCALE_REPAIR_REFRESH_FLAG);
        // On the first post-signup dashboard load, `router.refresh()` can occasionally leave the UI blank
        // until the user manually refreshes. A single hard reload is more reliable in that moment.
        if (pathname?.startsWith('/dashboard')) {
          window.location.reload();
          return;
        }
        router.refresh();
      }
    } catch {
      // Non-blocking
    }
  }, [router, pathname]);

  return null;
}
