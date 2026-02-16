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
import { IconArrowLeft, IconPlus, IconCopy, IconAlertTriangle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useClassSection } from '@/hooks/useClassSections';
import type { ClassSection } from '@/types/class-sections';
import { useClassTimetable, useConflicts, useGenerateTimetable, useCheckSlotConflict, useTimingTemplateInfo, useReplicateDay } from '@/hooks/useTimetable';
import { useTemplatesForClass } from '@/hooks/useSubjectTemplates';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { TimetableGrid } from '@/components/features/timetable/TimetableGrid';
import { SlotEditPopover } from '@/components/features/timetable/SlotEditPopover';
import { ConflictList } from '@/components/features/timetable/ConflictList';
import { TemplateInfoBanner } from '@/components/features/timetable/TemplateInfoBanner';
import { useDisclosure } from '@mantine/hooks';
import { Select, Paper as MantinePaper, Modal, MultiSelect } from '@mantine/core';
import { useSchoolDays } from '@/hooks/useScheduleSettings';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
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
  const replicateDayMutation = useReplicateDay();
  const { data: schoolDaysData } = useSchoolDays();
  const { data: activeYear } = useActiveAcademicYear();
  const [replicateModalOpened, { open: openReplicateModal, close: closeReplicateModal }] = useDisclosure(false);
  const [generateModalOpened, { open: openGenerateModal, close: closeGenerateModal }] = useDisclosure(false);
  const [sourceDay, setSourceDay] = useState<number | null>(null);
  const [targetDays, setTargetDays] = useState<number[]>([]);
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
    closeGenerateModal();
  };

  const activeSchoolDays = schoolDaysData?.data || [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOptions = activeSchoolDays.map((d) => ({
    value: String(d),
    label: dayNames[d] || `Day ${d}`,
  }));

  const handleReplicateDay = async () => {
    if (!classSectionId || !sourceDay || targetDays.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please select source day and at least one target day',
        color: colors.error,
      });
      return;
    }
    if (!selectedTemplateId) {
      notifications.show({
        title: 'Error',
        message: 'Please select a subject template first',
        color: colors.error,
      });
      return;
    }

    // Show confirmation modal
    const sourceDayName = dayNames[sourceDay] || `Day ${sourceDay}`;
    const targetDayNames = targetDays.map((d) => dayNames[d] || `Day ${d}`).join(', ');

    modals.openConfirmModal({
      title: 'Confirm Day Replication',
      children: (
        <Text size="sm">
          This action will replace all timetable slots on the selected target day(s) ({targetDayNames}) that match the time ranges from the source day ({sourceDayName}). Any existing slots with matching times will be overwritten, while slots with different time ranges will remain unchanged.
          <br />
          <br />
          Are you sure you want to proceed?
        </Text>
      ),
      labels: { confirm: 'Replicate', cancel: 'Cancel' },
      confirmProps: { color: 'blue' },
      onConfirm: () => {
        // Use mutate instead of mutateAsync to avoid blocking the modal
        replicateDayMutation.mutate(
          {
            classSectionId,
            sourceDayOfWeek: sourceDay,
            targetDaysOfWeek: targetDays,
            academicYearId: activeYear?.data?.id,
            subjectTemplateId: selectedTemplateId,
          },
          {
            onSuccess: () => {
              closeReplicateModal();
              setSourceDay(null);
              setTargetDays([]);
            },
          },
        );
      },
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
              leftSection={<IconCopy size={18} />}
              onClick={openReplicateModal}
              disabled={!selectedTemplateId || !classId || !timetable || timetable.slots.length === 0}
              variant="light"
            >
              Replicate Day
            </Button>
            <Button
              leftSection={<IconPlus size={18} />}
              onClick={openGenerateModal}
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

      <Modal
        opened={generateModalOpened}
        onClose={closeGenerateModal}
        title="Generate from Timing Template"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            This will create timetable slots from the <strong>timing template</strong> assigned to this class (configured in Settings → Schedule / Timing template). That template defines the structure of each day (e.g. periods, break, assembly).
          </Text>
          <Text size="sm">
            For the <strong>currently selected subject template</strong>, one slot will be created for each timing slot (period, break, assembly, etc.) on every active school day. Class periods will start as empty placeholders; you can then assign subjects and teachers to them.
          </Text>
          {timetable?.slots?.length ? (
            <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light" title="Warning">
              <Text size="sm">
                Any existing timetable slots for this class and subject template that match the same day and time will be <strong>replaced</strong>. If you have already assigned subjects or teachers, they will be overwritten by empty slots (you can reassign them afterwards).
              </Text>
            </Alert>
          ) : null}
          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" onClick={closeGenerateModal}>
              Cancel
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => handleGenerate()}
              loading={generateMutation.isPending}
            >
              Generate
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={replicateModalOpened}
        onClose={closeReplicateModal}
        title="Replicate Day to Other Days"
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Source Day (Day to copy from)"
            placeholder="Select a day"
            data={dayOptions}
            value={sourceDay !== null ? String(sourceDay) : null}
            onChange={(value) => setSourceDay(value ? Number(value) : null)}
            required
          />
          <MultiSelect
            label="Target Days (Days to copy to)"
            placeholder="Select one or more days"
            data={dayOptions.filter((d) => d.value !== String(sourceDay))}
            value={targetDays.map(String)}
            onChange={(values) => setTargetDays(values.map(Number))}
            required
          />
          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" onClick={closeReplicateModal}>
              Cancel
            </Button>
            <Button
              onClick={handleReplicateDay}
              loading={replicateDayMutation.isPending}
              disabled={!sourceDay || targetDays.length === 0}
            >
              Replicate
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
