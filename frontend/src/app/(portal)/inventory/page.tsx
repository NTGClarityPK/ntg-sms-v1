'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { Skeleton, Stack, Title } from '@mantine/core';

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
    <>
      <div className="page-title-bar">
        <Title order={1}>
          <Skeleton height={28} width={220} />
        </Title>
      </div>
      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Stack gap="md">
          <Skeleton height={40} width="60%" />
          <Skeleton height={200} />
        </Stack>
      </div>
    </>
  );
}
