'use client';

import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import type { BillingCycle } from '@/types/subscription';
type BillingCycleToggleProps = {
  value: BillingCycle;
  onChange: (value: BillingCycle) => void;
  monthlyLabel: string;
  annualLabel: string;
};

export function BillingCycleToggle({
  value,
  onChange,
  monthlyLabel,
  annualLabel,
}: BillingCycleToggleProps) {
  return (
    <Box
      id="billing-cycle-toggle"
      p={4}
      style={{
        borderRadius: 999,
        backgroundColor: 'var(--mantine-color-gray-1)',
        border: '1px solid var(--mantine-color-gray-3)',
      }}
    >
      <Group gap={4} wrap="nowrap">
        <CycleOption
          id="billing-cycle-monthly"
          active={value === 'monthly'}
          onClick={() => onChange('monthly')}
          label={monthlyLabel}
        />
        <CycleOption
          id="billing-cycle-yearly"
          active={value === 'yearly'}
          onClick={() => onChange('yearly')}
          label={annualLabel}
        />
      </Group>
    </Box>
  );
}

function CycleOption({
  id,
  active,
  onClick,
  label,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <UnstyledButton
      id={id}
      onClick={onClick}
      px="md"
      py={6}
      style={{
        borderRadius: 999,
        backgroundColor: active ? 'var(--mantine-color-white)' : 'transparent',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
        transition: 'background-color 150ms ease, box-shadow 150ms ease',
      }}
    >
      <Text size="sm" fw={active ? 600 : 500} c={active ? 'dark' : 'dimmed'}>
        {label}
      </Text>
    </UnstyledButton>
  );
}
