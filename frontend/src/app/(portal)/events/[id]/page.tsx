'use client';

/**
 * Event Detail Page
 */

import {
  Title,
  Paper,
  Group,
  Button,
  Stack,
  Text,
  Badge,
  Skeleton,
  Alert,
  Divider,
  Table,
  ScrollArea,
} from '@mantine/core';
import { IconEdit, IconCalendar, IconUsers, IconCheck, IconX } from '@tabler/icons-react';
import { useRouter, useParams } from 'next/navigation';
import { useEvent, useEventConflicts, useEventConsents } from '@/hooks/api/useEvents';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';
import type { Event } from '@/types/events';

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { user } = useAuth();
  const { data: eventData, isLoading } = useEvent(eventId);
  const { data: conflictsData } = useEventConflicts(eventId);
  const { data: consentsData } = useEventConsents(eventId);

  const event = eventData?.data;
  const conflicts = conflictsData?.data;
  const consents = consentsData?.data || [];

  // Calculate consent stats
  const consentStats = {
    approved: consents.filter((c) => c.status === 'approved').length,
    rejected: consents.filter((c) => c.status === 'rejected').length,
    pending: consents.filter((c) => c.status === 'pending').length,
    total: consents.length,
  };

  const isAdmin =
    user?.roles?.some(
      (r) => r.roleName === 'school_admin' || r.roleName === 'academic_coordinator',
    ) ?? false;

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

  if (isLoading || !eventData) {
    return (
      <>
        <div className="page-title-bar">
          <Skeleton height={40} width={200} />
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
            <Skeleton height={200} />
            <Skeleton height={100} />
          </Stack>
        </div>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>Event Not Found</Title>
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
          <Alert color="red">The requested event could not be found.</Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{event.title}</Title>
          {isAdmin && (
            <Button
              leftSection={<IconEdit size={16} />}
              onClick={() => router.push(`/events/${event.id}/edit`)}
            >
              Edit Event
            </Button>
          )}
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
          {/* Event Details */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group>
                <IconCalendar size={20} />
                <Text fw={500}>Event Dates</Text>
              </Group>
              <Text>
                {dayjs(event.startDate).format('MMMM D, YYYY')}
                {event.startDate !== event.endDate &&
                  ` – ${dayjs(event.endDate).format('MMMM D, YYYY')}`}
              </Text>
              <Group>
                {getStatusBadge(event)}
                {event.requiresConsent && (
                  <Badge color="orange" leftSection={<IconUsers size={12} />}>
                    Consent Required
                  </Badge>
                )}
              </Group>

              {event.description && (
                <>
                  <Divider />
                  <Text>{event.description}</Text>
                </>
              )}

              {event.requiresConsent && event.consentDeadline && (
                <>
                  <Divider />
                  <Group>
                    <Text fw={500}>Consent Deadline:</Text>
                    <Text>{dayjs(event.consentDeadline).format('MMMM D, YYYY')}</Text>
                  </Group>
                </>
              )}

              {/* Class Sections */}
              {event.participants && event.participants.length > 0 && (
                <>
                  <Divider />
                  <Group>
                    <IconUsers size={20} />
                    <Text fw={500}>Participating Classes:</Text>
                  </Group>
                  <Group gap="xs">
                    {event.participants
                      .filter((p) => p.classSectionId)
                      .map((participant) => {
                        const displayName = participant.className && participant.sectionName
                          ? `${participant.className} - ${participant.sectionName}`
                          : participant.classSectionId || 'Unknown';
                        return (
                          <Badge key={participant.id} variant="light" color="blue">
                            {displayName}
                          </Badge>
                        );
                      })}
                    {event.participants.filter((p) => p.classSectionId).length === 0 && (
                        <Text c="dimmed" size="sm">No class sections assigned</Text>
                      )}
                  </Group>
                </>
              )}
            </Stack>
          </Paper>

          {/* Conflicts Warning */}
          {conflicts &&
            (conflicts.assessmentConflicts.length > 0 || conflicts.eventConflicts.length > 0) && (
              <Alert color="yellow" title="Conflicts Detected">
                <Stack gap="xs">
                  {conflicts.assessmentConflicts.length > 0 && (
                    <div>
                      <Text fw={500}>Assessment Conflicts:</Text>
                      <ul>
                        {conflicts.assessmentConflicts.map((conflict) => (
                          <li key={conflict.id}>
                            {conflict.title} (Due: {dayjs(conflict.dueDate).format('MMM D, YYYY')})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {conflicts.eventConflicts.length > 0 && (
                    <div>
                      <Text fw={500}>Event Conflicts:</Text>
                      <ul>
                        {conflicts.eventConflicts.map((conflict) => (
                          <li key={conflict.id}>
                            {conflict.title} (
                            {dayjs(conflict.startDate).format('MMM D')} –{' '}
                            {dayjs(conflict.endDate).format('MMM D, YYYY')})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Stack>
              </Alert>
            )}

          {/* Consent Statistics (Admin only) */}
          {isAdmin && event.requiresConsent && (
            <Paper p="md" withBorder>
              <Stack gap="md">
                <Group>
                  <IconUsers size={20} />
                  <Text fw={500}>Consent Statistics</Text>
                </Group>
                <Group>
                  <Badge color="green" leftSection={<IconCheck size={12} />}>
                    Approved: {consentStats.approved}
                  </Badge>
                  <Badge color="red" leftSection={<IconX size={12} />}>
                    Rejected: {consentStats.rejected}
                  </Badge>
                  <Badge color="yellow">Pending: {consentStats.pending}</Badge>
                  <Badge color="gray">Total: {consentStats.total}</Badge>
                </Group>

                {consents.length > 0 && (
                  <>
                    <Divider />
                    <ScrollArea>
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Student</Table.Th>
                            <Table.Th>Class</Table.Th>
                            <Table.Th>Parent</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>Responded At</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {consents.map((consent) => (
                            <Table.Tr key={consent.id}>
                              <Table.Td>
                                <Stack gap={2}>
                                  <Text>
                                    {consent.studentName || consent.studentStudentId || consent.studentId}
                                  </Text>
                                  {consent.studentStudentId && consent.studentName && (
                                    <Text size="xs" c="dimmed">
                                      ID: {consent.studentStudentId}
                                    </Text>
                                  )}
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                {consent.className && consent.sectionName ? (
                                  <Text>{consent.className} - {consent.sectionName}</Text>
                                ) : consent.className ? (
                                  <Text>{consent.className}</Text>
                                ) : (
                                  <Text c="dimmed">—</Text>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Text>{consent.parentName || consent.parentUserId}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  color={
                                    consent.status === 'approved'
                                      ? 'green'
                                      : consent.status === 'rejected'
                                        ? 'red'
                                        : 'yellow'
                                  }
                                >
                                  {consent.status}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                {consent.respondedAt
                                  ? dayjs(consent.respondedAt).format('MMM D, YYYY HH:mm')
                                  : '—'}
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>
                  </>
                )}
              </Stack>
            </Paper>
          )}
        </Stack>
      </div>
    </>
  );
}

