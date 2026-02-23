'use client';

import { useState, useEffect } from 'react';
import { Box, Group, Button, NumberInput, Text, Stack } from '@mantine/core';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import { formatCurrency } from '@/lib/utils/currency-formatter';
import { useCurrency } from '@/lib/hooks/use-currency';

interface TipInputProps {
  subtotal: number;
  tipAmount: number;
  onTipChange: (tipAmount: number) => void;
  disabled?: boolean;
}

export function TipInput({ subtotal, tipAmount, onTipChange, disabled = false }: TipInputProps) {
  const { language } = useLanguageStore();
  const currency = useCurrency();
  const [tipPercentage, setTipPercentage] = useState<number>(0);
  const [customTip, setCustomTip] = useState<number>(tipAmount);

  useEffect(() => {
    if (tipAmount > 0 && subtotal > 0) {
      const percentage = (tipAmount / subtotal) * 100;
      setTipPercentage(percentage);
      setCustomTip(tipAmount);
    } else {
      setTipPercentage(0);
      setCustomTip(0);
    }
  }, [tipAmount, subtotal]);

  const handlePercentageClick = (percentage: number) => {
    const newTip = (subtotal * percentage) / 100;
    setTipPercentage(percentage);
    setCustomTip(newTip);
    onTipChange(newTip);
  };

  const handleCustomTipChange = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    setCustomTip(numValue);
    onTipChange(numValue);
    if (subtotal > 0) {
      setTipPercentage((numValue / subtotal) * 100);
    }
  };

  const totalWithTip = subtotal + tipAmount;

  return (
    <Stack gap="sm">
      <Text fw={500} size="sm" mb={4}>
        {t('orders.tip', language) || 'Tip'}
      </Text>
      
      <Group gap="xs" wrap="wrap">
        <Button
          size="sm"
          variant={tipPercentage === 10 ? 'filled' : 'light'}
          onClick={() => handlePercentageClick(10)}
          disabled={disabled}
          style={{ flex: '1 1 auto', minWidth: '60px' }}
        >
          10%
        </Button>
        <Button
          size="sm"
          variant={tipPercentage === 15 ? 'filled' : 'light'}
          onClick={() => handlePercentageClick(15)}
          disabled={disabled}
          style={{ flex: '1 1 auto', minWidth: '60px' }}
        >
          15%
        </Button>
        <Button
          size="sm"
          variant={tipPercentage === 20 ? 'filled' : 'light'}
          onClick={() => handlePercentageClick(20)}
          disabled={disabled}
          style={{ flex: '1 1 auto', minWidth: '60px' }}
        >
          20%
        </Button>
        <Button
          size="sm"
          variant={tipPercentage === 0 && tipAmount === 0 ? 'filled' : 'light'}
          onClick={() => handlePercentageClick(0)}
          disabled={disabled}
          style={{ flex: '1 1 auto', minWidth: '60px' }}
        >
          {t('orders.noTip', language) || 'No Tip'}
        </Button>
      </Group>

      <Box>
        <Text size="sm" fw={500} mb={6}>
          {t('orders.customTip', language) || 'Custom Tip'}
        </Text>
        <NumberInput
          value={customTip}
          onChange={handleCustomTipChange}
          min={0}
          step={0.01}
          disabled={disabled}
          placeholder="0.00"
          leftSection={
            <Text size="sm" c="dimmed" style={{ paddingRight: 12, paddingLeft: 4 }}>
              {currency}
            </Text>
          }
          rightSection={
            tipPercentage > 0 ? (
              <Text size="sm" c="dimmed" style={{ paddingRight: 16, paddingLeft: 8 }}>
                {tipPercentage.toFixed(1)}%
              </Text>
            ) : null
          }
          styles={{
            input: {
              paddingLeft: currency ? 50 : 12,
              paddingRight: tipPercentage > 0 ? 60 : 12,
            },
            section: {
              width: 'auto',
            },
          }}
        />
      </Box>

      {tipAmount > 0 && (
        <Group justify="space-between" mt="xs">
          <Text size="sm" fw={500}>
            {t('orders.tipAmount', language) || 'Tip Amount'}:
          </Text>
          <Text size="sm" fw={600} c="green">
            {formatCurrency(tipAmount, currency)}
          </Text>
        </Group>
      )}

      <Group justify="space-between" mt="xs" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
        <Text size="sm" fw={600}>
          {t('orders.totalWithTip', language) || 'Total with Tip'}:
        </Text>
        <Text size="lg" fw={700} c="blue">
          {formatCurrency(totalWithTip, currency)}
        </Text>
      </Group>
    </Stack>
  );
}

