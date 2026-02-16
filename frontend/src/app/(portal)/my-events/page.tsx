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
  Divider,
} from '@mantine/core';
import { IconCalendar, IconCheck, IconX, IconClock, IconUsers, IconRotateClockwise } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMyEvents, useSubmitConsent } from '@/hooks/api/useEvents';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';
import type { Event } from '@/types/events';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

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

  const ConsentActions = ({ event }: { event: Event }) => {
    const submitConsent = useSubmitConsent(event.id);

    const handleConsent = async (studentId: string, status: 'approved' | 'rejected') => {
      try {
        await submitConsent.mutateAsync({
          studentId,
          status,
        });
      } catch (error) {
        // Error handling is done in the hook
      }
    };

    if (!event.requiresConsent || !isParent || !event.consentStatuses || event.consentStatuses.length === 0) {
      return null;
    }

    return (
      <Stack gap="sm" mt="xs">
        <Divider />
        <Text size="sm" fw={500} c="dimmed">
          Consent Status:
        </Text>
        {event.consentStatuses.map((consent) => (
          <Group key={consent.studentId} justify="space-between">
            <Text size="sm">
              {consent.studentName}:{' '}
              <Badge
                color={
                  consent.status === 'approved'
                    ? 'green'
                    : consent.status === 'rejected'
                      ? 'red'
                      : 'orange'
                }
                variant="light"
              >
                {consent.status.charAt(0).toUpperCase() + consent.status.slice(1)}
              </Badge>
            </Text>
            <Group gap="xs">
              {consent.status === 'pending' && (
                <>
                  <Button
                    size="xs"
                    color="green"
                    leftSection={<IconCheck size={14} />}
                    onClick={() => handleConsent(consent.studentId, 'approved')}
                    loading={submitConsent.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    leftSection={<IconX size={14} />}
                    onClick={() => handleConsent(consent.studentId, 'rejected')}
                    loading={submitConsent.isPending}
                  >
                    Reject
                  </Button>
                </>
              )}
              {consent.status === 'approved' && (
                <Button
                  size="xs"
                  color="red"
                  variant="light"
                  leftSection={<IconRotateClockwise size={14} />}
                  onClick={() => handleConsent(consent.studentId, 'rejected')}
                  loading={submitConsent.isPending}
                >
                  Change to Reject
                </Button>
              )}
              {consent.status === 'rejected' && (
                <Button
                  size="xs"
                  color="green"
                  variant="light"
                  leftSection={<IconRotateClockwise size={14} />}
                  onClick={() => handleConsent(consent.studentId, 'approved')}
                  loading={submitConsent.isPending}
                >
                  Change to Approve
                </Button>
              )}
            </Group>
          </Group>
        ))}
      </Stack>
    );
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>My Event</Title>
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
                            <Stack gap="xs">
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
                                  {isParent && event.studentNames && event.studentNames.length > 0 && (
                                    <Group gap="xs">
                                      <IconUsers size={16} />
                                      <Text size="sm" fw={500}>
                                        {event.studentNames.join(', ')}
                                      </Text>
                                    </Group>
                                  )}
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
                              <ConsentActions event={event} />
                            </Stack>
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
                            <Stack gap="xs">
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
                                  {isParent && event.studentNames && event.studentNames.length > 0 && (
                                    <Group gap="xs">
                                      <IconUsers size={16} />
                                      <Text size="sm" fw={500}>
                                        {event.studentNames.join(', ')}
                                      </Text>
                                    </Group>
                                  )}
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
                              <ConsentActions event={event} />
                            </Stack>
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

