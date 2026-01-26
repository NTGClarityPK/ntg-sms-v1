'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/common/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // No redirect needed - users can select branch from header switcher

  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}

