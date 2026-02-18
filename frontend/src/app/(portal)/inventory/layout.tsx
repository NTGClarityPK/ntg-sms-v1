'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Tabs } from '@mantine/core';
import { useAuth } from '@/hooks/useAuth';
import { useFeaturePermission } from '@/hooks/usePermissions';
import {
  IconList,
  IconClipboardList,
  IconHistory,
} from '@tabler/icons-react';

function getInventoryTabValue(pathname: string): string {
  if (pathname.startsWith('/inventory/items')) return 'items';
  if (pathname.startsWith('/inventory/requests')) return 'requests';
  if (pathname.startsWith('/inventory/history')) return 'history';
  if (pathname === '/inventory' || pathname === '/inventory/') return 'items';
  return 'items';
}

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { canEdit } = useFeaturePermission('inventory');
  const isParent = user?.roles?.some(
    (r) => r.roleName?.toLowerCase() === 'parent',
  ) ?? false;

  const tabValue = getInventoryTabValue(pathname);

  const handleTabChange = (value: string | null) => {
    if (!value) return;
    if (value === 'request') router.push('/uniform-request');
    else router.push(value === 'items' ? '/inventory/items' : `/inventory/${value}`);
  };

  return (
    <>
      <Tabs value={tabValue} onChange={handleTabChange}>
        <Tabs.List>
          {canEdit && (
            <>
              <Tabs.Tab value="items" leftSection={<IconList size={16} />}>
                Manage items
              </Tabs.Tab>
              <Tabs.Tab
                value="requests"
                leftSection={<IconClipboardList size={16} />}
              >
                View requests
              </Tabs.Tab>
              <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
                Issuance history
              </Tabs.Tab>
            </>
          )}
          {isParent && (
            <Tabs.Tab
              value="request"
              leftSection={<IconClipboardList size={16} />}
            >
              Request uniform
            </Tabs.Tab>
          )}
        </Tabs.List>
        <Tabs.Panel value={tabValue} pt="md">
          {children}
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
