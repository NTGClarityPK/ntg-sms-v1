'use client';

import { Paper, Title, Table, Badge, Progress, Text } from '@mantine/core';
import type { AssignmentEngagement } from '@/types/reports';

interface AssignmentEngagementSectionProps {
  data: AssignmentEngagement[];
}

export function AssignmentEngagementSection({ data }: AssignmentEngagementSectionProps) {
  const getStatusBadge = (status: string, isViewed: boolean) => {
    if (status === 'submitted') {
      return <Badge color="green">Submitted</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge color="yellow">In Progress</Badge>;
    }
    if (isViewed) {
      return <Badge color="blue">Viewed</Badge>;
    }
    return <Badge color="gray">Not Started</Badge>;
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
      <Title order={3} mb="md">Assignment Engagement</Title>
      {data.length === 0 ? (
        <Text c="dimmed" size="sm">No assignments found.</Text>
      ) : (
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Assignment</Table.Th>
              <Table.Th>Subject</Table.Th>
              <Table.Th>Due Date</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Engagement</Table.Th>
              <Table.Th>Days Until Due</Table.Th>
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
                        ? `${Math.abs(assignment.daysUntilDue)} days overdue`
                        : `${assignment.daysUntilDue} days left`}
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
