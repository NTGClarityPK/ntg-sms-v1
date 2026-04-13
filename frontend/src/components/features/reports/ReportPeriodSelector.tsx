'use client';

import { useState, useEffect } from 'react';
import { Group, Select, Text, Stack } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { useTranslations } from 'next-intl';
import { ReportPeriodType } from '@/types/reports';

export interface ReportPeriodSelectorProps {
  value: ReportPeriodType | null;
  startDate: string | null;
  endDate: string | null;
  onChange: (periodType: ReportPeriodType | null, startDate: string | null, endDate: string | null) => void;
}

export function ReportPeriodSelector({
  value,
  startDate,
  endDate,
  onChange,
}: ReportPeriodSelectorProps) {
  const [customStartDate, setCustomStartDate] = useState<Date | null>(
    startDate ? new Date(startDate) : null,
  );
  const [customEndDate, setCustomEndDate] = useState<Date | null>(
    endDate ? new Date(endDate) : null,
  );
  const t = useTranslations('reports');

  const handlePeriodTypeChange = (newType: string | null) => {
    if (!newType || newType === 'year' || newType === 'all') {
      onChange(newType as ReportPeriodType | null, null, null);
      return;
    }

    if (newType === 'custom') {
      // Set period type to CUSTOM but with null dates initially
      // This shows the date pickers without triggering a report fetch
      onChange(ReportPeriodType.CUSTOM, null, null);
      return;
    }

    // For week/month, calculate dates
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (newType === 'week') {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() + mondayOffset);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodStart.getDate() + 6);
      periodEnd.setHours(23, 59, 59, 999);
    } else {
      // month
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      periodEnd.setHours(23, 59, 59, 999);
    }

    onChange(
      newType as ReportPeriodType,
      periodStart.toISOString().split('T')[0],
      periodEnd.toISOString().split('T')[0],
    );
  };

  // Update local state when props change
  useEffect(() => {
    if (startDate) {
      setCustomStartDate(new Date(startDate));
    }
    if (endDate) {
      setCustomEndDate(new Date(endDate));
    }
  }, [startDate, endDate]);

  // Handle custom date changes - only call onChange when both dates are selected
  const handleStartDateChange = (date: Date | null) => {
    setCustomStartDate(date);
    if (date && customEndDate) {
      onChange(
        ReportPeriodType.CUSTOM,
        date.toISOString().split('T')[0],
        customEndDate.toISOString().split('T')[0],
      );
    }
  };

  const handleEndDateChange = (date: Date | null) => {
    setCustomEndDate(date);
    if (customStartDate && date) {
      onChange(
        ReportPeriodType.CUSTOM,
        customStartDate.toISOString().split('T')[0],
        date.toISOString().split('T')[0],
      );
    }
  };

  return (
    <Stack gap="sm">
      <Select
        id="report-period-select"
        label={t('periodSelectLabel')}
        placeholder={t('periodSelectPlaceholder')}
        value={value || 'year'}
        onChange={handlePeriodTypeChange}
        data={[
          { value: 'all', label: t('chipAll') },
          { value: 'week', label: t('chipThisWeek') },
          { value: 'month', label: t('chipThisMonth') },
          { value: 'year', label: t('chipYearToDate') },
          { value: 'custom', label: t('chipCustomRange') },
        ]}
        style={{ maxWidth: 300 }}
      />

      {value === ReportPeriodType.CUSTOM && (
        <Group gap="md">
          <DatePickerInput
            id="report-period-start-date"
            label={t('periodStartLabel')}
            placeholder={t('periodStartPlaceholder')}
            value={customStartDate}
            onChange={handleStartDateChange}
            clearable
            style={{ maxWidth: 200 }}
          />
          <DatePickerInput
            id="report-period-end-date"
            label={t('periodEndLabel')}
            placeholder={t('periodEndPlaceholder')}
            value={customEndDate}
            onChange={handleEndDateChange}
            clearable
            minDate={customStartDate || undefined}
            style={{ maxWidth: 200 }}
          />
        </Group>
      )}

      {value && value !== ReportPeriodType.CUSTOM && startDate && endDate && (
        <Text size="sm" c="dimmed">
          {t('periodSummaryPrefix')}{' '}
          {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
        </Text>
      )}
    </Stack>
  );
}
