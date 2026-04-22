'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AuthGuard } from '@/components/common/AuthGuard';
import { BranchGuard } from '@/components/common/BranchGuard';
import { AppShell } from '@/components/layout/AppShell';
import { NotificationsRealtimeSubscription } from '@/components/layout/NotificationsRealtimeSubscription';

const POST_SIGNUP_RELOAD_FLAG = 'ntg_post_signup_reload_v1';
const POST_SIGNUP_RELOADED_FLAG = 'ntg_post_signup_reloaded_v1';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pathname?.startsWith('/dashboard')) return;

    try {
      const shouldReload = window.sessionStorage.getItem(POST_SIGNUP_RELOAD_FLAG);
      const alreadyReloaded = window.sessionStorage.getItem(POST_SIGNUP_RELOADED_FLAG);

      if (shouldReload !== '1' || alreadyReloaded === '1') return;

      // Strict-mode-safe: set flags immediately, schedule reload without a cleanup
      // so React 18 dev double-mount cannot cancel it.
      window.sessionStorage.setItem(POST_SIGNUP_RELOADED_FLAG, '1');
      window.sessionStorage.removeItem(POST_SIGNUP_RELOAD_FLAG);

      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          window.location.reload();
        }, 2500);
      });
    } catch {
      // Non-blocking
    }
  }, [pathname]);

  return (
    <AuthGuard>
      <BranchGuard>
        <NotificationsRealtimeSubscription />
        <AppShell>{children}</AppShell>
      </BranchGuard>
    </AuthGuard>
  );
}








