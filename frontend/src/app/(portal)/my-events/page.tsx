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
  Button,
  Divider,
  Tabs,
  Alert,
  Accordion,
} from '@mantine/core';
import {
  IconCalendar,
  IconCheck,
  IconX,
  IconClock,
  IconUsers,
  IconRotateClockwise,
  IconAlertCircle,
  IconCalendarEvent,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMyEvents, useSubmitConsent } from '@/hooks/api/useEvents';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';
import type { Event } from '@/types/events';
import { useMemo, useState } from 'react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export default function MyEventsPage() {
  const t = useTranslations('event');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading, error, isRefetching } = useMyEvents();
  const colors = useThemeColors();
  const [activeTab, setActiveTab] = useState<string | null>('pending');

  const events = data?.data || [];

  const isParent = user?.roles?.some((r) => r.roleName === 'parent') ?? false;
  const isStudent = user?.roles?.some((r) => r.roleName === 'student') ?? false;

  const getStatusBadge = (event: Event) => {
    const today = dayjs();
    const start = dayjs(event.startDate);
    const end = dayjs(event.endDate);

    if (end.isBefore(today)) {
      return (
        <Badge color="gray" variant="light">
          {t('statusPast')}
        </Badge>
      );
    }
    if (start.isBefore(today) && end.isAfter(today)) {
      return (
        <Badge color="blue" variant="light">
          {t('statusOngoing')}
        </Badge>
      );
    }
    return (
      <Badge color="green" variant="light">
        {t('statusUpcoming')}
      </Badge>
    );
  };

  const { upcomingEvents, pastEvents, pendingConsentEvents } = useMemo(() => {
    const now = dayjs();

    const upcoming = events
      .filter((e) => dayjs(e.endDate).isSame(now, 'day') || dayjs(e.endDate).isAfter(now, 'day'))
      .sort((a, b) => dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf());

    const past = events
      .filter((e) => dayjs(e.endDate).isBefore(now, 'day'))
      .sort((a, b) => dayjs(b.startDate).valueOf() - dayjs(a.startDate).valueOf());

    const pending = events
      .filter((e) => {
        if (!e.requiresConsent) return false;
        if (isParent) {
          return (e.consentStatuses ?? []).some((cs) => cs.status === 'pending');
        }
        if (isStudent) {
          return (e.studentConsentStatus ?? 'pending') === 'pending';
        }
        return false;
      })
      .sort((a, b) => dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf());

    return { upcomingEvents: upcoming, pastEvents: past, pendingConsentEvents: pending };
  }, [events, isParent, isStudent]);

  const effectiveActiveTab = useMemo(() => {
    if (pendingConsentEvents.length > 0) return activeTab ?? 'pending';
    if ((activeTab ?? 'pending') === 'pending') return 'upcoming';
    return activeTab ?? 'upcoming';
  }, [activeTab, pendingConsentEvents.length]);

  const ConsentActions = ({ event }: { event: Event }) => {
    const submitConsent = useSubmitConsent(event.id);
    const [pendingAction, setPendingAction] = useState<{ studentId: string; status: 'approved' | 'rejected' } | null>(
      null,
    );

    const handleConsent = async (studentId: string, status: 'approved' | 'rejected') => {
      try {
        setPendingAction({ studentId, status });
        await submitConsent.mutateAsync({
          studentId,
          status,
        });
      } catch (error) {
        // Error handling is done in the hook
      } finally {
        setPendingAction(null);
      }
    };

    if (!event.requiresConsent || !isParent || !event.consentStatuses || event.consentStatuses.length === 0) {
      return null;
    }

    return (
      <Accordion variant="separated" mt="xs">
        <Accordion.Item value="consent">
          <Accordion.Control>
            <Group gap="xs" wrap="wrap">
              <Text size="sm" fw={500}>
                {t('consentStatus')}
              </Text>
              <Badge
                variant="light"
                color={(event.consentStatuses ?? []).some((cs) => cs.status === 'pending') ? 'orange' : 'green'}
              >
                {(event.consentStatuses ?? []).filter((cs) => cs.status === 'pending').length} {t('pending')}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              {event.consentStatuses.map((consent) => (
                <Group key={consent.studentId} justify="space-between" wrap="wrap" gap="xs">
                  <Group gap="xs" wrap="wrap">
                    <Text size="sm" fw={500}>
                      {consent.studentName}
                    </Text>
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
                      {consent.status === 'approved'
                        ? t('approved')
                        : consent.status === 'rejected'
                          ? t('rejected')
                          : t('pending')}
                    </Badge>
                  </Group>
                  <Group gap="xs">
                    {consent.status === 'pending' && (
                      <>
                        <Button
                          id={`my-events-${event.id}-consent-${consent.studentId}-approve`}
                          size="xs"
                          color="green"
                          leftSection={<IconCheck size={14} />}
                          onClick={() => handleConsent(consent.studentId, 'approved')}
                          loading={
                            submitConsent.isPending &&
                            pendingAction?.studentId === consent.studentId &&
                            pendingAction.status === 'approved'
                          }
                        >
                          {t('approve')}
                        </Button>
                        <Button
                          id={`my-events-${event.id}-consent-${consent.studentId}-reject`}
                          size="xs"
                          color="red"
                          variant="light"
                          leftSection={<IconX size={14} />}
                          onClick={() => handleConsent(consent.studentId, 'rejected')}
                          loading={
                            submitConsent.isPending &&
                            pendingAction?.studentId === consent.studentId &&
                            pendingAction.status === 'rejected'
                          }
                        >
                          {t('reject')}
                        </Button>
                      </>
                    )}
                    {consent.status === 'approved' && (
                      <Button
                        id={`my-events-${event.id}-consent-${consent.studentId}-change-to-reject`}
                        size="xs"
                        color="red"
                        variant="light"
                        leftSection={<IconRotateClockwise size={14} />}
                        onClick={() => handleConsent(consent.studentId, 'rejected')}
                        loading={
                          submitConsent.isPending &&
                          pendingAction?.studentId === consent.studentId &&
                          pendingAction.status === 'rejected'
                        }
                      >
                        {t('changeToReject')}
                      </Button>
                    )}
                    {consent.status === 'rejected' && (
                      <Button
                        id={`my-events-${event.id}-consent-${consent.studentId}-change-to-approve`}
                        size="xs"
                        color="green"
                        variant="light"
                        leftSection={<IconRotateClockwise size={14} />}
                        onClick={() => handleConsent(consent.studentId, 'approved')}
                        loading={
                          submitConsent.isPending &&
                          pendingAction?.studentId === consent.studentId &&
                          pendingAction.status === 'approved'
                        }
                      >
                        {t('changeToApprove')}
                      </Button>
                    )}
                  </Group>
                </Group>
              ))}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );
  };

  const StudentConsentStatus = ({ event }: { event: Event }) => {
    if (!isStudent || !event.requiresConsent) return null;
    const status = event.studentConsentStatus ?? 'pending';
    return (
      <Group gap="xs" mt="xs">
        <Text size="sm" fw={500} c="dimmed">
          {t('consentStatus')}
        </Text>
        <Badge
          variant="light"
          color={status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'orange'}
        >
          {status === 'approved' ? t('approved') : status === 'rejected' ? t('rejected') : t('pending')}
        </Badge>
      </Group>
    );
  };

  const EventCard = ({ event }: { event: Event }) => {
    const dateLabel = `${dayjs(event.startDate).format('MMM D, YYYY')}${
      event.startDate !== event.endDate ? ` – ${dayjs(event.endDate).format('MMM D, YYYY')}` : ''
    }`;

    return (
      <Card withBorder p="md" radius="md">
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
            <Stack gap={6}>
              <Group gap="xs" wrap="wrap">
                <Text fw={600}>{event.title}</Text>
                {getStatusBadge(event)}
                {event.requiresConsent && (
                  <Badge color="orange" variant="light">
                    {t('consentRequired')}
                  </Badge>
                )}
              </Group>
              <Group gap="xs" wrap="wrap">
                <IconCalendar size={16} />
                <Text size="sm" c="dimmed">
                  {dateLabel}
                </Text>
              </Group>
              {isParent && event.studentNames && event.studentNames.length > 0 && (
                <Group gap="xs" wrap="wrap">
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
              id={`my-events-view-details-${event.id}`}
              variant="light"
              size="sm"
              onClick={() => router.push(`/events/${event.id}`)}
            >
              {t('viewDetails')}
            </Button>
          </Group>

          {(isParent || isStudent) && event.requiresConsent && <Divider />}
          <ConsentActions event={event} />
          <StudentConsentStatus event={event} />
        </Stack>
      </Card>
    );
  };

  const renderEventsList = (list: Event[], emptyKey: string) => {
    if (list.length === 0) {
      return (
        <Paper p="xl" withBorder>
          <Text c="dimmed" ta="center">
            {t(emptyKey as never)}
          </Text>
        </Paper>
      );
    }
    return (
      <Stack gap="sm">
        {list.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </Stack>
    );
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('myEventTitle')}</Title>
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
          {error ? (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color={colors.error}
              title={t('widgetErrorTitle')}
            >
              {error instanceof Error ? error.message : t('widgetFailedToLoad')}
            </Alert>
          ) : isLoading || !data ? (
            <Stack gap="md">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} height={120} />
              ))}
            </Stack>
          ) : events.length > 0 ? (
            <Tabs value={effectiveActiveTab} onChange={setActiveTab}>
              <Tabs.List>
                {pendingConsentEvents.length > 0 && (
                  <Tabs.Tab
                    value="pending"
                    leftSection={<IconClock size={16} />}
                    id="my-events-tab-pending"
                  >
                    {t('pending')} ({pendingConsentEvents.length})
                  </Tabs.Tab>
                )}
                <Tabs.Tab value="upcoming" leftSection={<IconCalendarEvent size={16} />} id="my-events-tab-upcoming">
                  {t('upcomingEvents')} ({upcomingEvents.length})
                </Tabs.Tab>
                <Tabs.Tab value="past" leftSection={<IconClock size={16} />} id="my-events-tab-past">
                  {t('pastEvents')} ({pastEvents.length})
                </Tabs.Tab>
              </Tabs.List>

              {pendingConsentEvents.length > 0 && (
                <Tabs.Panel value="pending" pt="md">
                  <Paper p="md" withBorder>
                    <Stack gap="md">
                      <Group gap="xs">
                        <IconClock size={20} />
                        <Title order={3}>{t('pending')}</Title>
                        {isRefetching && (
                          <Badge variant="light" color={colors.info}>
                            {tCommon('loading')}
                          </Badge>
                        )}
                      </Group>
                      {renderEventsList(pendingConsentEvents, 'noEventsMyEvent')}
                    </Stack>
                  </Paper>
                </Tabs.Panel>
              )}

              <Tabs.Panel value="upcoming" pt="md">
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Group gap="xs">
                      <IconCalendarEvent size={20} />
                      <Title order={3}>{t('upcomingEvents')}</Title>
                    </Group>
                    {renderEventsList(upcomingEvents, 'noEventsMyEvent')}
                  </Stack>
                </Paper>
              </Tabs.Panel>

              <Tabs.Panel value="past" pt="md">
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Group gap="xs">
                      <IconClock size={20} />
                      <Title order={3}>{t('pastEvents')}</Title>
                    </Group>
                    {renderEventsList(pastEvents, 'noEventsMyEvent')}
                  </Stack>
                </Paper>
              </Tabs.Panel>
            </Tabs>
          ) : (
            <Paper p="xl" withBorder>
              <Text c="dimmed" ta="center">
                {t('noEventsMyEvent')}
              </Text>
            </Paper>
          )}
        </Stack>
      </div>
    </>
  );
}

