'use client';

import { useMemo } from 'react';
import { Paper, Table, Text, ScrollArea, Group, Button, Stack } from '@mantine/core';
import type { TeacherAssignment } from '@/types/teacher-assignments';
import { MatrixCell } from './MatrixCell';
import { useClassSections } from '@/hooks/useClassSections';
import { useSubjects } from '@/hooks/useCoreLookups';
import { useCreateTeacherAssignment, useDeleteTeacherAssignment } from '@/hooks/useTeacherAssignments';

interface TeacherMappingMatrixProps {
  assignments: TeacherAssignment[];
}

export function TeacherMappingMatrix({ assignments }: TeacherMappingMatrixProps) {
  const { data: classSectionsData } = useClassSections();
  const { data: subjectsData } = useSubjects();
  const createAssignment = useCreateTeacherAssignment();
  const deleteAssignment = useDeleteTeacherAssignment();

  const classSections = classSectionsData?.data || [];
  const subjects = subjectsData?.data || [];

  // Create a map of assignments by class-section and subject (supporting multiple teachers)
  const assignmentMap = useMemo(() => {
    const map = new Map<string, TeacherAssignment[]>();
    assignments.forEach((assignment) => {
      const key = `${assignment.classSectionId}-${assignment.subjectId}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(assignment);
    });
    return map;
  }, [assignments]);

  // Get unique class-sections and subjects
  const uniqueClassSections = useMemo(() => {
    const seen = new Set<string>();
    return classSections.filter((cs) => {
      const key = cs.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [classSections]);

  const uniqueSubjects = useMemo(() => {
    const seen = new Set<string>();
    return subjects.filter((s) => {
      const key = s.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [subjects]);

  if (uniqueClassSections.length === 0 || uniqueSubjects.length === 0) {
    return (
      <Paper p="md" withBorder>
        <Text c="dimmed" ta="center">
          Please create class-sections and subjects first before creating teacher assignments.
        </Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <ScrollArea>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: 'var(--mantine-color-body)' }}>
                Class-Section
              </Table.Th>
              {uniqueSubjects.map((subject) => (
                <Table.Th key={subject.id}>{subject.name}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {uniqueClassSections.map((classSection) => (
              <Table.Tr key={classSection.id}>
                <Table.Td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 9,
                    backgroundColor: 'var(--mantine-color-body)',
                    fontWeight: 500,
                  }}
                >
                  {classSection.classDisplayName || classSection.className || 'Unknown'} -{' '}
                  {classSection.sectionName || 'Unknown'}
                </Table.Td>
                {uniqueSubjects.map((subject) => {
                  const key = `${classSection.id}-${subject.id}`;
                  const cellAssignments = assignmentMap.get(key) || [];
                  return (
                    <Table.Td key={subject.id}>
                      <MatrixCell
                        assignments={cellAssignments}
                        classSectionId={classSection.id}
                        subjectId={subject.id}
                        onCreate={createAssignment.mutateAsync}
                        onDelete={deleteAssignment.mutateAsync}
                      />
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
  );
}

