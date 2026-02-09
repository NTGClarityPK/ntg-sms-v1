'use client';

/**
 * My Events Page
 * Role-aware dashboard showing events for current user
 */

import {
  Title,
  Paper,
  Group,
  Stack,
  Text,
  Badge,
  Skeleton,
  Card,
  ScrollArea,
  Button,
} from '@mantine/core';
import { IconCalendar, IconCheck, IconX, IconClock } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMyEvents } from '@/hooks/api/useEvents';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';
import type { Event } from '@/types/events';

export default function MyEventsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading } = useMyEvents();

  const events = data?.data || [];

  const isParent = user?.roles?.some((r) => r.roleName === 'parent') ?? false;

  const getStatusBadge = (event: Event) => {
    const today = dayjs();
    const start = dayjs(event.startDate);
    const end = dayjs(event.endDate);

    if (end.isBefore(today)) {
      return <Badge color="gray">Past</Badge>;
    }
    if (start.isBefore(today) && end.isAfter(today)) {
      return <Badge color="blue">Ongoing</Badge>;
    }
    return <Badge color="green">Upcoming</Badge>;
  };

  const upcomingEvents = events.filter((e) => dayjs(e.endDate).isAfter(dayjs()));
  const pastEvents = events.filter((e) => dayjs(e.endDate).isBefore(dayjs()));

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>My Events</Title>
        </Group>
      </div>

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Stack gap="md">
          {isLoading || !data ? (
            <Stack gap="md">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} height={120} />
              ))}
            </Stack>
          ) : events.length > 0 ? (
            <>
              {/* Upcoming Events */}
              {upcomingEvents.length > 0 && (
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Group>
                      <IconCalendar size={20} />
                      <Title order={3}>Upcoming Events</Title>
                    </Group>
                    <ScrollArea>
                      <Stack gap="sm">
                        {upcomingEvents.map((event) => (
                          <Card key={event.id} withBorder p="md">
                            <Group justify="space-between">
                              <Stack gap="xs">
                                <Group>
                                  <Text fw={500}>{event.title}</Text>
                                  {getStatusBadge(event)}
                                  {event.requiresConsent && (
                                    <Badge color="orange">Consent Required</Badge>
                                  )}
                                </Group>
                                <Group gap="xs">
                                  <IconCalendar size={16} />
                                  <Text size="sm">
                                    {dayjs(event.startDate).format('MMM D, YYYY')}
                                    {event.startDate !== event.endDate &&
                                      ` – ${dayjs(event.endDate).format('MMM D, YYYY')}`}
                                  </Text>
                                </Group>
                                {event.description && (
                                  <Text size="sm" c="dimmed" lineClamp={2}>
                                    {event.description}
                                  </Text>
                                )}
                              </Stack>
                              <Button
                                variant="light"
                                size="sm"
                                onClick={() => router.push(`/events/${event.id}`)}
                              >
                                View Details
                              </Button>
                            </Group>
                          </Card>
                        ))}
                      </Stack>
                    </ScrollArea>
                  </Stack>
                </Paper>
              )}

              {/* Past Events */}
              {pastEvents.length > 0 && (
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Group>
                      <IconClock size={20} />
                      <Title order={3}>Past Events</Title>
                    </Group>
                    <ScrollArea>
                      <Stack gap="sm">
                        {pastEvents.map((event) => (
                          <Card key={event.id} withBorder p="md">
                            <Group justify="space-between">
                              <Stack gap="xs">
                                <Group>
                                  <Text fw={500}>{event.title}</Text>
                                  {getStatusBadge(event)}
                                </Group>
                                <Group gap="xs">
                                  <IconCalendar size={16} />
                                  <Text size="sm">
                                    {dayjs(event.startDate).format('MMM D, YYYY')}
                                    {event.startDate !== event.endDate &&
                                      ` – ${dayjs(event.endDate).format('MMM D, YYYY')}`}
                                  </Text>
                                </Group>
                                {event.description && (
                                  <Text size="sm" c="dimmed" lineClamp={2}>
                                    {event.description}
                                  </Text>
                                )}
                              </Stack>
                              <Button
                                variant="light"
                                size="sm"
                                onClick={() => router.push(`/events/${event.id}`)}
                              >
                                View Details
                              </Button>
                            </Group>
                          </Card>
                        ))}
                      </Stack>
                    </ScrollArea>
                  </Stack>
                </Paper>
              )}
            </>
          ) : (
            <Paper p="xl" withBorder>
              <Text c="dimmed" ta="center">
                No events found. Events you're participating in will appear here.
              </Text>
            </Paper>
          )}
        </Stack>
      </div>
    </>
  );
}

