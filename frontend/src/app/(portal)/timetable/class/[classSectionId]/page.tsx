'use client';

import { useParams, useRouter } from 'next/navigation';
import { Title, Group, Button, Stack, Skeleton, Alert } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useClassSection } from '@/hooks/useClassSections';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { ClassTimetableContent } from '@/components/features/timetable/ClassTimetableContent';
import type { ClassSection } from '@/types/class-sections';

export default function ClassTimetablePage() {
  const params = useParams();
  const router = useRouter();
  const classSectionId = params.classSectionId as string;
  const colors = useThemeColors();

  const { data: classSectionData, isLoading: classSectionLoading, error: classSectionError } =
    useClassSection(classSectionId);
  const classSection = classSectionData as ClassSection | null | undefined;

  const className = classSection
    ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
    : 'Class Timetable';

  if (classSectionLoading) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>Class Timetable</Title>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() => router.push('/timetable')}
            >
              Back
            </Button>
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
            <Skeleton height={40} width="30%" />
            <Skeleton height={400} />
          </Stack>
        </div>
      </>
    );
  }

  if (classSectionError || !classSection) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>Class Timetable</Title>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() => router.push('/timetable')}
            >
              Back
            </Button>
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
          <Alert color={colors.error} title="Error">
            <Stack gap="xs">
              {classSectionError instanceof Error ? (
                <>{classSectionError.message}</>
              ) : (
                <>Class section not found</>
              )}
            </Stack>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{className} Timetable</Title>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={18} />}
            onClick={() => router.push('/timetable')}
          >
            Back
          </Button>
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
        <ClassTimetableContent classSectionId={classSectionId} showHeaderActions={true} />
      </div>
    </>
  );
}
