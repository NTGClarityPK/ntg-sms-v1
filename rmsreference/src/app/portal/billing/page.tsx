'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Title,
  Paper,
  Stack,
  Button,
  Group,
  Text,
  Badge,
  Table,
  Card,
  Grid,
  Divider,
  Modal,
  Alert,
  Loader,
  Skeleton,
  List,
  ThemeIcon,
  Progress,
  Box,
  useMantineTheme,
} from '@mantine/core';
import {
  IconCheck,
  IconCreditCard,
  IconFileInvoice,
  IconAlertCircle,
  IconArrowUp,
  IconArrowDown,
  IconX,
  IconCalendar,
  IconUsers,
  IconMapPin,
  IconShoppingCart,
  IconReceipt,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { subscriptionApi, PlanId, Invoice } from '@/lib/api/subscription';
import { PLAN_CONFIGS } from '@/lib/utils/subscription';
import { useAuthStore } from '@/lib/store/auth-store';
import { getSuccessColor, getErrorColor, useThemeColor } from '@/lib/utils/theme';
import { useLanguageStore, Language } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import dayjs from 'dayjs';

// Map plan feature strings to translation keys
const getFeatureTranslationKey = (feature: string): string => {
  const featureMap: Record<string, string> = {
    'Point of Sale': 'billing.planFeatures.pointOfSale',
    'Menu & Categories': 'billing.planFeatures.menuCategories',
    'Order Management': 'billing.planFeatures.orderManagement',
    'Cash & Card Payments': 'billing.planFeatures.cashCardPayments',
    'Customer Records': 'billing.planFeatures.customerRecords',
    'Dashboard': 'billing.planFeatures.dashboard',
    'Multi-language Interface (Arabic, English)': 'billing.planFeatures.multiLanguageInterface',
    'All Free features': 'billing.planFeatures.allFreeFeatures',
    'Report & Analytics': 'billing.planFeatures.reportAnalytics',
    'All Starter features': 'billing.planFeatures.allStarterFeatures',
    'Multi-location': 'billing.planFeatures.multiLocation',
    'Inventory': 'billing.planFeatures.inventory',
    'AI Features': 'billing.planFeatures.aiFeatures',
    'All Pro features': 'billing.planFeatures.allProFeatures',
    'White-label': 'billing.planFeatures.whiteLabel',
    'SLA': 'billing.planFeatures.sla',
    'API Integrations': 'billing.planFeatures.apiIntegrations',
    'Phone support': 'billing.planFeatures.phoneSupport',
  };
  return featureMap[feature] || feature;
};

// Map plan names to translation keys
const getPlanNameTranslation = (planId: PlanId, language: Language): string => {
  const planNameMap: Record<PlanId, string> = {
    [PlanId.FREE]: 'billing.planNames.free',
    [PlanId.STARTER]: 'billing.planNames.starter',
    [PlanId.PRO]: 'billing.planNames.pro',
    [PlanId.ENTERPRISE]: 'billing.planNames.enterprise',
  };
  const translationKey = planNameMap[planId];
  return translationKey ? t(translationKey as any, language) : planId;
};

export default function BillingPage() {
  const theme = useMantineTheme();
  const themeColor = useThemeColor();
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const { subscription, usage, loading, refresh, refreshUsage } = useSubscription();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<PlanId | null>(null);

  const isTenantOwner = user?.role === 'tenant_owner';
  const subscriptionIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const loadInvoices = useCallback(async () => {
    if (loadingRef.current) return; // Prevent concurrent loads
    
    try {
      loadingRef.current = true;
      setInvoicesLoading(true);
      const data = await subscriptionApi.getInvoices();
      setInvoices(data);
    } catch (error: any) {
      console.error('Failed to load invoices:', error);
      notifications.show({
        title: t('billing.error', language),
        message: t('billing.failedToLoadInvoices', language),
        color: getErrorColor(),
      });
    } finally {
      setInvoicesLoading(false);
      loadingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Only load if tenant owner and subscription exists
    // Check if subscription ID changed to avoid unnecessary reloads
    const currentSubscriptionId = subscription?.id || null;
    
    if (isTenantOwner && subscription && currentSubscriptionId !== subscriptionIdRef.current) {
      subscriptionIdRef.current = currentSubscriptionId;
      loadInvoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTenantOwner, subscription?.id, loadInvoices]);

  // Handle checkout success redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');

    if (success === 'true') {
      // Wait a moment for webhook to process, then refresh subscription data
      const timeoutId = setTimeout(async () => {
        // Force refresh by clearing cache and reloading
        await refresh();
        await refreshUsage();
        subscriptionIdRef.current = null; // Reset to allow reload
        await loadInvoices();
        
        notifications.show({
          title: t('billing.success', language),
          message: t('billing.subscriptionActivated', language),
          color: getSuccessColor(),
        });
        // Clean up URL
        window.history.replaceState({}, '', '/portal/billing');
      }, 2000); // 2 second delay to allow webhook processing
      
      return () => clearTimeout(timeoutId);
    } else if (canceled === 'true') {
      notifications.show({
        title: t('billing.cancelledTitle', language),
        message: t('billing.checkoutCancelled', language),
        color: 'yellow',
      });
      // Clean up URL
      window.history.replaceState({}, '', '/portal/billing');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, refreshUsage, loadInvoices]);

  const handleUpgrade = async (planId: PlanId) => {
    if (!subscription) return;

    try {
      setProcessing(true);
      setProcessingPlanId(planId);
      const currentPlanOrder = getPlanOrder(subscription.planId);
      const newPlanOrder = getPlanOrder(planId);

      if (newPlanOrder > currentPlanOrder) {
        // Upgrade: Must go through checkout to pay prorated amount
        await handleCheckout(planId);
        setUpgradeModalOpen(false);
      } else if (newPlanOrder < currentPlanOrder) {
        // Downgrade: Use API directly (no payment needed)
        await subscriptionApi.downgradePlan(planId);
        notifications.show({
          title: t('billing.success', language),
          message: t('billing.downgradeScheduled', language),
          color: getSuccessColor(),
        });
        await refresh();
        setUpgradeModalOpen(false);
      }
    } catch (error: any) {
      // Extract error message from different possible response formats
      let errorMessage = t('billing.failedToChangePlan', language);
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Handle object with {code, message, details, timestamp} structure
        if (errorData.message && typeof errorData.message === 'object') {
          errorMessage = errorData.message.message || errorData.message.toString();
        }
        // NestJS error format: { message: string } or { message: string[] }
        else if (errorData.message) {
          if (Array.isArray(errorData.message)) {
            errorMessage = errorData.message.join(', ');
          } else if (typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          } else {
            // If message is an object, try to extract a string from it
            errorMessage = errorData.message.message || JSON.stringify(errorData.message);
          }
        } 
        // Handle direct error object with message property
        else if (errorData.error && typeof errorData.error === 'object' && errorData.error.message) {
          errorMessage = errorData.error.message;
        }
        // Handle simple error string
        else if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        }
        // Fallback: if errorData itself is a string
        else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      } else if (error.message) {
        // Handle error.message that might be an object
        if (typeof error.message === 'object') {
          errorMessage = error.message.message || JSON.stringify(error.message);
        } else {
          errorMessage = error.message;
        }
      }
      
      // Ensure errorMessage is always a string
      if (typeof errorMessage !== 'string') {
        errorMessage = t('billing.failedToChangePlan', language);
      }
      
      notifications.show({
        title: t('billing.error', language),
        message: errorMessage,
        color: getErrorColor(),
        autoClose: 5000,
      });
      setProcessing(false);
      setProcessingPlanId(null);
    }
  };

  const handleCheckout = async (planId: PlanId) => {
    try {
      setProcessing(true);
      setProcessingPlanId(planId);
      const successUrl = `${window.location.origin}/portal/billing?success=true`;
      const cancelUrl = `${window.location.origin}/portal/billing?canceled=true`;
      const session = await subscriptionApi.createCheckoutSession(
        planId,
        successUrl,
        cancelUrl,
      );
      if (session?.url) {
        window.location.href = session.url;
      } else {
        throw new Error('No checkout URL returned from server');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      
      // Extract error message from different possible response formats
      let errorMessage = t('billing.failedToCreateCheckout', language);
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Handle object with {code, message, details, timestamp} structure
        if (errorData.message && typeof errorData.message === 'object') {
          errorMessage = errorData.message.message || errorData.message.toString();
        }
        // NestJS error format: { message: string } or { message: string[] }
        else if (errorData.message) {
          if (Array.isArray(errorData.message)) {
            errorMessage = errorData.message.join(', ');
          } else if (typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          } else {
            // If message is an object, try to extract a string from it
            errorMessage = errorData.message.message || JSON.stringify(errorData.message);
          }
        } 
        // Handle direct error object with message property
        else if (errorData.error && typeof errorData.error === 'object' && errorData.error.message) {
          errorMessage = errorData.error.message;
        }
        // Handle simple error string
        else if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        }
        // Fallback: if errorData itself is a string
        else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      } else if (error.message) {
        // Handle error.message that might be an object
        if (typeof error.message === 'object') {
          errorMessage = error.message.message || JSON.stringify(error.message);
        } else {
          errorMessage = error.message;
        }
      }
      
      // Ensure errorMessage is always a string
      if (typeof errorMessage !== 'string') {
        errorMessage = t('billing.failedToCreateCheckout', language);
      }
      
      notifications.show({
        title: t('billing.error', language),
        message: errorMessage,
        color: getErrorColor(),
        autoClose: 5000,
      });
      setProcessing(false);
      setProcessingPlanId(null);
    }
    // Note: Don't reset processing state on success since we're redirecting to Stripe
  };

  const getPlanOrder = (planId: PlanId): number => {
    const order = {
      [PlanId.FREE]: 0,
      [PlanId.STARTER]: 1,
      [PlanId.PRO]: 2,
      [PlanId.ENTERPRISE]: 3,
    };
    return order[planId] ?? -1;
  };

  const getUsagePercentage = (
    used: number,
    limit: number | 'unlimited',
  ): number => {
    if (limit === 'unlimited') return 0;
    return Math.min((used / limit) * 100, 100);
  };

  // Redirect non-owners
  if (!isTenantOwner) {
    return (
      <Paper p="xl">
        <Alert icon={<IconAlertCircle size={16} />} color={getErrorColor()}>
          {t('billing.onlyTenantOwners', language)}
        </Alert>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Stack>
        <Skeleton height={100} />
        <Skeleton height={200} />
        <Skeleton height={300} />
      </Stack>
    );
  }

  if (!subscription) {
    return (
      <Paper p="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          {t('billing.noSubscription', language)}
        </Alert>
      </Paper>
    );
  }

  const currentPlanConfig = PLAN_CONFIGS[subscription.planId];
  const currentPlanOrder = getPlanOrder(subscription.planId);

  return (
    <Stack gap="lg">
      <Title order={2}>{t('billing.title', language)}</Title>

      {/* Current Plan */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text size="lg" fw={600}>
                {t('billing.currentPlan', language, { name: getPlanNameTranslation(subscription.planId, language) })}
              </Text>
              <Text size="sm" c="dimmed">
                {subscription.status === 'active' ? t('billing.active', language) : ''}
                {subscription.status === 'past_due' && t('billing.pastDue', language)}
                {subscription.status === 'cancelled' && t('billing.cancelled', language)}
              </Text>
            </div>
            {(subscription.status === 'active' || subscription.status === 'past_due' || subscription.status === 'cancelled') && (
              <Badge
                styles={{
                  root: {
                    backgroundColor:
                      subscription.status === 'active'
                        ? getSuccessColor()
                        : subscription.status === 'past_due'
                          ? getErrorColor()
                          : theme.colors.gray[6],
                    color: 'white',
                  },
                }}
                size="lg"
              >
                {t('billing.active', language).toUpperCase()}
              </Badge>
            )}
          </Group>

          {(subscription.status === 'active' || subscription.status === 'trial') && subscription.planId !== PlanId.FREE && (
            <Group>
              <Text size="sm">
                <IconCalendar size={16} style={{ verticalAlign: 'middle' }} /> {t('billing.billingPeriod', language, {
                  start: dayjs(subscription.currentPeriodStart).format('MMM D'),
                  end: dayjs(subscription.currentPeriodEnd).format('MMM D, YYYY')
                })}
              </Text>
            </Group>
          )}

          {subscription.paymentMethodLast4 && (
            <Group>
              <IconCreditCard size={16} />
              <Text size="sm">
                {t('billing.paymentMethod', language, {
                  brand: subscription.paymentMethodBrand?.toUpperCase() || '',
                  last4: subscription.paymentMethodLast4
                })}
              </Text>
            </Group>
          )}
        </Stack>
      </Card>

      {/* Usage Metrics */}
      {usage && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} mb="md">
            {t('billing.usage', language)}
          </Title>
          <Stack gap="md">
            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm">
                  <IconMapPin size={16} style={{ verticalAlign: 'middle' }} /> {t('billing.locations', language)}
                </Text>
                <Text size="sm" fw={600}>
                  {usage.branchesUsed} /{' '}
                  {currentPlanConfig.locations === 'unlimited'
                    ? '∞'
                    : currentPlanConfig.locations}
                </Text>
              </Group>
              {currentPlanConfig.locations !== 'unlimited' && (
                <Progress
                  value={getUsagePercentage(
                    usage.branchesUsed,
                    currentPlanConfig.locations,
                  )}
                  color={getUsagePercentage(usage.branchesUsed, currentPlanConfig.locations) > 80 ? 'red' : 'blue'}
                  styles={{
                    section: {
                      backgroundColor: getUsagePercentage(usage.branchesUsed, currentPlanConfig.locations) > 80
                        ? getErrorColor()
                        : themeColor,
                    },
                  }}
                  size="sm"
                />
              )}
            </div>

            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm">
                  <IconUsers size={16} style={{ verticalAlign: 'middle' }} /> {t('billing.users', language)}
                </Text>
                <Text size="sm" fw={600}>
                  {usage.usersUsed} /{' '}
                  {currentPlanConfig.users === 'unlimited'
                    ? '∞'
                    : currentPlanConfig.users}
                </Text>
              </Group>
              {currentPlanConfig.users !== 'unlimited' && (
                <Progress
                  value={getUsagePercentage(usage.usersUsed, currentPlanConfig.users)}
                  color={getUsagePercentage(usage.usersUsed, currentPlanConfig.users) > 80 ? 'red' : 'blue'}
                  styles={{
                    section: {
                      backgroundColor: getUsagePercentage(usage.usersUsed, currentPlanConfig.users) > 80
                        ? getErrorColor()
                        : themeColor,
                    },
                  }}
                  size="sm"
                />
              )}
            </div>

            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm">
                  <IconShoppingCart size={16} style={{ verticalAlign: 'middle' }} /> {t('billing.menuItems', language)}
                </Text>
                <Text size="sm" fw={600}>
                  {usage.menuItemsUsed} /{' '}
                  {currentPlanConfig.menuItems === 'unlimited'
                    ? '∞'
                    : currentPlanConfig.menuItems}
                </Text>
              </Group>
              {currentPlanConfig.menuItems !== 'unlimited' && (
                <Progress
                  value={getUsagePercentage(
                    usage.menuItemsUsed,
                    currentPlanConfig.menuItems,
                  )}
                  color={getUsagePercentage(usage.menuItemsUsed, currentPlanConfig.menuItems) > 80 ? 'red' : 'blue'}
                  styles={{
                    section: {
                      backgroundColor: getUsagePercentage(
                        usage.menuItemsUsed,
                        currentPlanConfig.menuItems,
                      ) > 80
                        ? getErrorColor()
                        : themeColor,
                    },
                  }}
                  size="sm"
                />
              )}
            </div>

            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm">
                  <IconReceipt size={16} style={{ verticalAlign: 'middle' }} /> {t('billing.ordersThisMonth', language)}
                </Text>
                <Text size="sm" fw={600}>
                  {usage.ordersCount} /{' '}
                  {currentPlanConfig.ordersMonth === 'unlimited'
                    ? '∞'
                    : currentPlanConfig.ordersMonth.toLocaleString()}
                </Text>
              </Group>
              {currentPlanConfig.ordersMonth !== 'unlimited' && (
                <Progress
                  value={getUsagePercentage(
                    usage.ordersCount,
                    currentPlanConfig.ordersMonth,
                  )}
                  color={getUsagePercentage(usage.ordersCount, currentPlanConfig.ordersMonth) > 80 ? 'red' : 'blue'}
                  styles={{
                    section: {
                      backgroundColor: getUsagePercentage(usage.ordersCount, currentPlanConfig.ordersMonth) > 80
                        ? getErrorColor()
                        : themeColor,
                    },
                  }}
                  size="sm"
                />
              )}
            </div>
          </Stack>
        </Card>
      )}

      {/* Plan Comparison */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>{t('billing.plans', language)}</Title>
        </Group>

        <Grid gutter="md" style={{ alignItems: 'stretch' }}>
          {Object.entries(PLAN_CONFIGS).map(([planId, config]) => {
            const planOrder = getPlanOrder(planId as PlanId);
            const isCurrentPlan = subscription.planId === planId;
            const canUpgrade = planOrder > currentPlanOrder;
            const canDowngrade = planOrder < currentPlanOrder;

            return (
              <Grid.Col key={planId} span={{ base: 12, md: 6, lg: 3 }}>
                <Card
                  shadow={isCurrentPlan ? 'lg' : 'sm'}
                  padding="lg"
                  radius="md"
                  withBorder
                  style={{
                    border: isCurrentPlan ? '2px solid' : undefined,
                    borderColor: isCurrentPlan ? themeColor : undefined,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
                    <Group justify="space-between">
                      <Text fw={600} size="lg">
                        {getPlanNameTranslation(planId as PlanId, language)}
                      </Text>
                      {isCurrentPlan && (
                        <Badge
                          styles={{
                            root: {
                              backgroundColor: themeColor,
                              color: 'white',
                            },
                          }}
                        >
                          {t('billing.current', language)}
                        </Badge>
                      )}
                    </Group>

                    <div>
                      <Text size="xl" fw={700}>
                        {planId === PlanId.ENTERPRISE ? t('billing.custom', language) : `$${config.price}`}
                      </Text>
                      {config.price >= 0 && <Text size="sm" c="dimmed">{t('billing.perMonth', language)}</Text>}
                    </div>

                    {/* Plan Limits */}
                    <Divider my="md" />
                    <Stack gap="xs">
                      <Text size="sm" fw={600}>{t('billing.limits', language)}</Text>
                      <Group gap="xs" justify="space-between">
                        <Text size="xs" c="dimmed">{t('billing.locations', language)}:</Text>
                        <Text size="xs" fw={500}>
                          {config.locations === 'unlimited' ? '∞' : config.locations}
                        </Text>
                      </Group>
                      <Group gap="xs" justify="space-between">
                        <Text size="xs" c="dimmed">{t('billing.users', language)}:</Text>
                        <Text size="xs" fw={500}>
                          {config.users === 'unlimited' ? '∞' : config.users}
                        </Text>
                      </Group>
                      <Group gap="xs" justify="space-between">
                        <Text size="xs" c="dimmed">{t('billing.menuItems', language)}:</Text>
                        <Text size="xs" fw={500}>
                          {config.menuItems === 'unlimited' ? '∞' : config.menuItems}
                        </Text>
                      </Group>
                      <Group gap="xs" justify="space-between">
                        <Text size="xs" c="dimmed">{t('billing.ordersPerMonth', language)}</Text>
                        <Text size="xs" fw={500}>
                          {config.ordersMonth === 'unlimited' ? '∞' : config.ordersMonth.toLocaleString()}
                        </Text>
                      </Group>
                    </Stack>

                    <Box style={{ flex: 1, minHeight: 0 }}>
                      <List
                        spacing="xs"
                        size="sm"
                        icon={
                          <ThemeIcon
                            styles={{
                              root: {
                                backgroundColor: getSuccessColor(),
                                color: 'white',
                              },
                            }}
                            size={16}
                            radius="xl"
                          >
                            <IconCheck size={10} />
                          </ThemeIcon>
                        }
                      >
                        {config.features.map((feature, idx) => {
                          const translationKey = getFeatureTranslationKey(feature);
                          return (
                            <List.Item key={idx}>
                              {translationKey.startsWith('billing.') 
                                ? t(translationKey as any, language)
                                : feature}
                            </List.Item>
                          );
                        })}
                      </List>
                    </Box>

                    {!isCurrentPlan && (
                      <Button
                        fullWidth
                        variant={canUpgrade ? 'filled' : 'outline'}
                        leftSection={
                          processingPlanId !== planId && (canUpgrade ? (
                            <IconArrowUp size={16} />
                          ) : (
                            <IconArrowDown size={16} />
                          ))
                        }
                        onClick={() => {
                          if (config.price === 0) {
                            // Enterprise - contact sales
                            window.open('/contact', '_blank');
                          } else if (canDowngrade && subscription.status === 'active' && subscription.planId !== PlanId.FREE) {
                            // Downgrade: use API directly (no payment needed)
                            handleUpgrade(planId as PlanId);
                          } else {
                            // Upgrade or new subscription: use checkout to pay
                            handleCheckout(planId as PlanId);
                          }
                        }}
                        disabled={processing}
                        loading={processingPlanId === planId}
                      >
                        {canUpgrade ? t('billing.upgrade', language) : canDowngrade ? t('billing.downgrade', language) : t('billing.select', language)}
                      </Button>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>
            );
          })}
        </Grid>
      </Card>

      {/* Invoices */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={3} mb="md">
          {t('billing.billingHistory', language)}
        </Title>
        {invoicesLoading ? (
          <Loader />
        ) : invoices.length === 0 ? (
          <Text c="dimmed">{t('billing.noInvoices', language)}</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('billing.invoiceNumber', language)}</Table.Th>
                <Table.Th>{t('billing.date', language)}</Table.Th>
                <Table.Th>{t('billing.amount', language)}</Table.Th>
                <Table.Th>{t('billing.status', language)}</Table.Th>
                <Table.Th>{t('billing.period', language)}</Table.Th>
                <Table.Th>{t('billing.actions', language)}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {invoices.map((invoice) => (
                <Table.Tr key={invoice.id}>
                  <Table.Td>{invoice.invoiceNumber}</Table.Td>
                  <Table.Td>
                    {dayjs(invoice.createdAt).format('MMM D, YYYY')}
                  </Table.Td>
                  <Table.Td>${invoice.amount.toFixed(2)}</Table.Td>
                  <Table.Td>
                    <Badge
                      styles={{
                        root: {
                          backgroundColor: invoice.status === 'paid' ? getSuccessColor() : getErrorColor(),
                          color: 'white',
                        },
                      }}
                    >
                      {invoice.status === 'paid' ? t('billing.paid', language) : invoice.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {dayjs(invoice.periodStart).format('MMM D')} -{' '}
                    {dayjs(invoice.periodEnd).format('MMM D, YYYY')}
                  </Table.Td>
                  <Table.Td>
                    {invoice.invoicePdfUrl && (
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<IconFileInvoice size={14} />}
                        onClick={() => window.open(invoice.invoicePdfUrl, '_blank')}
                      >
                        {t('billing.download', language)}
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      
    </Stack>
  );
}

