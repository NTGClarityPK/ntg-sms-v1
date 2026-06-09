'use client';

/**
 * Events List Page
 * Displays all events with filters and allows creation/editing
 */

import { useState } from 'react';
import {
  Title,
  Paper,
  Group,
  Button,
  Stack,
  TextInput,
  Select,
  Skeleton,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Menu,
  Pagination,
  Table,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconPlus, IconRefresh, IconSearch, IconDotsVertical, IconEdit, IconTrash, IconEye } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEvents, useDeleteEvent, useEventConflicts } from '@/hooks/api/useEvents';
import { modals } from '@mantine/modals';
import dayjs from 'dayjs';
import type { Event } from '@/types/events';
import { IconAlertTriangle } from '@tabler/icons-react';

export default function EventsPage() {
  const t = useTranslations('event');
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [requiresConsent, setRequiresConsent] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const { data, isLoading, isRefetching } = useEvents({
    page,
    limit: 20,
    status: status as 'upcoming' | 'past' | 'all' | undefined,
    requiresConsent:
      requiresConsent === 'true' ? true : requiresConsent === 'false' ? false : undefined,
    startDate: startDate ? dayjs(startDate).format('YYYY-MM-DD') : undefined,
    endDate: endDate ? dayjs(endDate).format('YYYY-MM-DD') : undefined,
  });

  const deleteEvent = useDeleteEvent();

  const handleDelete = (id: string, title: string) => {
    modals.openConfirmModal({
      title: t('deleteTitle'),
      children: (
        <Text size="sm">
          {t.rich('deleteConfirm', { title, strong: (chunk) => <strong>{chunk}</strong> })}
        </Text>
      ),
      labels: { confirm: t('delete'), cancel: t('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteEvent.mutate(id),
    });
  };

  const getStatusBadge = (event: Event) => {
    const today = dayjs();
    const start = dayjs(event.startDate);
    const end = dayjs(event.endDate);

    if (end.isBefore(today)) {
      return <Badge color="gray">{t('statusPast')}</Badge>;
    }
    if (start.isBefore(today) && end.isAfter(today)) {
      return <Badge color="blue">{t('statusOngoing')}</Badge>;
    }
    return <Badge color="green">{t('statusUpcoming')}</Badge>;
  };

  // Component to show conflict badge for an event
  function EventConflictBadge({ eventId }: { eventId: string }) {
    const { data: conflictsData } = useEventConflicts(eventId);
    const conflicts = conflictsData?.data;

    if (
      conflicts &&
      (conflicts.assessmentConflicts.length > 0 || conflicts.eventConflicts.length > 0)
    ) {
      const totalConflicts =
        conflicts.assessmentConflicts.length + conflicts.eventConflicts.length;
      return (
        <Tooltip
          label={t('conflictsDetected', { count: totalConflicts })}
          withArrow
        >
          <Badge color="yellow" leftSection={<IconAlertTriangle size={12} />}>
            {t('conflictBadge')}
          </Badge>
        </Tooltip>
      );
    }
    return null;
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('title')}</Title>
          <Group gap="sm">
            <Tooltip label={t('refresh')}>
              <ActionIcon
                variant="light"
                size="lg"
                loading={isRefetching}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['events'] })}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Button
              id="events-btn-create"
              leftSection={<IconPlus size={16} />}
              onClick={() => router.push('/events/create')}
            >
              {t('createEvent')}
            </Button>
          </Group>
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
          {/* Filters */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group grow={!isMobile}>
                <TextInput
                  id="events-search"
                  placeholder={t('searchPlaceholder')}
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                />
                <Select
                  id="events-filter-status"
                  placeholder={t('filterByStatus')}
                  data={[
                    { value: 'all', label: t('filterStatusAll') },
                    { value: 'upcoming', label: t('filterStatusUpcoming') },
                    { value: 'past', label: t('filterStatusPast') },
                  ]}
                  value={status}
                  onChange={setStatus}
                  clearable
                />
                <Select
                  id="events-filter-consent"
                  placeholder={t('requiresConsentFilter')}
                  data={[
                    { value: 'true', label: t('yes') },
                    { value: 'false', label: t('no') },
                  ]}
                  value={requiresConsent}
                  onChange={setRequiresConsent}
                  clearable
                />
              </Group>
              <Group grow={!isMobile}>
                <DatePickerInput
                  id="events-filter-start-date"
                  placeholder={t('startDate')}
                  value={startDate}
                  onChange={setStartDate}
                  clearable
                />
                <DatePickerInput
                  id="events-filter-end-date"
                  placeholder={t('endDate')}
                  value={endDate}
                  onChange={setEndDate}
                  clearable
                />
              </Group>
            </Stack>
          </Paper>

          {/* Events Table */}
          <Paper p="md" withBorder style={{ overflow: 'hidden' }}>
            {isLoading || isRefetching || !data ? (
              <Stack gap="md">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} height={60} />
                ))}
              </Stack>
            ) : data.data.length > 0 ? (
              <Stack gap="md">
                <Table.ScrollContainer minWidth={720}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t('tableTitle')}</Table.Th>
                        <Table.Th>{t('tableDates')}</Table.Th>
                        <Table.Th>{t('tableStatus')}</Table.Th>
                        <Table.Th>{t('tableConsentRequired')}</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>{t('tableActions')}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data.data.map((event: Event) => (
                        <Table.Tr key={event.id}>
                          <Table.Td>
                            <Text fw={500}>{event.title}</Text>
                            {event.description && (
                              <Text size="sm" c="dimmed" lineClamp={1}>
                                {event.description}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {dayjs(event.startDate).format('MMM D, YYYY')}
                              {event.startDate !== event.endDate &&
                                ` – ${dayjs(event.endDate).format('MMM D, YYYY')}`}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              {getStatusBadge(event)}
                              <EventConflictBadge eventId={event.id} />
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            {event.requiresConsent ? (
                              <Badge color="orange">{t('consentRequired')}</Badge>
                            ) : (
                              <Badge color="gray">{t('consentNotRequired')}</Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" justify="flex-end">
                              <Tooltip label={t('viewDetails')}>
                                <ActionIcon
                                  variant="subtle"
                                  color="blue"
                                  onClick={() => router.push(`/events/${event.id}`)}
                                >
                                  <IconEye size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Menu position="bottom-end" withinPortal>
                                <Menu.Target>
                                  <ActionIcon variant="subtle" color="gray">
                                    <IconDotsVertical size={16} />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Item
                                    leftSection={<IconEdit size={14} />}
                                    onClick={() => router.push(`/events/${event.id}/edit`)}
                                  >
                                    {t('edit')}
                                  </Menu.Item>
                                  <Menu.Item
                                    leftSection={<IconTrash size={14} />}
                                    color="red"
                                    onClick={() => handleDelete(event.id, event.title)}
                                  >
                                    {t('delete')}
                                  </Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>

                {/* Pagination */}
                {data.meta && data.meta.totalPages > 1 && (
                  <Group justify="center" mt="md">
                    <Pagination total={data.meta.totalPages} value={page} onChange={setPage} />
                  </Group>
                )}
              </Stack>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                {t('noEventsFound')}
              </Text>
            )}
          </Paper>
        </Stack>
      </div>
    </>
  );
}

