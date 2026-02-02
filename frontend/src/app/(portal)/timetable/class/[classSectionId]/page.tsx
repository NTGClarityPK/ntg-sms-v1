'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Title,
  Text,
  Stack,
  Skeleton,
  Group,
  Button,
  Alert,
  Paper,
} from '@mantine/core';
import { IconArrowLeft, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useClassSection } from '@/hooks/useClassSections';
import { useClassTimetable, useConflicts, useGenerateTimetable } from '@/hooks/useTimetable';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { TimetableGrid } from '@/components/features/timetable/TimetableGrid';
import { SlotEditModal } from '@/components/features/timetable/SlotEditModal';
import { ConflictList } from '@/components/features/timetable/ConflictList';
import { useDisclosure } from '@mantine/hooks';
import type { TimetableSlot } from '@/types/timetable';

export default function ClassTimetablePage() {
  const params = useParams();
  const router = useRouter();
  const classSectionId = params.classSectionId as string;
  const colors = useThemeColors();
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  // Optional: Try to fetch class-section, but don't block on it
  const { data: classSectionData, isLoading: classSectionLoading } = useClassSection(classSectionId);
  const { data: timetableData, isLoading: timetableLoading, error: timetableError } = useClassTimetable(classSectionId);
  const { data: conflictsData } = useConflicts({ classSectionId });
  const generateMutation = useGenerateTimetable();

  const classSection = classSectionData?.data;
  const timetable = timetableData?.data;
  const conflicts = conflictsData?.data || [];

  const handleSlotClick = (slot: TimetableSlot | null, day: number, period: number) => {
    setSelectedSlot(slot);
    setSelectedDay(day);
    setSelectedPeriod(period);
    openModal();
  };

  const handleGenerate = async () => {
    if (!classSectionId) return;
    await generateMutation.mutateAsync({ classSectionId });
  };

  // Get class name from timetable data (preferred) or class-section data (fallback)
  const className = timetable
    ? `${timetable.className || 'Unknown'} - ${timetable.sectionName || 'Unknown'}`
    : classSection
      ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
      : 'Class Timetable';

  // CRITICAL: Proper loading states (isLoading || !data for loader)
  if (timetableLoading || !timetableData) {
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

  // Check if timetable data indicates class-section not found
  if (timetableError || !timetable) {
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
            <Text size="sm">
              {timetableError instanceof Error
                ? timetableError.message
                : 'Class section not found or timetable unavailable'}
            </Text>
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
          <Group>
            <Button
              leftSection={<IconPlus size={18} />}
              onClick={handleGenerate}
              loading={generateMutation.isPending}
            >
              Generate from Template
            </Button>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() => router.push('/timetable')}
            >
              Back
            </Button>
          </Group>
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
          {conflicts.length > 0 && (
            <Paper p="md" withBorder>
              <ConflictList conflicts={conflicts} />
            </Paper>
          )}

          {timetable && (
            <TimetableGrid
              classSectionId={classSectionId}
              slots={timetable.slots}
              onSlotClick={handleSlotClick}
              conflicts={conflicts}
              isLoading={timetableLoading}
            />
          )}

          {timetable && timetable.slots.length === 0 && (
            <Alert color={colors.info} title="No Timetable Slots">
              <Text size="sm">
                No timetable slots have been created yet. Click on empty cells to create slots, or
                use the "Generate from Template" button to create slots from the timing template.
              </Text>
            </Alert>
          )}
        </Stack>
      </div>

      <SlotEditModal
        opened={modalOpened}
        onClose={() => {
          closeModal();
          setSelectedSlot(null);
          setSelectedDay(null);
          setSelectedPeriod(null);
        }}
        slot={selectedSlot}
        classSectionId={classSectionId}
        dayOfWeek={selectedDay ?? 0}
        periodNumber={selectedPeriod ?? 1}
      />
    </>
  );
}
