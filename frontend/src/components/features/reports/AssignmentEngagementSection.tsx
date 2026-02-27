'use client';

import { Paper, Title, Table, Badge, Progress, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { AssignmentEngagement } from '@/types/reports';

interface AssignmentEngagementSectionProps {
  data: AssignmentEngagement[];
}

export function AssignmentEngagementSection({ data }: AssignmentEngagementSectionProps) {
  const t = useTranslations('reports');
  const getStatusBadge = (status: string, isViewed: boolean) => {
    if (status === 'submitted') {
      return <Badge color="green">{t('assignmentEngagementStatusSubmitted')}</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge color="yellow">{t('assignmentEngagementStatusInProgress')}</Badge>;
    }
    if (isViewed) {
      return <Badge color="blue">{t('assignmentEngagementStatusViewed')}</Badge>;
    }
    return <Badge color="gray">{t('assignmentEngagementStatusNotStarted')}</Badge>;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  };

  const getDaysUntilDueColor = (days?: number) => {
    if (days === undefined) return 'gray';
    if (days < 0) return 'red';
    if (days <= 3) return 'yellow';
    return 'green';
  };

  return (
    <Paper withBorder p="md">
      <Title order={3} mb="md">
        {t('assignmentEngagementTitle')}
      </Title>
      {data.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('assignmentEngagementNoAssignments')}
        </Text>
      ) : (
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('assignmentEngagementAssignment')}</Table.Th>
              <Table.Th>{t('assignmentEngagementSubject')}</Table.Th>
              <Table.Th>{t('assignmentEngagementDueDate')}</Table.Th>
              <Table.Th>{t('assignmentEngagementStatus')}</Table.Th>
              <Table.Th>{t('assignmentEngagementEngagement')}</Table.Th>
              <Table.Th>{t('assignmentEngagementDaysUntilDue')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((assignment) => (
              <Table.Tr key={assignment.assignmentId}>
                <Table.Td>{assignment.assignmentTitle}</Table.Td>
                <Table.Td>{assignment.subjectName}</Table.Td>
                <Table.Td>{formatDate(assignment.dueDate)}</Table.Td>
                <Table.Td>
                  {getStatusBadge(assignment.status, assignment.isViewed)}
                </Table.Td>
                <Table.Td>
                  <Progress
                    value={assignment.engagementScore}
                    color={
                      assignment.engagementScore >= 70
                        ? 'green'
                        : assignment.engagementScore >= 40
                        ? 'yellow'
                        : 'red'
                    }
                    size="sm"
                  />
                  <Text size="xs" c="dimmed" mt={4}>
                    {assignment.engagementScore}%
                  </Text>
                </Table.Td>
                <Table.Td>
                  {assignment.daysUntilDue !== undefined ? (
                    <Text c={getDaysUntilDueColor(assignment.daysUntilDue)} size="sm">
                      {assignment.daysUntilDue < 0
                        ? t('assignmentEngagementDaysOverdue', {
                            days: Math.abs(assignment.daysUntilDue),
                          })
                        : t('assignmentEngagementDaysLeft', {
                            days: assignment.daysUntilDue,
                          })}
                    </Text>
                  ) : (
                    '—'
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
