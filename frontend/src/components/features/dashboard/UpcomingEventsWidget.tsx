'use client';

import { Stack, Text, Skeleton, Alert } from '@mantine/core';
import { useMyEvents } from '@/hooks/api/useEvents';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function UpcomingEventsWidget() {
  const { data: eventsResponse, isLoading, error } = useMyEvents();
  const events = eventsResponse?.data ?? [];
  const colors = useThemeColors();

  if (error) {
    return (
      <Alert color={colors.error} title="Error">
        {error instanceof Error ? error.message : 'Failed to load events'}
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
          No upcoming events
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
