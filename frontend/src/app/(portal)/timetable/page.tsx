'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Title,
  Text,
  Select,
  Button,
  Stack,
  Skeleton,
  Paper,
  Group,
} from '@mantine/core';
import { IconCalendarClock } from '@tabler/icons-react';
import { useClassSections } from '@/hooks/useClassSections';
import { useAcademicYears } from '@/hooks/useAcademicYears';

export default function TimetablePage() {
  const router = useRouter();
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | null>(null);
  const { data: classSectionsData, isLoading: isLoadingClassSections } = useClassSections({
    isActive: true,
  });
  const { data: academicYearsData } = useAcademicYears();

  const activeYear = academicYearsData?.data?.find((y) => y.isActive);
  const classSections = classSectionsData?.data || [];

  // Format class-section options for Select
  const classSectionOptions = classSections.map((cs) => ({
    value: cs.id,
    label: `${cs.className || cs.classDisplayName || 'Unknown'} - ${cs.sectionName || 'Unknown'}`,
  }));

  const handleViewTimetable = () => {
    if (selectedClassSectionId) {
      router.push(`/timetable/class/${selectedClassSectionId}`);
    }
  };

  if (isLoadingClassSections || !classSectionsData) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>Timetable Management</Title>
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
          <Title order={1}>Timetable Management</Title>
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
        <Title order={1}>Timetable Management</Title>
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
        <Stack gap="xl">
          <Text c="dimmed">
            Select a class-section to view and manage its timetable. You can create, edit, and delete
            timetable slots, generate timetables from templates, and check for scheduling conflicts.
          </Text>

          <Paper p="md" withBorder>
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
                onChange={(value) => setSelectedClassSectionId(value)}
                searchable
                clearable
              />

              <Group justify="flex-end">
                <Button
                  onClick={handleViewTimetable}
                  disabled={!selectedClassSectionId}
                  leftSection={<IconCalendarClock size={18} />}
                >
                  View Timetable
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Stack>
      </div>
    </>
  );
}

