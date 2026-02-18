'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { Skeleton, Stack } from '@mantine/core';

export default function InventoryDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canEdit } = useFeaturePermission('inventory');
  const isParent = user?.roles?.some(
    (r) => r.roleName?.toLowerCase() === 'parent',
  ) ?? false;

  useEffect(() => {
    if (canEdit) {
      router.replace('/inventory/items');
      return;
    }
    if (isParent) {
      router.replace('/uniform-request');
      return;
    }
    router.replace('/inventory/items');
  }, [router, canEdit, isParent]);

  return (
    <Stack gap="md" p="md">
      <Skeleton height={40} width="60%" />
      <Skeleton height={200} />
    </Stack>
  );
}
