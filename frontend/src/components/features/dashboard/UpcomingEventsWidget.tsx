'use client';

import { Stack, Text, Skeleton, Alert } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { useMyEvents } from '@/hooks/api/useEvents';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function UpcomingEventsWidget() {
  const t = useTranslations('event');
  const { data: eventsResponse, isLoading, error } = useMyEvents();
  const events = eventsResponse?.data ?? [];
  const colors = useThemeColors();

  if (error) {
    return (
      <Alert color={colors.error} title={t('widgetErrorTitle')}>
        {error instanceof Error ? error.message : t('widgetFailedToLoad')}
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Stack gap="sm">
        <Skeleton height={16} width="80%" />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </Stack>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const upcoming = events
    .filter((e) => e.startDate >= today)
    .slice(0, 5);

  return (
    <Stack gap="sm">
      {upcoming.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('widgetNoUpcoming')}
        </Text>
      ) : (
        upcoming.map((event) => (
          <Text key={event.id} size="sm">
            {event.title} – {event.startDate}
          </Text>
        ))
      )}
    </Stack>
  );
}
