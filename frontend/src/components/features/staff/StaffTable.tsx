'use client';

import { useState } from 'react';
import { Table, Badge, Group, ActionIcon, Pagination, Text, ScrollArea, useMantineTheme } from '@mantine/core';
import { IconEdit, IconCalendar } from '@tabler/icons-react';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { useRouter } from 'next/navigation';
import type { Staff } from '@/types/staff';
import type { Role } from '@/types/permissions';
import { StaffForm } from './StaffForm';
import { useRoles } from '@/hooks/useRoles';

interface StaffTableProps {
  staff: Staff[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  canEdit?: boolean;
}

export function StaffTable({ staff, meta, onPageChange, canEdit = true }: StaffTableProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const { data: rolesData } = useRoles();
  const roles = rolesData?.data || [];
  const router = useRouter();

  const handleEdit = (staffMember: Staff) => {
    setSelectedStaff(staffMember);
    open();
  };

  const getRoleBadges = (staffRoles?: Staff['roles']) => {
    if (!staffRoles || staffRoles.length === 0) return <Text c="dimmed" size="sm">No roles</Text>;
    
    return (
      <Group gap="xs">
        {staffRoles.map((r) => (
          <Badge key={r.roleId} size="sm" variant="light">
            {r.roleName}
          </Badge>
        ))}
      </Group>
    );
  };

  return (
    <>
      <ScrollArea type="auto" scrollbars="x" w="100%">
        <Table striped highlightOnHover style={{ minWidth: 800 }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Employee ID</Table.Th>
              <Table.Th>Roles</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {staff.map((staffMember) => (
              <Table.Tr key={staffMember.id}>
                <Table.Td>
                  <Text fw={500}>{staffMember.fullName || 'N/A'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{staffMember.email || 'N/A'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{staffMember.employeeId || 'N/A'}</Text>
                </Table.Td>
                <Table.Td>{getRoleBadges(staffMember.roles)}</Table.Td>
                <Table.Td>
                  <Badge color={staffMember.isActive ? 'green' : 'red'} variant="light">
                    {staffMember.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => router.push(`/staff/${staffMember.id}/schedule`)}
                      title="View Schedule"
                    >
                      <IconCalendar size={16} />
                    </ActionIcon>
                    {canEdit && (
                      <ActionIcon variant="light" onClick={() => handleEdit(staffMember)} title="Edit">
                        <IconEdit size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {meta && meta.totalPages > 1 && (
        <ScrollArea type="auto" scrollbars="x" w="100%" mt="md">
          <Group justify="center" wrap="nowrap" gap={4} style={{ minWidth: 'min-content' }}>
            <Pagination
              total={meta.totalPages}
              value={meta.page}
              onChange={onPageChange}
              size={isMobile ? 'sm' : 'md'}
              withEdges={!isMobile}
            />
          </Group>
        </ScrollArea>
      )}

      <StaffForm
        opened={opened}
        onClose={() => {
          close();
          setSelectedStaff(null);
        }}
        staff={selectedStaff}
        roles={roles}
      />
    </>
  );
}

