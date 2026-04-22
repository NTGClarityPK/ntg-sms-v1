'use client';

import { AuthGuard } from '@/components/common/AuthGuard';
import { BranchGuard } from '@/components/common/BranchGuard';
import { AppShell } from '@/components/layout/AppShell';
import { NotificationsRealtimeSubscription } from '@/components/layout/NotificationsRealtimeSubscription';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <BranchGuard>
        <NotificationsRealtimeSubscription />
        <AppShell>{children}</AppShell>
      </BranchGuard>
    </AuthGuard>
  );
}








