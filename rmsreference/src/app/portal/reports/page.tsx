'use client';

import { useState, useEffect } from 'react';
import { Tabs, Title, Center, Paper, Stack, Text } from '@mantine/core';
import { IconWifiOff } from '@tabler/icons-react';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import {
  SalesReportPage,
  OrdersReportPage,
  CustomersReportPage,
  FinancialReportPage,
  TaxReportPage,
  TopItemsReportPage,
} from '@/features/reports';
import { InventoryReportsPage } from '@/features/inventory';
import { useSyncStatus } from '@/lib/hooks/use-sync-status';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { planHasReports } from '@/lib/utils/subscription';
import { PlanId } from '@/lib/api/subscription';
import { useRouter } from 'next/navigation';
import { getErrorColor } from '@/lib/utils/theme';
import { InventoryRefreshProvider } from '@/lib/contexts/inventory-refresh-context';

export default function ReportsPage() {
  const language = useLanguageStore((state) => state.language);
  const { isOnline } = useSyncStatus();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string | null>('sales');

  // Check subscription access - prevent rendering if user doesn't have access
  useEffect(() => {
    if (!subscriptionLoading && subscription) {
      const planId = subscription.planId as PlanId;
      if (!planHasReports(planId)) {
        // RouteGuard will handle the redirect and notification
        router.push('/portal/dashboard');
      }
    }
  }, [subscription, subscriptionLoading, router]);

  // Redirect if offline
  useEffect(() => {
    if (!isOnline) {
      router.push('/portal/orders');
    }
  }, [isOnline, router]);

  // Don't render content if subscription is loading or user doesn't have access
  // RouteGuard will handle redirect, but we need to render something to avoid hooks error
  const hasAccess = !subscriptionLoading && subscription && planHasReports(subscription.planId as PlanId);

  if (!isOnline) {
    return (
      <Center h="100vh">
        <Paper p="xl" radius="md" withBorder>
          <Stack align="center" gap="md">
            <IconWifiOff size={48} color={getErrorColor()} />
            <Text size="lg" fw={500}>
              {t('navigation.offlineDisabled' as any, language) || 'Reports section is not available offline'}
            </Text>
            <Text size="sm" c="dimmed">
              {t('navigation.offlineRedirect' as any, language) || 'Redirecting to Orders...'}
            </Text>
          </Stack>
        </Paper>
      </Center>
    );
  }

  // Don't render content if user doesn't have access - RouteGuard will redirect
  if (!hasAccess) {
    return null;
  }

  return (
    <>
      <div className="page-title-bar">
        <Title order={1} style={{ margin: 0, textAlign: 'left' }}>
          {t('reports.title' as any, language) || 'Reports & Analytics'}
        </Title>
      </div>

      <div className="page-sub-title-bar"></div>

      <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
        <Tabs value={activeTab} onChange={setActiveTab} data-active-tab={activeTab}>
          <Tabs.List>
            <Tabs.Tab value="sales">
              {t('reports.sales' as any, language) || 'Sales Reports'}
            </Tabs.Tab>
            <Tabs.Tab value="orders">
              {t('reports.orders' as any, language) || 'Order Reports'}
            </Tabs.Tab>
            <Tabs.Tab value="customers">
              {t('reports.customers' as any, language) || 'Customer Reports'}
            </Tabs.Tab>
            <Tabs.Tab value="inventory">
              {t('navigation.inventory', language) || 'Inventory'}
            </Tabs.Tab>
            <Tabs.Tab value="financial">
              {t('reports.financial' as any, language) || 'Financial Reports'}
            </Tabs.Tab>
            <Tabs.Tab value="tax">
              {t('reports.tax' as any, language) || 'Tax Reports'}
            </Tabs.Tab>
            <Tabs.Tab value="top-items">
              {t('reports.topItems' as any, language) || 'Top Items'}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="sales" pt="md" px="md" pb="md" data-tab-value="sales">
            <SalesReportPage />
          </Tabs.Panel>

          <Tabs.Panel value="orders" pt="md" px="md" pb="md" data-tab-value="orders">
            <OrdersReportPage />
          </Tabs.Panel>

          <Tabs.Panel value="customers" pt="md" px="md" pb="md" data-tab-value="customers">
            <CustomersReportPage />
          </Tabs.Panel>

          <Tabs.Panel value="inventory" pt="md" px="md" pb="md" data-tab-value="inventory">
            <InventoryRefreshProvider>
              <InventoryReportsPage />
            </InventoryRefreshProvider>
          </Tabs.Panel>

          <Tabs.Panel value="financial" pt="md" px="md" pb="md" data-tab-value="financial">
            <FinancialReportPage />
          </Tabs.Panel>

          <Tabs.Panel value="tax" pt="md" px="md" pb="md" data-tab-value="tax">
            <TaxReportPage />
          </Tabs.Panel>

          <Tabs.Panel value="top-items" pt="md" px="md" pb="md" data-tab-value="top-items">
            <TopItemsReportPage />
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}
