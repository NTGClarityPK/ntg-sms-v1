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
  ScrollArea,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconPlus, IconSearch, IconDotsVertical, IconEdit, IconTrash, IconEye } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEvents, useDeleteEvent, useEventConflicts } from '@/hooks/api/useEvents';
import { modals } from '@mantine/modals';
import dayjs from 'dayjs';
import type { Event } from '@/types/events';
import { IconAlertTriangle } from '@tabler/icons-react';

export default function EventsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [requiresConsent, setRequiresConsent] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const { data, isLoading } = useEvents({
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
      title: 'Delete Event',
      children: (
        <Text size="sm">
          Are you sure you want to delete the event <strong>{title}</strong>? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteEvent.mutate(id),
    });
  };

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
          label={`${totalConflicts} conflict${totalConflicts > 1 ? 's' : ''} detected`}
          withArrow
        >
          <Badge color="yellow" leftSection={<IconAlertTriangle size={12} />}>
            Conflict
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
          <Title order={1}>Events</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => router.push('/events/create')}
          >
            Create Event
          </Button>
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
              <Group grow>
                <TextInput
                  placeholder="Search events..."
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                />
                <Select
                  placeholder="Filter by status"
                  data={[
                    { value: 'all', label: 'All' },
                    { value: 'upcoming', label: 'Upcoming' },
                    { value: 'past', label: 'Past' },
                  ]}
                  value={status}
                  onChange={setStatus}
                  clearable
                />
                <Select
                  placeholder="Requires consent"
                  data={[
                    { value: 'true', label: 'Yes' },
                    { value: 'false', label: 'No' },
                  ]}
                  value={requiresConsent}
                  onChange={setRequiresConsent}
                  clearable
                />
              </Group>
              <Group grow>
                <DatePickerInput
                  placeholder="Start date"
                  value={startDate}
                  onChange={setStartDate}
                  clearable
                />
                <DatePickerInput
                  placeholder="End date"
                  value={endDate}
                  onChange={setEndDate}
                  clearable
                />
              </Group>
            </Stack>
          </Paper>

          {/* Events Table */}
          <Paper p="md" withBorder>
            {isLoading || !data ? (
              <Stack gap="md">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} height={60} />
                ))}
              </Stack>
            ) : data.data.length > 0 ? (
              <Stack gap="md">
                <ScrollArea>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Title</Table.Th>
                        <Table.Th>Dates</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Consent Required</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
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
                              <Badge color="orange">Required</Badge>
                            ) : (
                              <Badge color="gray">Not Required</Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" justify="flex-end">
                              <Tooltip label="View Details">
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
                                    Edit
                                  </Menu.Item>
                                  <Menu.Item
                                    leftSection={<IconTrash size={14} />}
                                    color="red"
                                    onClick={() => handleDelete(event.id, event.title)}
                                  >
                                    Delete
                                  </Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>

                {/* Pagination */}
                {data.meta && data.meta.totalPages > 1 && (
                  <Group justify="center" mt="md">
                    <Pagination total={data.meta.totalPages} value={page} onChange={setPage} />
                  </Group>
                )}
              </Stack>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                No events found. Create your first event to get started.
              </Text>
            )}
          </Paper>
        </Stack>
      </div>
    </>
  );
}

