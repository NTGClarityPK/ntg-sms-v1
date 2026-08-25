'use client';

import { Badge, Group } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { SupportMinutesSummary } from '@/types/support';

type Props = {
  thisMonth: SupportMinutesSummary | undefined;
  lastMonth: SupportMinutesSummary | undefined;
};

export function SupportMinutesHeader({ thisMonth, lastMonth }: Props) {
  const t = useTranslations('support');

  const fmt = (row: SupportMinutesSummary | undefined) =>
    t('minutesCompact', {
      platform: row?.platformMinutes ?? 0,
      operational: row?.operationalMinutes ?? 0,
    });

  return (
    <Group gap="xs" wrap="wrap" justify="flex-end" id="support-minutes-header">
      <Badge
        id="support-minutes-this-month"
        size="lg"
        radius="xl"
        variant="light"
        color="primary"
        styles={{
          root: { textTransform: 'none', fontWeight: 500 },
          label: { overflow: 'visible', whiteSpace: 'nowrap' },
        }}
      >
        {t('thisMonth')}: {fmt(thisMonth)}
      </Badge>
      <Badge
        id="support-minutes-last-month"
        size="lg"
        radius="xl"
        variant="light"
        color="gray"
        styles={{
          root: { textTransform: 'none', fontWeight: 500 },
          label: { overflow: 'visible', whiteSpace: 'nowrap' },
        }}
      >
        {t('lastMonth')}: {fmt(lastMonth)}
      </Badge>
    </Group>
  );
}
