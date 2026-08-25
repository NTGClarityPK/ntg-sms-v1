'use client';

import { Alert, Text } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import type { SupportCoverage } from '@/types/support';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

function formatBackAt(iso: string | null, t: ReturnType<typeof useTranslations<'support'>>): string {
  if (!iso) return t('coverageOfflineGeneric');
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' }) ===
    now.toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' });
  const time = new Intl.DateTimeFormat(undefined, {
    timeZone: 'Asia/Karachi',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  if (sameDay) return t('coverageBackAtToday', { time });
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    date.toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' }) ===
    tomorrow.toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' });
  if (isTomorrow) return t('coverageBackAtTomorrow', { time });
  const day = new Intl.DateTimeFormat(undefined, {
    timeZone: 'Asia/Karachi',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
  return t('coverageBackAtWhen', { when: `${day} ${time}` });
}

type Props = {
  coverage: SupportCoverage | undefined;
};

export function SupportCoverageBanner({ coverage }: Props) {
  const t = useTranslations('support');
  const { warning } = useThemeColors();

  if (!coverage) return null;

  if (!coverage.onDuty) {
    return (
      <Alert
        id="support-coverage-offline"
        color="yellow"
        variant="light"
        icon={<IconClock size={16} />}
        mb="sm"
        styles={{ root: { borderColor: warning } }}
      >
        <Text size="sm">
          {t('coverageOfflinePrefix')}{' '}
          {formatBackAt(coverage.nextAvailableAt, t)}
          {coverage.offlineMessage ? ` — ${coverage.offlineMessage}` : ''}
        </Text>
      </Alert>
    );
  }

  if (coverage.coverageEndsAt) {
    const endsMs = new Date(coverage.coverageEndsAt).getTime() - Date.now();
    const endsMin = Math.ceil(endsMs / 60_000);
    if (endsMin > 0 && endsMin <= 30) {
      return (
        <Alert id="support-coverage-ending" color="yellow" variant="light" mb="sm">
          <Text size="sm">{t('coverageEndsIn', { minutes: endsMin })}</Text>
        </Alert>
      );
    }
  }

  return null;
}
