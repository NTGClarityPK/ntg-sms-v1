'use client';

import { useState, useRef } from 'react';
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
import { IconArrowLeft, IconPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useClassSection } from '@/hooks/useClassSections';
import type { ClassSection } from '@/types/class-sections';
import { useClassTimetable, useConflicts, useGenerateTimetable, useCheckSlotConflict, useTimingTemplateInfo } from '@/hooks/useTimetable';
import { useTemplatesForClass } from '@/hooks/useSubjectTemplates';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { TimetableGrid } from '@/components/features/timetable/TimetableGrid';
import { SlotEditPopover } from '@/components/features/timetable/SlotEditPopover';
import { ConflictList } from '@/components/features/timetable/ConflictList';
import { TemplateInfoBanner } from '@/components/features/timetable/TemplateInfoBanner';
import { useDisclosure } from '@mantine/hooks';
import { Select, Paper as MantinePaper } from '@mantine/core';
import { useAuth } from '@/hooks/useAuth';
import type { TimetableSlot, CreateTimetableSlotInput } from '@/types/timetable';
import { TemplateSwitcher } from '@/components/features/timetable/TemplateSwitcher';
import { useEffect } from 'react';

export default function ClassTimetablePage() {
  const params = useParams();
  const router = useRouter();
  const classSectionId = params.classSectionId as string;
  const colors = useThemeColors();
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('');
  const [popoverTarget, setPopoverTarget] = useState<HTMLElement | null>(null);
  const [popoverOpened, { open: openPopover, close: closePopover }] = useDisclosure(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  // Fetch class-section to get classId
  const { data: classSectionData, isLoading: classSectionLoading, error: classSectionError } = useClassSection(classSectionId);
  // Based on console logs, classSectionData is ClassSection directly (not wrapped)
  // useClassSection returns response.data, and response.data from apiClient.get is already unwrapped
  const classSection = classSectionData as ClassSection | null | undefined;
  const classId = classSection?.classId ?? null;

  // Debug logging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[ClassTimetablePage] classSectionId:', classSectionId);
      console.log('[ClassTimetablePage] classSectionData:', classSectionData);
      console.log('[ClassTimetablePage] classSection:', classSection);
      console.log('[ClassTimetablePage] classId:', classId);
      console.log('[ClassTimetablePage] classSectionLoading:', classSectionLoading);
      console.log('[ClassTimetablePage] classSectionError:', classSectionError);
    }
  }, [classSectionId, classSectionData, classSection, classId, classSectionLoading, classSectionError]);
  const { data: templatesData, isLoading: templatesLoading } = useTemplatesForClass(classId, branchId ?? null);
  const { data: timetableData, isLoading: timetableLoading, error: timetableError } = useClassTimetable(
    classSectionId,
    undefined,
    selectedTemplateId ?? undefined,
  );
  const { data: conflictsData } = useConflicts({ classSectionId });
  const { data: templateInfoData } = useTimingTemplateInfo(classSectionId);
  const generateMutation = useGenerateTimetable();
  const checkConflict = useCheckSlotConflict();
  const timetable = timetableData?.data;
  const conflicts = conflictsData?.data || [];
  const availableTemplates = templatesData?.data ?? [];

  // Debug: Log templates data
  useEffect(() => {
    if (typeof window !== 'undefined' && templatesData) {
      console.log('Templates query data:', templatesData);
      console.log('Available templates:', availableTemplates);
      console.log('Class ID:', classId);
      console.log('Branch ID:', branchId);
    }
  }, [templatesData, availableTemplates, classId, branchId]);

  // Set default template when templates load (first template)
  useEffect(() => {
    if (!selectedTemplateId && availableTemplates.length > 0) {
      setSelectedTemplateId(availableTemplates[0].id);
    }
  }, [availableTemplates, selectedTemplateId]);

  const handleSlotClick = (slot: TimetableSlot | null, day: number, timeRange: string, target: HTMLElement) => {
    setSelectedSlot(slot);
    setSelectedDay(day);
    setSelectedTimeRange(timeRange);
    setPopoverTarget(target);
    openPopover();
  };

  const handleConflictCheck = async (slotInput: Partial<CreateTimetableSlotInput>): Promise<boolean> => {
    return await checkConflict({
      ...slotInput,
      classSectionId,
      dayOfWeek: selectedDay ?? 0,
    });
  };

  const handleGenerate = async () => {
    if (!classSectionId) return;
    if (!selectedTemplateId) {
      notifications.show({
        title: 'Error',
        message: 'Please select a subject template first',
        color: colors.error,
      });
      return;
    }
    await generateMutation.mutateAsync({
      classSectionId,
      subjectTemplateId: selectedTemplateId,
    });
  };

  // Get class name from timetable data (preferred) or class-section data (fallback)
  const className = timetable
    ? `${timetable.className || 'Unknown'} - ${timetable.sectionName || 'Unknown'}`
    : classSection
      ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
      : 'Class Timetable';

  // Only show loading skeleton if we're actually loading the class-section (initial load)
  // Don't block on timetable loading since it depends on selectedTemplateId
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

  // Check if class-section not found (only after loading completes)
  if (!classSectionLoading && (classSectionError || !classSection)) {
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
              {classSectionError instanceof Error
                ? classSectionError.message
                : 'Class section not found'}
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
            {classId && (
              <TemplateSwitcher
                templates={availableTemplates}
                selectedTemplateId={selectedTemplateId}
                onTemplateChange={setSelectedTemplateId}
                isLoading={templatesLoading || classSectionLoading}
              />
            )}
            <Button
              leftSection={<IconPlus size={18} />}
              onClick={handleGenerate}
              loading={generateMutation.isPending}
              disabled={!selectedTemplateId || !classId}
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
          <TemplateInfoBanner templateInfo={templateInfoData || null} />

          {/* Show loading state while fetching templates */}
          {classId && templatesLoading && (
            <Skeleton height={36} />
          )}

          {/* Show "No Templates" only after loading completes and we have a classId */}
          {!templatesLoading && classId && availableTemplates.length === 0 && (
            <Alert color="yellow" title="No Templates Available">
              <Text size="sm">
                No subject templates are assigned to this class. Assign templates in{' '}
                <Text
                  component="span"
                  fw={500}
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => router.push('/settings/subject-templates')}
                >
                  Settings → Subject Templates
                </Text>
                .
              </Text>
            </Alert>
          )}

          {/* Show "Select Template" message if templates exist but none selected */}
          {!templatesLoading && classId && availableTemplates.length > 0 && !selectedTemplateId && (
            <Alert color="blue" title="Select a Subject Template">
              <Text size="sm">
                Please select a subject template from the dropdown above to view or create its timetable.
                Each subject template has its own separate timetable for this class-section.
              </Text>
            </Alert>
          )}

          {/* Show timetable content when template is selected */}
          {selectedTemplateId && classId && (
            <>
              {/* Show error if timetable query failed */}
              {timetableError && (
                <Alert color={colors.error} title="Error Loading Timetable">
                  <Text size="sm">
                    {timetableError instanceof Error
                      ? timetableError.message
                      : 'Failed to load timetable'}
                  </Text>
                </Alert>
              )}

              {/* Show loading state for timetable */}
              {timetableLoading && (
                <Skeleton height={400} />
              )}

              {/* Show conflicts if any */}
              {!timetableLoading && conflicts.length > 0 && (
                <Paper p="md" withBorder>
                  <ConflictList conflicts={conflicts} />
                </Paper>
              )}

              {/* Show timetable grid when data is available */}
              {!timetableLoading && timetable && (
                <>
                  <TimetableGrid
                    classSectionId={classSectionId}
                    slots={timetable.slots}
                    onSlotClick={handleSlotClick}
                    templateInfo={templateInfoData || null}
                    conflicts={conflicts}
                    isLoading={false}
                  />

                  {timetable.slots.length === 0 && (
                    <Alert color={colors.info} title="No Timetable Slots">
                      <Text size="sm">
                        No timetable slots have been created for this template yet. Click on empty cells to create slots, or
                        use the "Generate from Template" button to create slots from the timing template.
                      </Text>
                    </Alert>
                  )}
                </>
              )}

              {/* Show message if timetable data is null (but not loading) */}
              {!timetableLoading && !timetable && !timetableError && (
                <Alert color={colors.info} title="No Timetable Data">
                  <Text size="sm">
                    Timetable data is not available. Try refreshing the page or generating a new timetable.
                  </Text>
                </Alert>
              )}
            </>
          )}
        </Stack>
      </div>

      <SlotEditPopover
        opened={popoverOpened}
        onClose={() => {
          closePopover();
          setSelectedSlot(null);
          setSelectedDay(null);
          setSelectedTimeRange('');
          setPopoverTarget(null);
        }}
        target={popoverTarget}
        slot={selectedSlot}
        classSectionId={classSectionId}
        dayOfWeek={selectedDay ?? 0}
        timeRange={selectedTimeRange}
        subjectTemplateId={selectedTemplateId ?? undefined}
        onConflictCheck={handleConflictCheck}
      />
    </>
  );
}
