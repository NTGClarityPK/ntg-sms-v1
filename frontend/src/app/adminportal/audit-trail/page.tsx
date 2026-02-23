'use client';

import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Skeleton,
  Stack,
  Text,
  Title,
  TextInput,
  Table,
  Paper,
  Pagination,
  ActionIcon,
  Tooltip,
  Modal,
  Code,
  ScrollArea,
  Divider,
} from '@mantine/core';
import { IconHistory, IconRefresh, IconSearch, IconEye, IconX } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuditLogs, type AuditLog } from '@/hooks/useAuditLogs';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { useDisclosure } from '@mantine/hooks';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
};

export default function AuditTrailPage() {
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const [page, setPage] = useState(1);
  const [tableName, setTableName] = useState<string | undefined>(undefined);
  const [action, setAction] = useState<'CREATE' | 'UPDATE' | 'DELETE' | undefined>(undefined);
  const [username, setUsername] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpened, { open: openDetails, close: closeDetails }] = useDisclosure(false);

  const auditLogsQuery = useAuditLogs({
    page,
    limit: 50,
    tableName,
    action,
    username: username || undefined,
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    openDetails();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatJson = (obj: Record<string, unknown> | null) => {
    if (!obj) return 'N/A';
    return JSON.stringify(obj, null, 2);
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Group gap="xs">
            <IconHistory size={24} />
            <Title order={1}>Audit Trail</Title>
          </Group>
          <Tooltip label="Refresh">
            <ActionIcon
              variant="light"
              size="lg"
              loading={auditLogsQuery.isRefetching}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['audit-logs'] })}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
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
        <Stack gap="lg">
          <Alert color="blue" title="Audit Trail Logs">
            <Text size="sm">
              View all system changes and user actions. Only super admins can access this page.
            </Text>
          </Alert>

          {/* Filters */}
          <Card withBorder p="md">
            <Stack gap="md">
              <Title order={3}>Filters</Title>
              <Group grow>
                <TextInput
                  label="Username"
                  placeholder="Search by username"
                  leftSection={<IconSearch size={16} />}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Select
                  label="Table"
                  placeholder="All tables"
                  clearable
                  data={[
                    'academic_years',
                    'assessment_attachments',
                    'assessment_types',
                    'assessments',
                    'attendance',
                    'behavioral_assessments',
                    'branches',
                    'class_sections',
                    'class_subject_template_assignments',
                    'classes',
                    'early_departure_requests',
                    'events',
                    'grade_ranges',
                    'grade_templates',
                    'leave_requests',
                    'leave_settings',
                    'level_subject_template_assignments',
                    'levels',
                    'parent_students',
                    'profiles',
                    'public_holidays',
                    'sections',
                    'staff',
                    'student_grades',
                    'student_subject_template_assignments',
                    'students',
                    'subject_template_subjects',
                    'subject_templates',
                    'subjects',
                    'teacher_assignments',
                    'tenants',
                    'timetable_slots',
                    'timing_templates',
                    'user_roles',
                    'vacations',
                  ]}
                  value={tableName}
                  onChange={(value) => setTableName(value || undefined)}
                />
                <Select
                  label="Action"
                  placeholder="All actions"
                  clearable
                  data={[
                    { value: 'CREATE', label: 'Create' },
                    { value: 'UPDATE', label: 'Update' },
                    { value: 'DELETE', label: 'Delete' },
                  ]}
                  value={action}
                  onChange={(value) => setAction(value as typeof action)}
                />
                <DatePickerInput
                  label="Start Date"
                  placeholder="Select start date"
                  value={startDate}
                  onChange={setStartDate}
                  clearable
                />
                <DatePickerInput
                  label="End Date"
                  placeholder="Select end date"
                  value={endDate}
                  onChange={setEndDate}
                  clearable
                />
              </Group>
            </Stack>
          </Card>

          {/* Audit Logs Table */}
          <Card withBorder p="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={3}>Audit Logs</Title>
                {auditLogsQuery.data?.meta && (
                  <Text size="sm" c="dimmed">
                    Total: {auditLogsQuery.data.meta.total} records
                  </Text>
                )}
              </Group>

              {auditLogsQuery.isLoading || auditLogsQuery.isRefetching ? (
                <Stack gap="xs">
                  <Skeleton height={50} />
                  <Skeleton height={50} />
                  <Skeleton height={50} />
                </Stack>
              ) : auditLogsQuery.error ? (
                <Alert color="red" title="Error">
                  {auditLogsQuery.error instanceof Error
                    ? auditLogsQuery.error.message
                    : 'Failed to load audit logs'}
                </Alert>
              ) : !auditLogsQuery.data?.data || auditLogsQuery.data.data.length === 0 ? (
                <Alert color="gray" title="No Records">
                  No audit logs found matching your filters.
                </Alert>
              ) : (
                <>
                  <Paper withBorder>
                    <Table.ScrollContainer minWidth={1200}>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Timestamp</Table.Th>
                            <Table.Th>Action</Table.Th>
                            <Table.Th>Table</Table.Th>
                            <Table.Th>Record ID</Table.Th>
                            <Table.Th>User</Table.Th>
                            <Table.Th>Branch</Table.Th>
                            <Table.Th>Details</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {auditLogsQuery.data.data.map((log) => (
                            <Table.Tr key={log.id}>
                              <Table.Td>
                                <Text size="sm">{formatDate(log.createdAt)}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge color={ACTION_COLORS[log.action] || 'gray'} variant="light">
                                  {log.action}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" fw={500}>
                                  {log.tableName}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Code>{log.recordId.substring(0, 8)}...</Code>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{log.username}</Text>
                                <Text size="xs" c="dimmed">
                                  {log.userEmail}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {log.branchId ? (
                                    <Code>{log.branchId.substring(0, 8)}...</Code>
                                  ) : (
                                    <Text c="dimmed">N/A</Text>
                                  )}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Tooltip label="View Details">
                                  <ActionIcon
                                    variant="light"
                                    color="blue"
                                    onClick={() => handleViewDetails(log)}
                                  >
                                    <IconEye size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Paper>

                  {auditLogsQuery.data?.meta && auditLogsQuery.data.meta.totalPages > 1 && (
                    <Group justify="center">
                      <Pagination
                        value={page}
                        onChange={setPage}
                        total={auditLogsQuery.data.meta.totalPages}
                      />
                    </Group>
                  )}
                </>
              )}
            </Stack>
          </Card>
        </Stack>
      </div>

      {/* Details Modal */}
      <Modal
        opened={detailsOpened}
        onClose={closeDetails}
        title="Audit Log Details"
        size="xl"
      >
        {selectedLog && (
          <Stack gap="md">
            <Group grow>
              <div>
                <Text size="sm" fw={500} c="dimmed">
                  Action
                </Text>
                <Badge color={ACTION_COLORS[selectedLog.action] || 'gray'} size="lg">
                  {selectedLog.action}
                </Badge>
              </div>
              <div>
                <Text size="sm" fw={500} c="dimmed">
                  Table
                </Text>
                <Text size="sm" fw={500}>
                  {selectedLog.tableName}
                </Text>
              </div>
              <div>
                <Text size="sm" fw={500} c="dimmed">
                  Timestamp
                </Text>
                <Text size="sm">{formatDate(selectedLog.createdAt)}</Text>
              </div>
            </Group>

            <Divider />

            <div>
              <Text size="sm" fw={500} c="dimmed" mb="xs">
                User
              </Text>
              <Text size="sm">{selectedLog.username}</Text>
              <Text size="xs" c="dimmed">
                {selectedLog.userEmail}
              </Text>
            </div>

            <div>
              <Text size="sm" fw={500} c="dimmed" mb="xs">
                Record ID
              </Text>
              <Code>{selectedLog.recordId}</Code>
            </div>

            {selectedLog.branchId && (
              <div>
                <Text size="sm" fw={500} c="dimmed" mb="xs">
                  Branch ID
                </Text>
                <Code>{selectedLog.branchId}</Code>
              </div>
            )}

            {selectedLog.changedFields && selectedLog.changedFields.length > 0 && (
              <div>
                <Text size="sm" fw={500} c="dimmed" mb="xs">
                  Changed Fields
                </Text>
                <Group gap="xs">
                  {selectedLog.changedFields.map((field) => (
                    <Badge key={field} variant="outline" size="sm">
                      {field}
                    </Badge>
                  ))}
                </Group>
              </div>
            )}

            {selectedLog.oldValues && (
              <div>
                <Text size="sm" fw={500} c="dimmed" mb="xs">
                  Old Values
                </Text>
                <ScrollArea h={200}>
                  <Code block>{formatJson(selectedLog.oldValues)}</Code>
                </ScrollArea>
              </div>
            )}

            {selectedLog.newValues && (
              <div>
                <Text size="sm" fw={500} c="dimmed" mb="xs">
                  New Values
                </Text>
                <ScrollArea h={200}>
                  <Code block>{formatJson(selectedLog.newValues)}</Code>
                </ScrollArea>
              </div>
            )}

            {selectedLog.ipAddress && (
              <div>
                <Text size="sm" fw={500} c="dimmed" mb="xs">
                  IP Address
                </Text>
                <Code>{selectedLog.ipAddress}</Code>
              </div>
            )}

            {selectedLog.userAgent && (
              <div>
                <Text size="sm" fw={500} c="dimmed" mb="xs">
                  User Agent
                </Text>
                <Text size="sm" style={{ wordBreak: 'break-word' }}>
                  {selectedLog.userAgent}
                </Text>
              </div>
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}
