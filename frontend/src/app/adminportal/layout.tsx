'use client';

import { AdminAppShell } from '@/components/layout/AdminAppShell';
import { AdminAuthGuard } from '@/components/common/AdminAuthGuard';

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <AdminAppShell>{children}</AdminAppShell>
    </AdminAuthGuard>
  );
}
