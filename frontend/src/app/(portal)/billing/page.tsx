'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Grid,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { plans } from '@/lib/constants/plans';
import {
  classifyTransition,
  marketingPlanNameToId,
  planDisplayName,
} from '@/lib/subscription/plan-transition';
import {
  buildPlanLimitRows,
  getIncludedFeatureLabels,
  getPlanPriceDisplay,
  mapTransitionToAction,
} from '@/lib/subscription/billing-plan-display';
import { BillingCycleToggle } from '@/components/subscription/BillingCycleToggle';
import { BillingPlanCard } from '@/components/subscription/BillingPlanCard';
import { BillingHistoryTable } from '@/components/subscription/BillingHistoryTable';
import { BillingCurrentPlanCard } from '@/components/subscription/BillingCurrentPlanCard';
import { BillingUsageCard } from '@/components/subscription/BillingUsageCard';
import {
  subscriptionKeys,
  useChangePlan,
  useClearPendingPlanChange,
  useConfirmCheckout,
  useSubscription,
  useSubscriptionPlans,
  useSubscriptionUsage,
} from '@/hooks/api/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { YEARLY_DISCOUNT_PERCENT } from '@/lib/subscription/billing-plan-display';
import type { BillingCycle, PlanId } from '@/types/subscription';
import { getSubscriptionChangePlanErrorMessage } from '@/lib/subscription/subscription-api-errors';

export default function BillingPage() {
  const t = useTranslations('billing');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSchoolAdmin =
    user?.roles?.some((r) => (r.roleName ?? '').toLowerCase() === 'school_admin') ?? false;

  const { data: subscription, isLoading: subLoading, error: subError } = useSubscription();
  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } =
    useSubscriptionUsage(true);
  const { data: planConfigs } = useSubscriptionPlans();
  const changePlan = useChangePlan();
  const clearPending = useClearPendingPlanChange();
  const confirmCheckout = useConfirmCheckout();
  const paymentHandledRef = useRef(false);

  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  useEffect(() => {
    if (!isSchoolAdmin && user) {
      router.replace('/dashboard');
    }
  }, [isSchoolAdmin, user, router]);

  useEffect(() => {
    if (subscription?.billingCycle) {
      setCycle(subscription.billingCycle);
    }
  }, [subscription?.billingCycle]);

  useEffect(() => {
    const payment = searchParams?.get('payment');
    if (!payment || paymentHandledRef.current) return;

    if (payment === 'cancelled') {
      paymentHandledRef.current = true;
      notifications.show({ message: t('paymentCancelled'), color: 'gray' });
      router.replace('/billing');
      return;
    }

    if (payment !== 'success') return;

    const sessionId = searchParams?.get('session_id');
    const isUpgrade = searchParams?.get('upgrade') === '1';

    if (!sessionId) {
      paymentHandledRef.current = true;
      notifications.show({ message: t('paymentConfirmFailed'), color: 'red' });
      router.replace('/billing');
      return;
    }

    paymentHandledRef.current = true;
    setConfirmingPayment(true);

    void (async () => {
      try {
        const result = await confirmCheckout.mutateAsync(sessionId);
        if (result.invoiceStatus === 'paid') {
          notifications.show({
            message: isUpgrade ? t('upgradePaymentSuccess') : t('paymentSuccess'),
            color: 'green',
          });
        } else {
          notifications.show({
            message: t('paymentConfirmPending'),
            color: 'yellow',
          });
        }
      } catch {
        notifications.show({ message: t('paymentConfirmFailed'), color: 'red' });
      } finally {
        setConfirmingPayment(false);
        router.replace('/billing');
      }
    })();
  }, [searchParams, t, confirmCheckout, router]);

  const priceLabels = useMemo(
    () => ({
      perStudentMonth: t('perStudentMonth'),
      perStudentYear: t('perStudentYear'),
      custom: t('customPrice'),
      formatWhenBilledYearly: (price: string) => t('whenBilledYearly', { price }),
      formatSavePerStudentYear: (amount: string) => t('savePerStudentYear', { amount }),
    }),
    [t],
  );

  const limitLabels = useMemo(
    () => ({
      branches: t('branches'),
      students: t('students'),
      staff: t('staff'),
      classes: t('classes'),
    }),
    [t],
  );

  const planCards = useMemo(
    () =>
      plans.map((plan) => ({
        ...plan,
        id: marketingPlanNameToId(plan.name) as PlanId,
      })),
    [],
  );

  const plansById = useMemo(() => {
    const map = new Map<PlanId, NonNullable<typeof planConfigs>[number]>();
    for (const p of planConfigs ?? []) {
      map.set(p.id, p);
    }
    return map;
  }, [planConfigs]);

  const isLoading = subLoading || usageLoading;

  const handlePlanChange = async (planId: PlanId) => {
    if (planId === 'enterprise') {
      window.open('/contact', '_blank');
      return;
    }
    try {
      const result = await changePlan.mutateAsync({ planId, billingCycle: cycle });
      switch (result.type) {
        case 'checkout_required':
          if (result.checkoutUrl) {
            window.location.href = result.checkoutUrl;
          } else {
            notifications.show({ message: t('paymentError'), color: 'red' });
          }
          break;
        case 'contact-sales':
          window.open('/contact', '_blank');
          break;
        case 'upgrade':
          notifications.show({ message: t('planUpgraded'), color: 'green' });
          void refetchUsage();
          break;
        case 'downgrade-scheduled':
          notifications.show({
            message: t('planDowngraded', {
              date: result.effectiveDate
                ? new Date(result.effectiveDate).toLocaleDateString()
                : '',
            }),
            color: 'yellow',
          });
          break;
        case 'pending-cleared':
          notifications.show({ message: t('pendingCleared'), color: 'blue' });
          break;
        case 'noop':
          notifications.show({ message: t('alreadyOnPlan'), color: 'gray' });
          break;
        default:
          break;
      }
    } catch (error) {
      const { title, message } = getSubscriptionChangePlanErrorMessage(error, t);
      notifications.show({
        title,
        message,
        color: 'red',
        autoClose: message ? 10000 : 6000,
      });
    }
  };

  if (!isSchoolAdmin) {
    return (
      <Alert color="red" title={t('accessDenied')}>
        {t('accessDenied')}
      </Alert>
    );
  }

  return (
    <>
      <div
        className="page-title-bar"
        style={{
          borderTopLeftRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <Title order={1}>{t('title')}</Title>
      </div>
      <Stack
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
        gap="lg"
      >
        {confirmingPayment ? (
          <>
            <Skeleton height={120} />
            <Skeleton height={320} />
          </>
        ) : isLoading || !subscription ? (
          <>
            <Skeleton height={120} />
            <Skeleton height={320} />
          </>
        ) : subError ? (
          <Alert color="red">{(subError as Error).message}</Alert>
        ) : (
          <>
            <BillingCurrentPlanCard subscription={subscription} />

            {subscription.pendingPlanId && (
              <Alert
                id="billing-pending-change-alert"
                icon={<IconInfoCircle size={16} />}
                title={t('pendingChange')}
                color="yellow"
              >
                <Group justify="space-between" wrap="wrap">
                  <Text size="sm">
                    {t('pendingChangeMessage', {
                      plan: planDisplayName(subscription.pendingPlanId),
                      date: new Date(subscription.currentPeriodEnd).toLocaleDateString(),
                    })}
                  </Text>
                  <Button
                    id="billing-keep-current-plan"
                    variant="subtle"
                    size="xs"
                    loading={clearPending.isPending}
                    disabled={clearPending.isPending}
                    onClick={() => clearPending.mutate()}
                  >
                    {t('keepCurrentPlan')}
                  </Button>
                </Group>
              </Alert>
            )}

            {usageData?.usage && usageData.limits && (
              <BillingUsageCard usage={usageData.usage} limits={usageData.limits} />
            )}

            <Card
              id="billing-plans-section"
              padding="xl"
              radius="md"
              shadow="sm"
              withBorder
            >
              <Group justify="space-between" align="center" wrap="wrap" mb="lg">
                <Title order={3} fw={700}>
                  {t('plansSection')}
                </Title>
                <BillingCycleToggle
                  value={cycle}
                  onChange={setCycle}
                  monthlyLabel={t('monthly')}
                  annualLabel={t('annualSave', { percent: String(YEARLY_DISCOUNT_PERCENT) })}
                />
              </Group>

              <Grid gutter="md">
              {planCards.map((plan) => {
                const planId = plan.id;
                const config = plansById.get(planId);
                const limits = config
                  ? buildPlanLimitRows(config.limits, t('unlimited'))
                  : [];
                const priceDisplay = getPlanPriceDisplay(plan, cycle, priceLabels);
                const transition = subscription
                  ? classifyTransition(
                      subscription.planId,
                      subscription.billingCycle,
                      planId,
                      cycle,
                    )
                  : 'noop';
                const action = mapTransitionToAction(transition);
                const isCurrentPlan = subscription.planId === planId;

                return (
                  <Grid.Col key={plan.name} span={{ base: 12, sm: 6, md: 3 }}>
                    <BillingPlanCard
                      planId={planId}
                      planName={plan.name}
                      price={priceDisplay}
                      limits={limits}
                      features={getIncludedFeatureLabels(plan)}
                      action={action}
                      isCurrentPlan={isCurrentPlan}
                      limitsTitle={t('limitsSection')}
                      limitLabels={limitLabels}
                      actionLabels={{
                        upgrade: t('upgrade'),
                        downgrade: t('downgrade'),
                        select: t('select'),
                        contactSales: t('contactSales'),
                      }}
                      loading={
                        changePlan.isPending && changePlan.variables?.planId === planId
                      }
                      onAction={() => {
                        if (planId === 'enterprise' || action === 'contact-sales') {
                          window.open('/contact', '_blank');
                          return;
                        }
                        if (action !== 'current') {
                          void handlePlanChange(planId);
                        }
                      }}
                    />
                  </Grid.Col>
                );
              })}
              </Grid>
            </Card>

            <BillingHistoryTable />
          </>
        )}
      </Stack>
    </>
  );
}
