'use client';

import { useState } from 'react';
import {
  Title,
  Text,
  Select,
  Stack,
  Skeleton,
  Paper,
  Group,
  Alert,
} from '@mantine/core';
import { useClassSections } from '@/hooks/useClassSections';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { ClassTimetableContent } from '@/components/features/timetable/ClassTimetableContent';

export default function TimetablePage() {
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | null>(null);
  const colors = useThemeColors();
  const { data: classSectionsData, isLoading: isLoadingClassSections } = useClassSections({
    isActive: true,
  });
  const { data: academicYearsData } = useAcademicYears();

  const activeYear = academicYearsData?.data?.find((y) => y.isActive);
  const classSections = classSectionsData?.data || [];

  const classSectionOptions = classSections.map((cs) => ({
    value: cs.id,
    label: `${cs.className || cs.classDisplayName || 'Unknown'} - ${cs.sectionName || 'Unknown'}`,
  }));

  if (isLoadingClassSections || !classSectionsData) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>Timetable</Title>
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
            <Skeleton height={40} width="30%" />
            <Skeleton height={200} />
          </Stack>
        </div>
      </>
    );
  }

  if (classSections.length === 0) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>Timetable</Title>
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
          <Paper p="md" withBorder>
            <Text c="dimmed" ta="center">
              No active class-sections found. Please create class-sections first.
            </Text>
          </Paper>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>Timetable</Title>
      </div>
      <div className="page-sub-title-bar" />
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
          <Paper withBorder p="md">
            <Stack gap="md">
              {activeYear && (
                <Text size="sm" c="dimmed">
                  Active Academic Year: <strong>{activeYear.name}</strong>
                </Text>
              )}
              <Select
                label="Select Class Section"
                placeholder="Choose a class-section"
                data={classSectionOptions}
                value={selectedClassSectionId}
                onChange={setSelectedClassSectionId}
                searchable
                clearable
              />
            </Stack>
          </Paper>

          {selectedClassSectionId ? (
            <ClassTimetableContent
              classSectionId={selectedClassSectionId}
              showHeaderActions={false}
            />
          ) : (
            <Alert color={colors.primary}>
              Select a class-section to view and manage its timetable. You can create, edit, and
              delete timetable slots, generate timetables from templates, and check for scheduling
              conflicts.
            </Alert>
          )}
        </Stack>
      </div>
    </>
  );
}
