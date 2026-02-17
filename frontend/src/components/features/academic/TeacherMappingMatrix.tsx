'use client';

import { useMemo, useState } from 'react';
import {
  Paper,
  Table,
  Text,
  ScrollArea,
  Stack,
  MultiSelect,
  TextInput,
  Group,
  Box,
  Switch,
  Skeleton,
} from '@mantine/core';
import { IconSearch, IconFilter } from '@tabler/icons-react';
import type { TeacherAssignment } from '@/types/teacher-assignments';
import { MatrixCell } from './MatrixCell';
import { useClassSections } from '@/hooks/useClassSections';
import { useSubjects } from '@/hooks/useCoreLookups';
import { useCreateTeacherAssignment, useDeleteTeacherAssignment } from '@/hooks/useTeacherAssignments';

interface TeacherMappingMatrixProps {
  assignments: TeacherAssignment[];
}

export function TeacherMappingMatrix({ assignments }: TeacherMappingMatrixProps) {
  // Fetch all class sections (no pagination) for proper sorting
  const { data: classSectionsData, isLoading: isLoadingClassSections } = useClassSections({
    limit: 500, // Maximum allowed limit - fetch all class sections
    minimal: true, // Skip student counts for performance
  });
  const { data: subjectsData, isLoading: isLoadingSubjects } = useSubjects();
  const createAssignment = useCreateTeacherAssignment();
  const deleteAssignment = useDeleteTeacherAssignment();

  const [selectedClassSectionIds, setSelectedClassSectionIds] = useState<string[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [onlyShowAssigned, setOnlyShowAssigned] = useState(false);

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

  // Get unique class-sections and subjects, sorted appropriately
  const uniqueClassSections = useMemo(() => {
    const seen = new Set<string>();
    const unique = classSections.filter((cs) => {
      if (seen.has(cs.id)) return false;
      seen.add(cs.id);
      return true;
    });
    // Sort by class sortOrder (ascending), then by section sortOrder (ascending), then by section name (alphabetical)
    return unique.sort((a, b) => {
      const classSortA = a.classSortOrder ?? 999;
      const classSortB = b.classSortOrder ?? 999;
      if (classSortA !== classSortB) {
        return classSortA - classSortB;
      }
      const sectionSortA = a.sectionSortOrder ?? 999;
      const sectionSortB = b.sectionSortOrder ?? 999;
      if (sectionSortA !== sectionSortB) {
        return sectionSortA - sectionSortB;
      }
      const sectionA = (a.sectionName || '').toLowerCase();
      const sectionB = (b.sectionName || '').toLowerCase();
      return sectionA.localeCompare(sectionB);
    });
  }, [classSections]);

  const uniqueSubjects = useMemo(() => {
    const seen = new Set<string>();
    const unique = subjects.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    // Sort alphabetically by name
    return unique.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [subjects]);

  // Class sections and subjects that have at least one assignment (for "only show assigned" filter)
  const assignedClassSectionIds = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((a) => set.add(a.classSectionId));
    return set;
  }, [assignments]);
  const assignedSubjectIds = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((a) => set.add(a.subjectId));
    return set;
  }, [assignments]);

  // When teacher search is set, only show class sections and subjects that have at least one assignment with matching teacher
  const classSectionIdsWithTeacher = useMemo(() => {
    if (!teacherSearchQuery.trim()) return null;
    const q = teacherSearchQuery.trim().toLowerCase();
    const csIds = new Set<string>();
    const subjIds = new Set<string>();
    assignments.forEach((a) => {
      const name = (a.staffName ?? '').toLowerCase();
      if (name.includes(q)) {
        csIds.add(a.classSectionId);
        subjIds.add(a.subjectId);
      }
    });
    return { classSectionIds: csIds, subjectIds: subjIds };
  }, [assignments, teacherSearchQuery]);

  const visibleClassSections = useMemo(() => {
    let list = uniqueClassSections;
    if (classSectionIdsWithTeacher) {
      list = list.filter((cs) => classSectionIdsWithTeacher.classSectionIds.has(cs.id));
    }
    if (selectedClassSectionIds.length > 0) {
      list = list.filter((cs) => selectedClassSectionIds.includes(cs.id));
    }
    if (onlyShowAssigned) {
      list = list.filter((cs) => assignedClassSectionIds.has(cs.id));
    }
    return list;
  }, [
    uniqueClassSections,
    classSectionIdsWithTeacher,
    selectedClassSectionIds,
    onlyShowAssigned,
    assignedClassSectionIds,
  ]);

  const visibleSubjects = useMemo(() => {
    let list = uniqueSubjects;
    if (classSectionIdsWithTeacher) {
      list = list.filter((s) => classSectionIdsWithTeacher.subjectIds.has(s.id));
    }
    if (selectedSubjectIds.length > 0) {
      list = list.filter((s) => selectedSubjectIds.includes(s.id));
    }
    if (onlyShowAssigned) {
      list = list.filter((s) => assignedSubjectIds.has(s.id));
    }
    return list;
  }, [
    uniqueSubjects,
    classSectionIdsWithTeacher,
    selectedSubjectIds,
    onlyShowAssigned,
    assignedSubjectIds,
  ]);

  // Sort by class sort order first, then by section sort order
  const classSectionOptions = uniqueClassSections
    .sort((a, b) => {
      const classOrderA = a.classSortOrder ?? 999;
      const classOrderB = b.classSortOrder ?? 999;
      if (classOrderA !== classOrderB) return classOrderA - classOrderB;
      const sectionOrderA = a.sectionSortOrder ?? 999;
      const sectionOrderB = b.sectionSortOrder ?? 999;
      return sectionOrderA - sectionOrderB;
    })
    .map((cs) => ({
      value: cs.id,
      label: `${cs.classDisplayName ?? cs.className ?? 'Unknown'} - ${cs.sectionName ?? 'Unknown'}`,
    }));
  const subjectOptions = uniqueSubjects.map((s) => ({ value: s.id, label: s.name }));

  // Show skeleton while loading class sections or subjects
  if (isLoadingClassSections || isLoadingSubjects || !classSectionsData || !subjectsData) {
    return (
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Skeleton height={40} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={400} />
        </Stack>
      </Paper>
    );
  }

  if (uniqueClassSections.length === 0 || uniqueSubjects.length === 0) {
    return (
      <Paper p="md" withBorder>
        <Text c="dimmed" ta="center">
          Please create class-sections and subjects first before creating teacher assignments.
        </Text>
      </Paper>
    );
  }

  const stickyHeaderStyle = {
    position: 'sticky' as const,
    left: 0,
    zIndex: 12,
    backgroundColor: 'var(--mantine-color-default)',
    boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
    minWidth: 140,
  };
  const stickyCellStyle = (isStriped: boolean) => ({
    position: 'sticky' as const,
    left: 0,
    zIndex: 11,
    backgroundColor: isStriped ? 'var(--mantine-color-default-hover)' : 'var(--mantine-color-body)',
    boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
    fontWeight: 500,
    minWidth: 140,
  });

  return (
    <Paper p="md" withBorder>
      {/* Filters at top */}
      <Box mb="md">
        <Group gap="xs" mb="sm">
          <IconFilter size={18} />
          <Text size="sm" fw={600}>
            Filters
          </Text>
        </Group>
        <Stack gap="sm">
          <Switch
            label="Only show rows and columns where at least one teacher is assigned"
            description="Hide class sections and subjects with no assignments."
            checked={onlyShowAssigned}
            onChange={(e) => setOnlyShowAssigned(e.currentTarget.checked)}
          />
          <Group grow align="flex-start" wrap="wrap">
            <MultiSelect
              label="Show class sections"
              placeholder={
                selectedClassSectionIds.length === 0
                  ? 'All class sections'
                  : `${selectedClassSectionIds.length} class section${selectedClassSectionIds.length === 1 ? '' : 's'} selected`
              }
              description="Narrow by class sections. Clear to show all."
              data={classSectionOptions}
              value={selectedClassSectionIds}
              onChange={setSelectedClassSectionIds}
              clearable
              searchable
              style={{ minWidth: 200 }}
            />
            <MultiSelect
              label="Show subjects"
              placeholder={
                selectedSubjectIds.length === 0
                  ? 'All subjects'
                  : `${selectedSubjectIds.length} subject${selectedSubjectIds.length === 1 ? '' : 's'} selected`
              }
              description="Narrow by subjects. Clear to show all."
              data={subjectOptions}
              value={selectedSubjectIds}
              onChange={setSelectedSubjectIds}
              clearable
              searchable
              style={{ minWidth: 200 }}
            />
            <TextInput
              label="Filter by teacher"
              placeholder="Search by teacher name..."
              description="Show only cells where this teacher is assigned."
              leftSection={<IconSearch size={16} />}
              value={teacherSearchQuery}
              onChange={(e) => setTeacherSearchQuery(e.currentTarget.value)}
              style={{ minWidth: 200 }}
            />
          </Group>
        </Stack>
      </Box>

      {visibleClassSections.length === 0 || visibleSubjects.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No rows or columns match the current filters. Clear the teacher search or adjust class section and subject
          selections.
        </Text>
      ) : (
        <ScrollArea type="hover" scrollbarSize={8} mt="md">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={stickyHeaderStyle}>
                  Class-Section
                </Table.Th>
                {visibleSubjects.map((subject) => (
                  <Table.Th key={subject.id}>{subject.name}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibleClassSections.map((classSection, rowIndex) => (
                <Table.Tr key={classSection.id}>
                  <Table.Td style={stickyCellStyle(rowIndex % 2 === 1)}>
                    {classSection.classDisplayName || classSection.className || 'Unknown'} –{' '}
                    {classSection.sectionName || 'Unknown'}
                  </Table.Td>
                  {visibleSubjects.map((subject) => {
                    const key = `${classSection.id}-${subject.id}`;
                    const cellAssignments = assignmentMap.get(key) || [];
                    return (
                      <Table.Td key={subject.id}>
                        <MatrixCell
                          assignments={cellAssignments}
                          classSectionId={classSection.id}
                          subjectId={subject.id}
                          onCreate={async (input) => {
                            const result = await createAssignment.mutateAsync(input);
                            return result.data;
                          }}
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
      )}
    </Paper>
  );
}

