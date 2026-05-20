'use client';

import {
  Box,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconCheck } from '@tabler/icons-react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type {
  PlanActionType,
  PlanLimitDisplay,
  PlanPriceDisplay,
} from '@/lib/subscription/billing-plan-display';

type BillingPlanCardProps = {
  planId: string;
  planName: string;
  price: PlanPriceDisplay;
  limits: PlanLimitDisplay[];
  features: string[];
  action: PlanActionType;
  isCurrentPlan: boolean;
  limitsTitle: string;
  limitLabels: Record<PlanLimitDisplay['labelKey'], string>;
  actionLabels: {
    upgrade: string;
    downgrade: string;
    select: string;
    contactSales: string;
  };
  loading?: boolean;
  disabled?: boolean;
  onAction: () => void;
};

export function BillingPlanCard({
  planId,
  planName,
  price,
  limits,
  features,
  action,
  isCurrentPlan,
  limitsTitle,
  limitLabels,
  actionLabels,
  loading = false,
  disabled = false,
  onAction,
}: BillingPlanCardProps) {
  const colors = useThemeColors();
  const accent = colors.primary;

  const showAction = action !== 'current';
  const buttonLabel =
    action === 'upgrade'
      ? actionLabels.upgrade
      : action === 'downgrade'
        ? actionLabels.downgrade
        : action === 'contact-sales'
          ? actionLabels.contactSales
          : actionLabels.select;

  return (
    <Card
      id={`billing-plan-card-${planId}`}
      padding="lg"
      radius="md"
      withBorder
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: isCurrentPlan
          ? accent
          : 'var(--mantine-color-gray-3)',
        borderWidth: isCurrentPlan ? 2 : 1,
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      <Stack gap="md" style={{ flex: 1 }}>
        <Stack gap={6}>
          <Text fw={700} size="xl" lh={1.2}>
            {planName}
          </Text>

          <Group gap={6} align="baseline" wrap="wrap">
            <Text fw={700} size="xl" lh={1.1}>
              {price.mainPrice}
            </Text>
            {price.periodSuffix ? (
              <Text size="md" fw={500} c="dimmed" lh={1.1}>
                {price.periodSuffix}
              </Text>
            ) : null}
          </Group>

          {price.subline && (
            <Text size="sm" c="dimmed" lh={1.3}>
              {price.subline}
            </Text>
          )}

          {price.saveBadge && (
            <Box
              component="span"
              style={{
                display: 'inline-block',
                marginTop: 2,
                padding: '4px 10px',
                borderRadius: 4,
                backgroundColor: `${accent}18`,
                color: accent,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.4,
              }}
            >
              {price.saveBadge}
            </Box>
          )}
        </Stack>

        <Divider color="gray.3" />

        <Box>
          <Text size="sm" fw={700} mb="xs">
            {limitsTitle.endsWith(':') ? limitsTitle : `${limitsTitle}:`}
          </Text>
          <Stack gap={4}>
            {limits.map((row) => (
              <Group key={row.labelKey} justify="space-between" gap="xs" wrap="nowrap">
                <Text size="sm" c="dimmed">
                  {limitLabels[row.labelKey]}:
                </Text>
                <Text size="sm" fw={600}>
                  {row.display}
                </Text>
              </Group>
            ))}
          </Stack>
        </Box>

        <Stack gap={8}>
          {features.map((feature) => (
            <Group key={feature} gap="xs" wrap="nowrap" align="flex-start">
              <Box
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <IconCheck size={11} color="white" stroke={3} />
              </Box>
              <Text size="sm" lh={1.45}>
                {feature}
              </Text>
            </Group>
          ))}
        </Stack>
      </Stack>

      {showAction && (
        <Button
          id={`billing-plan-action-${planId}`}
          fullWidth
          mt="lg"
          size="md"
          radius="md"
          loading={loading}
          disabled={disabled || loading}
          leftSection={
            action === 'upgrade' ? (
              <IconArrowUp size={16} />
            ) : action === 'downgrade' ? (
              <IconArrowDown size={16} />
            ) : undefined
          }
          styles={{
            root: {
              backgroundColor: accent,
              fontWeight: 700,
              '&:hover': {
                backgroundColor: colors.primaryShade,
              },
            },
          }}
          onClick={onAction}
        >
          {buttonLabel}
        </Button>
      )}
    </Card>
  );
}
