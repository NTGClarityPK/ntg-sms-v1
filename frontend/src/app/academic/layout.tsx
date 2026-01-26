'use client';

import { AuthGuard } from '@/components/common/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';

export default function AcademicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}

