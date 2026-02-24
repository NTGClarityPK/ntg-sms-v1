'use client';

import { useState } from 'react';
import {
  Group,
  Title,
  Stack,
  Skeleton,
  Select,
  Paper,
  Text,
  Button,
  TextInput,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useUniforms } from '@/hooks/useInventory';
import { useStudents } from '@/hooks/useStudents';
import {
  useIssuanceReport,
  useUniformIssuances,
} from '@/hooks/useUniformIssuances';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { IssuanceReport } from '@/components/features/inventory/IssuanceReport';
import { IssuanceHistory } from '@/components/features/inventory/IssuanceHistory';
import { DirectIssueModal } from '@/components/features/inventory/DirectIssueModal';

export default function InventoryHistoryPage() {
  const { canEdit } = useFeaturePermission('inventory');
  const [directIssueOpened, { open: openDirectIssue, close: closeDirectIssue }] =
    useDisclosure(false);
  const [studentFilter, setStudentFilter] = useState<string | null>(null);
  const [itemFilter, setItemFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );

  const { data: studentsData } = useStudents({ page: 1, limit: 500 });
  const { data: uniformsResponse } = useUniforms({ page: 1, limit: 200 });
  const students = studentsData?.data ?? [];
  const uniforms = (uniformsResponse as { data?: { id: string; name: string }[] })
    ?.data ?? [];

  const reportQuery = useIssuanceReport({
    studentId: studentFilter ?? undefined,
    uniformItemId: itemFilter ?? undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const historyQuery = useUniformIssuances(selectedStudentId);
  const reportRows = reportQuery.data ?? [];
  const issuances = historyQuery.data ?? [];

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Issuance history</Title>
          {canEdit && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openDirectIssue}
            >
              Direct issue
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
          <Paper p="md" withBorder>
            <Text fw={600} mb="sm">
              Report filters
            </Text>
            <Group align="flex-end" gap="md" wrap="wrap">
              <Select
                label="Student"
                placeholder="All students"
                data={students.map((s) => ({
                  value: s.id,
                  label: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.studentId || s.id,
                }))}
                value={studentFilter}
                onChange={setStudentFilter}
                clearable
                searchable
              />
              <Select
                label="Item"
                placeholder="All items"
                data={uniforms.map((u) => ({ value: u.id, label: u.name }))}
                value={itemFilter}
                onChange={setItemFilter}
                clearable
              />
              <TextInput
                type="date"
                label="From date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.currentTarget.value)}
              />
              <TextInput
                type="date"
                label="To date"
                value={dateTo}
                onChange={(e) => setDateTo(e.currentTarget.value)}
              />
            </Group>
          </Paper>

          {reportQuery.isLoading || !reportQuery.data ? (
            <Skeleton height={200} />
          ) : (
            <IssuanceReport rows={reportRows} isLoading={reportQuery.isLoading} />
          )}

          {canEdit && (
            <>
              <Text fw={600} mt="md">
                History by student
              </Text>
              <Select
                placeholder="Select student to view history"
                data={students.map((s) => ({
                  value: s.id,
                  label: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.studentId || s.id,
                }))}
                value={selectedStudentId}
                onChange={setSelectedStudentId}
                clearable
                searchable
              />
              {selectedStudentId &&
                (historyQuery.isLoading ? (
                  <Skeleton height={120} />
                ) : (
                  <IssuanceHistory
                    issuances={issuances}
                    isLoading={historyQuery.isLoading}
                  />
                ))}
            </>
          )}
        </Stack>
      </div>

      <DirectIssueModal
        opened={directIssueOpened}
        onClose={closeDirectIssue}
      />
    </>
  );
}
