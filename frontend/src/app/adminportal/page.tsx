'use client';

import { Group, Title, Stack, Text, Paper, SimpleGrid, Badge, Skeleton, Alert, Divider, Table } from '@mantine/core';
import { useTenantStatistics } from '@/hooks/useTenant';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { IconUsers, IconSchool, IconUser, IconBuilding } from '@tabler/icons-react';

export default function AdminPortalDashboardPage() {
  const colors = useThemeColors();
  const statisticsQuery = useTenantStatistics();

  const totalTenants = statisticsQuery.data?.data?.length || 0;
  const totalUsers = statisticsQuery.data?.data?.reduce((sum, t) => sum + t.totalUsers, 0) || 0;
  const totalStudents = statisticsQuery.data?.data?.reduce((sum, t) => sum + t.totalStudents, 0) || 0;
  const totalBranches = statisticsQuery.data?.data?.reduce((sum, t) => sum + t.totalBranches, 0) || 0;

  return (
    <>
      <div
        className="page-title-bar"
        style={{
          borderTopLeftRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <Group justify="space-between" w="100%">
          <Title order={1}>Dashboard</Title>
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
          {/* Summary Cards */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <Paper withBorder p="md">
              <Stack gap="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Total Tenants
                </Text>
                <Group gap="xs" align="center">
                  <IconBuilding size={24} />
                  <Title order={2}>{totalTenants}</Title>
                </Group>
              </Stack>
            </Paper>

            <Paper withBorder p="md">
              <Stack gap="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Total Branches
                </Text>
                <Group gap="xs" align="center">
                  <IconSchool size={24} />
                  <Title order={2}>{totalBranches}</Title>
                </Group>
              </Stack>
            </Paper>

            <Paper withBorder p="md">
              <Stack gap="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Total Users
                </Text>
                <Group gap="xs" align="center">
                  <IconUsers size={24} />
                  <Title order={2}>{totalUsers}</Title>
                </Group>
              </Stack>
            </Paper>

            <Paper withBorder p="md">
              <Stack gap="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Total Students
                </Text>
                <Group gap="xs" align="center">
                  <IconUser size={24} />
                  <Title order={2}>{totalStudents}</Title>
                </Group>
              </Stack>
            </Paper>
          </SimpleGrid>

          {/* Tenant Statistics Table */}
          {statisticsQuery.isLoading ? (
            <Stack gap="md">
              <Skeleton height={200} />
              <Skeleton height={200} />
            </Stack>
          ) : statisticsQuery.error ? (
            <Alert color={colors.error} title="Failed to load statistics">
              <Text size="sm">Please try again.</Text>
            </Alert>
          ) : statisticsQuery.data?.data && statisticsQuery.data.data.length > 0 ? (
            <Paper withBorder p="md">
              <Title order={2} mb="md">
                Tenant Statistics
              </Title>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tenant</Table.Th>
                    <Table.Th>Branches</Table.Th>
                    <Table.Th>Users</Table.Th>
                    <Table.Th>Students</Table.Th>
                    <Table.Th>Staff</Table.Th>
                    <Table.Th>School Admins</Table.Th>
                    <Table.Th>Contact</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {statisticsQuery.data.data.map((tenant) => (
                    <Table.Tr key={tenant.tenantId}>
                      <Table.Td>
                        <Stack gap={4}>
                          <Text fw={600}>{tenant.tenantName}</Text>
                          <Text size="xs" c="dimmed">
                            {tenant.tenantCode}
                          </Text>
                          {tenant.domain && (
                            <Badge size="xs" variant="light">
                              {tenant.domain}
                            </Badge>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{tenant.totalBranches}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{tenant.totalUsers}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{tenant.totalStudents}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{tenant.totalStaff || 0}</Text>
                      </Table.Td>
                      <Table.Td>
                        {tenant.schoolAdmins.length > 0 ? (
                          <Stack gap="xs">
                            {tenant.schoolAdmins.map((admin, idx) => (
                              <Stack key={admin.userId} gap={2}>
                                <Text size="sm" fw={500}>
                                  {admin.fullName || 'N/A'}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {admin.email}
                                </Text>
                                {idx < tenant.schoolAdmins.length - 1 && <Divider />}
                              </Stack>
                            ))}
                          </Stack>
                        ) : (
                          <Text size="sm" c="dimmed">
                            No admins
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={4}>
                          {tenant.email && (
                            <Text size="xs">
                              <Text component="span" fw={500}>
                                Email:
                              </Text>{' '}
                              {tenant.email}
                            </Text>
                          )}
                          {tenant.phone && (
                            <Text size="xs">
                              <Text component="span" fw={500}>
                                Phone:
                              </Text>{' '}
                              {tenant.phone}
                            </Text>
                          )}
                          {!tenant.email && !tenant.phone && (
                            <Text size="xs" c="dimmed">
                              No contact info
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          ) : (
            <Paper withBorder p="lg">
              <Text c="dimmed" ta="center">
                No tenants found.
              </Text>
            </Paper>
          )}
        </Stack>
      </div>
    </>
  );
}
