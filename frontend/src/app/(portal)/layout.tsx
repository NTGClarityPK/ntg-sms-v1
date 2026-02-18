'use client';

import { AuthGuard } from '@/components/common/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { NotificationsRealtimeSubscription } from '@/components/layout/NotificationsRealtimeSubscription';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <NotificationsRealtimeSubscription />
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}








