'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Text,
  Stack,
  Skeleton,
  Group,
  Button,
  Alert,
  Alert as MantineAlert,
} from '@mantine/core';
import { IconArrowLeft, IconPlus, IconCopy, IconCopyCheck, IconCopyOff } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useClassSection, useClassSections } from '@/hooks/useClassSections';
import type { ClassSection } from '@/types/class-sections';
import {
  useClassTimetable,
  useGenerateTimetable,
  useCheckSlotConflict,
  useTimingTemplateInfo,
  useReplicateDay,
  useReplicateAcrossSections,
  useReplicateFromSection,
} from '@/hooks/useTimetable';
import { useQueries } from '@tanstack/react-query';
import { useTemplatesForClass } from '@/hooks/useSubjectTemplates';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { TimetableGrid } from '@/components/features/timetable/TimetableGrid';
import { SlotEditPopover } from '@/components/features/timetable/SlotEditPopover';
import { TemplateInfoBanner } from '@/components/features/timetable/TemplateInfoBanner';
import { useDisclosure } from '@mantine/hooks';
import { Select, Modal, MultiSelect } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useSchoolDays } from '@/hooks/useScheduleSettings';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useAuth } from '@/hooks/useAuth';
import type { TimetableSlot, CreateTimetableSlotInput, ClassTimetable } from '@/types/timetable';
import { apiClient } from '@/lib/api-client';
import { TemplateSwitcher } from '@/components/features/timetable/TemplateSwitcher';

interface ClassTimetableContentProps {
  classSectionId: string | null;
  showHeaderActions?: boolean;
}

/**
 * Class timetable content: template switcher, grid, modals, etc.
 * Used on the main Timetable page (embedded) and on /timetable/class/[classSectionId] (standalone).
 */
export function ClassTimetableContent({
  classSectionId,
  showHeaderActions = false,
}: ClassTimetableContentProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('');
  const [popoverTarget, setPopoverTarget] = useState<HTMLElement | null>(null);
  const [popoverOpened, { open: openPopover, close: closePopover }] = useDisclosure(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  const { data: classSectionData, isLoading: classSectionLoading, error: classSectionError } =
    useClassSection(classSectionId ?? '');
  const classSection = classSectionData as ClassSection | null | undefined;
  const classId = classSection?.classId ?? null;

  const { data: templatesData, isLoading: templatesLoading } = useTemplatesForClass(
    classId,
    branchId ?? null,
  );
  const { data: timetableData, isLoading: timetableLoading, error: timetableError } =
    useClassTimetable(classSectionId ?? '', undefined, selectedTemplateId ?? undefined);
  const { data: templateInfoData } = useTimingTemplateInfo(classSectionId ?? '');
  const generateMutation = useGenerateTimetable();
  const checkConflict = useCheckSlotConflict();
  const replicateDayMutation = useReplicateDay();
  const replicateAcrossSectionsMutation = useReplicateAcrossSections();
  const replicateFromSectionMutation = useReplicateFromSection();
  const { data: schoolDaysData } = useSchoolDays();
  const { data: activeYear } = useActiveAcademicYear();
  const [replicateModalOpened, { open: openReplicateModal, close: closeReplicateModal }] =
    useDisclosure(false);
  const [
    replicateAcrossSectionsModalOpened,
    { open: openReplicateAcrossSectionsModal, close: closeReplicateAcrossSectionsModal },
  ] = useDisclosure(false);
  const [
    replicateFromSectionModalOpened,
    { open: openReplicateFromSectionModal, close: closeReplicateFromSectionModal },
  ] = useDisclosure(false);
  const [generateModalOpened, { open: openGenerateModal, close: closeGenerateModal }] =
    useDisclosure(false);
  const [sourceDay, setSourceDay] = useState<number | null>(null);
  const [targetDays, setTargetDays] = useState<number[]>([]);
  const [targetSectionIds, setTargetSectionIds] = useState<string[]>([]);
  const [sourceSectionId, setSourceSectionId] = useState<string | null>(null);
  const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(null);

  // Fetch all class sections with the same classId (excluding current) for replicate to other sections
  const { data: allClassSectionsData } = useClassSections({
    classId: classId ?? undefined,
    isActive: true,
    minimal: true,
  });
  const allClassSections = allClassSectionsData?.data ?? [];
  const otherSections = allClassSections.filter((cs) => cs.id !== classSectionId);

  // Fetch all active class sections for copying from other sections
  const { data: allActiveSectionsData } = useClassSections({
    isActive: true,
    minimal: true,
  });
  const allActiveSections = allActiveSectionsData?.data ?? [];
  const candidateSourceSections = allActiveSections.filter((cs) => cs.id !== classSectionId);

  // Fetch timetables for all candidate sections in parallel to check if they have slots
  const sourceTimetableQueries = useQueries({
    queries: candidateSourceSections.map((section) => ({
      queryKey: ['timetable', 'class', section.id, undefined, undefined, branchId],
      queryFn: async () => {
        if (!section.id || !branchId) return null;
        const response = await apiClient.get<ClassTimetable>(
          `/api/v1/timetable/class/${section.id}`,
        );
        return response;
      },
      enabled: !!section.id && !!branchId,
      staleTime: 2 * 60 * 1000,
    })),
  });

  // Filter sections that have at least one slot
  const availableSourceSections = useMemo(() => {
    return candidateSourceSections.filter((cs, index) => {
      const queryResult = sourceTimetableQueries[index];
      return queryResult?.data?.data?.slots && queryResult.data.data.slots.length > 0;
    });
  }, [candidateSourceSections, sourceTimetableQueries]);

  // Get the selected source section to fetch its class templates
  const selectedSourceSection = availableSourceSections.find((cs) => cs.id === sourceSectionId);
  const sourceClassId = selectedSourceSection?.classId ?? null;

  // Fetch templates for the source section's class
  const { data: sourceTemplatesData, isLoading: sourceTemplatesLoading } = useTemplatesForClass(
    sourceClassId,
    branchId ?? null,
  );
  const sourceTemplates = sourceTemplatesData?.data ?? [];

  // Auto-select first template if available and none selected
  useEffect(() => {
    if (sourceSectionId && sourceTemplates.length > 0 && !sourceTemplateId) {
      setSourceTemplateId(sourceTemplates[0].id);
    } else if (!sourceSectionId || sourceTemplates.length === 0) {
      setSourceTemplateId(null);
    }
  }, [sourceSectionId, sourceTemplates, sourceTemplateId]);
  const timetable = timetableData?.data;
  const availableTemplates = templatesData?.data ?? [];

  // Auto-select first template if available, but don't require it
  useEffect(() => {
    if (!selectedTemplateId && availableTemplates.length > 0) {
      setSelectedTemplateId(availableTemplates[0].id);
    }
  }, [availableTemplates, selectedTemplateId]);

  const handleSlotClick = (
    slot: TimetableSlot | null,
    day: number,
    timeRange: string,
    target: HTMLElement,
  ) => {
    setSelectedSlot(slot);
    setSelectedDay(day);
    setSelectedTimeRange(timeRange);
    setPopoverTarget(target);
    openPopover();
  };

  const handleConflictCheck = async (slotInput: Partial<CreateTimetableSlotInput>): Promise<boolean> => {
    return await checkConflict({
      ...slotInput,
      classSectionId: classSectionId ?? '',
      dayOfWeek: selectedDay ?? 0,
    });
  };

  const handleGenerate = async () => {
    if (!classSectionId) return;
    // Note: subjectTemplateId is optional - if not provided, generates slots without template filter
    await generateMutation.mutateAsync({
      classSectionId,
      subjectTemplateId: selectedTemplateId ?? undefined,
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
    // Note: subjectTemplateId is optional - if not provided, replicates all slots regardless of template

    const sourceDayName = dayNames[sourceDay] || `Day ${sourceDay}`;
    const targetDayNames = targetDays.map((d) => dayNames[d] || `Day ${d}`).join(', ');

    modals.openConfirmModal({
      title: 'Confirm Day Replication',
      children: (
        <Text size="sm">
          This action will replace all timetable slots on the selected target day(s) ({targetDayNames})
          that match the time ranges from the source day ({sourceDayName}). Any existing slots with
          matching times will be overwritten, while slots with different time ranges will remain
          unchanged.
          <br />
          <br />
          Are you sure you want to proceed?
        </Text>
      ),
      labels: { confirm: 'Replicate', cancel: 'Cancel' },
      confirmProps: { color: colors.primary },
      onConfirm: () => {
        replicateDayMutation.mutate(
          {
            classSectionId,
            sourceDayOfWeek: sourceDay,
            targetDaysOfWeek: targetDays,
            academicYearId: activeYear?.data?.id,
            subjectTemplateId: selectedTemplateId ?? undefined,
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

  const handleReplicateAcrossSections = async () => {
    if (!classSectionId || targetSectionIds.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please select at least one target section',
        color: colors.error,
      });
      return;
    }

    const sourceSectionName = classSection
      ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
      : 'this section';
    const targetSectionNames = otherSections
      .filter((cs) => targetSectionIds.includes(cs.id))
      .map((cs) => `${cs.classDisplayName || cs.className || 'Unknown'} - ${cs.sectionName || 'Unknown'}`)
      .join(', ');

    modals.openConfirmModal({
      title: 'Confirm Replication Across Sections',
      children: (
        <Stack gap="md">
          <Text size="sm">
            This will copy all timetable slots from <strong>{sourceSectionName}</strong>
            {selectedTemplateId ? ' (for the currently selected subject template)' : ' (all slots)'} to the following section(s):{' '}
            <strong>{targetSectionNames}</strong>.
          </Text>
          <MantineAlert
            icon={<IconAlertTriangle size={16} />}
            color="yellow"
            variant="light"
            title="Warning"
          >
            <Text size="sm">
              Any existing timetable slots in the target sections that match the same day, time
              range{selectedTemplateId ? ', and subject template' : ''} will be <strong>replaced</strong>. If you have already
              assigned subjects or teachers to those slots, they will be overwritten.
            </Text>
          </MantineAlert>
          <Text size="sm">
            Are you sure you want to proceed?
          </Text>
        </Stack>
      ),
      labels: { confirm: 'Replicate', cancel: 'Cancel' },
      confirmProps: { color: colors.primary },
      onConfirm: () => {
        replicateAcrossSectionsMutation.mutate(
          {
            sourceClassSectionId: classSectionId,
            targetClassSectionIds: targetSectionIds,
            academicYearId: activeYear?.data?.id,
            subjectTemplateId: selectedTemplateId ?? undefined,
          },
          {
            onSuccess: () => {
              closeReplicateAcrossSectionsModal();
              setTargetSectionIds([]);
            },
          },
        );
      },
    });
  };

  const handleReplicateFromSection = async () => {
    if (!classSectionId || !sourceSectionId) {
      notifications.show({
        title: 'Error',
        message: 'Please select a source class section',
        color: colors.error,
      });
      return;
    }

    const sourceSection = availableSourceSections.find((cs) => cs.id === sourceSectionId);
    const sourceSectionName = sourceSection
      ? `${sourceSection.classDisplayName || sourceSection.className || 'Unknown'} - ${sourceSection.sectionName || 'Unknown'}`
      : 'selected section';
    const targetSectionName = classSection
      ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
      : 'this section';

    // Use sourceTemplateId if source has templates and one is selected, otherwise use null (copy all)
    // Only use selectedTemplateId if source has no templates at all
    const effectiveTemplateId = sourceTemplates.length > 0 
      ? sourceTemplateId 
      : null; // If source has no templates, copy all slots regardless of target's template
    const templateName = effectiveTemplateId
      ? sourceTemplates.find((t) => t.id === effectiveTemplateId)?.name || 'selected template'
      : null;

    modals.openConfirmModal({
      title: 'Confirm Copy from Section',
      children: (
        <Stack gap="md">
          <Text size="sm">
            This will copy all timetable slots from <strong>{sourceSectionName}</strong>
            {effectiveTemplateId ? ` (for subject template: ${templateName})` : ' (all slots)'} to{' '}
            <strong>{targetSectionName}</strong>.
          </Text>
          <MantineAlert
            icon={<IconAlertTriangle size={16} />}
            color="yellow"
            variant="light"
            title="Warning"
          >
            <Text size="sm">
              Any existing timetable slots in <strong>{targetSectionName}</strong> that match the same day, time
              range{effectiveTemplateId ? ', and subject template' : ''} will be <strong>replaced</strong>. If you have already
              assigned subjects or teachers to those slots, they will be overwritten.
            </Text>
          </MantineAlert>
          <Text size="sm">
            Are you sure you want to proceed?
          </Text>
        </Stack>
      ),
      labels: { confirm: 'Copy', cancel: 'Cancel' },
      confirmProps: { color: colors.primary },
      onConfirm: () => {
        replicateFromSectionMutation.mutate(
          {
            targetClassSectionId: classSectionId,
            sourceClassSectionId: sourceSectionId,
            academicYearId: activeYear?.data?.id,
            subjectTemplateId: effectiveTemplateId ?? undefined,
          },
          {
            onSuccess: () => {
              closeReplicateFromSectionModal();
              setSourceSectionId(null);
              setSourceTemplateId(null);
            },
          },
        );
      },
    });
  };

  if (!classSectionId) {
    return (
      <Alert color={colors.primary}>
        Select a class section to view its timetable.
      </Alert>
    );
  }

  if (classSectionLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={400} />
      </Stack>
    );
  }

  if (classSectionError || !classSection) {
    return (
      <Alert color={colors.error} title="Error">
        <Text size="sm">
          {classSectionError instanceof Error
            ? classSectionError.message
            : 'Class section not found'}
        </Text>
      </Alert>
    );
  }

  return (
    <>
      {showHeaderActions && (
        <Group mb="md" justify="space-between">
          {classId && availableTemplates.length > 0 && (
            <TemplateSwitcher
              templates={availableTemplates}
              selectedTemplateId={selectedTemplateId}
              onTemplateChange={setSelectedTemplateId}
              isLoading={templatesLoading || classSectionLoading}
            />
          )}
          <Group>
            <Button
              leftSection={<IconCopy size={18} />}
              onClick={openReplicateModal}
              disabled={!classId || !timetable || timetable.slots.length === 0}
              variant="light"
            >
              Replicate Day
            </Button>
            <Button
              leftSection={<IconCopyCheck size={18} />}
              onClick={openReplicateAcrossSectionsModal}
              disabled={
                !classId ||
                !timetable ||
                timetable.slots.length === 0 ||
                otherSections.length === 0
              }
              variant="light"
            >
              Replicate to other sections
            </Button>
            <Button
              leftSection={<IconCopyOff size={18} />}
              onClick={openReplicateFromSectionModal}
              disabled={!classId || availableSourceSections.length === 0}
              variant="light"
            >
              Copy from other section
            </Button>
            <Button
              leftSection={<IconPlus size={18} />}
              onClick={openGenerateModal}
              disabled={!classId}
            >
              Generate from Template
            </Button>
          </Group>
        </Group>
      )}

      <Stack gap="md">
        <TemplateInfoBanner templateInfo={templateInfoData || null} />

        {classId && templatesLoading && <Skeleton height={36} />}

        {!templatesLoading && classId && availableTemplates.length === 0 && (
          <Alert color={colors.info} title="No Subject Templates Assigned">
            <Text size="sm">
              This class is not assigned to any subject template. You can assign any subject to timetable slots.
              {classId && (
                <>
                  {' '}To create subject templates, go to{' '}
                  <Text
                    component="span"
                    fw={500}
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => router.push('/settings/subject-templates')}
                  >
                    Settings → Subject Templates
                  </Text>
                  .
                </>
              )}
            </Text>
          </Alert>
        )}

        {!showHeaderActions && classId && (
          <Group justify="space-between">
            {availableTemplates.length > 0 && (
              <TemplateSwitcher
                templates={availableTemplates}
                selectedTemplateId={selectedTemplateId}
                onTemplateChange={setSelectedTemplateId}
                isLoading={templatesLoading || classSectionLoading}
              />
            )}
            <Group>
              <Button
                leftSection={<IconCopy size={18} />}
                onClick={openReplicateModal}
                disabled={!classId || !timetable || timetable.slots.length === 0}
                variant="light"
              >
                Replicate Day
              </Button>
              <Button
                leftSection={<IconCopyCheck size={18} />}
                onClick={openReplicateAcrossSectionsModal}
                disabled={
                  !classId ||
                  !timetable ||
                  timetable.slots.length === 0 ||
                  otherSections.length === 0
                }
                variant="light"
              >
                Replicate to other sections
              </Button>
              <Button
                leftSection={<IconCopyOff size={18} />}
                onClick={openReplicateFromSectionModal}
                disabled={!classId || availableSourceSections.length === 0}
                variant="light"
              >
                Copy from other section
              </Button>
              <Button
                leftSection={<IconPlus size={18} />}
                onClick={openGenerateModal}
                disabled={!classId}
              >
                Generate from Template
              </Button>
            </Group>
          </Group>
        )}

        {classId && (
          <>
            {timetableError && (
              <Alert color={colors.error} title="Error Loading Timetable">
                <Text size="sm">
                  {timetableError instanceof Error
                    ? timetableError.message
                    : 'Failed to load timetable'}
                </Text>
              </Alert>
            )}

            {timetableLoading && <Skeleton height={400} />}

            {!timetableLoading && timetable && (
              <>
                <TimetableGrid
                  classSectionId={classSectionId}
                  slots={timetable.slots}
                  onSlotClick={handleSlotClick}
                  templateInfo={templateInfoData || null}
                  isLoading={false}
                />

                {timetable.slots.length === 0 && (
                  <Alert color={colors.info} title="No Timetable Slots">
                    <Text size="sm">
                      No timetable slots have been created for this template yet. Click on empty
                      cells to create slots, or use the "Generate from Template" button to create
                      slots from the timing template.
                    </Text>
                  </Alert>
                )}
              </>
            )}

            {!timetableLoading && !timetable && !timetableError && (
              <Alert color={colors.info} title="No Timetable Data">
                <Text size="sm">
                  Timetable data is not available. Try refreshing the page or generating a new
                  timetable.
                </Text>
              </Alert>
            )}
          </>
        )}
      </Stack>

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
        classSectionId={classSectionId ?? ''}
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
            This will create timetable slots from the <strong>timing template</strong> assigned to
            this class (configured in Settings → Schedule / Timing template). That template defines
            the structure of each day (e.g. periods, break, assembly).
          </Text>
          <Text size="sm">
            {selectedTemplateId ? (
              <>
                For the <strong>currently selected subject template</strong>, one slot will be created
                for each timing slot (period, break, assembly, etc.) on every active school day. Class
                periods will start as empty placeholders; you can then assign subjects and teachers to
                them.
              </>
            ) : (
              <>
                One slot will be created for each timing slot (period, break, assembly, etc.) on every active school day.
                Class periods will start as empty placeholders; you can then assign any subject and teachers to
                them.
              </>
            )}
          </Text>
          {timetable?.slots?.length ? (
            <Alert color="yellow" variant="light" title="Warning">
              <Text size="sm">
                Any existing timetable slots for this class{selectedTemplateId ? ' and subject template' : ''} that match the
                same day and time will be <strong>replaced</strong>. If you have already assigned
                subjects or teachers, they will be overwritten by empty slots (you can reassign them
                afterwards).
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

      <Modal
        opened={replicateFromSectionModalOpened}
        onClose={() => {
          closeReplicateFromSectionModal();
          setSourceSectionId(null);
          setSourceTemplateId(null);
        }}
        title="Copy from Other Section"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Select a class section to copy the timetable from. The timetable will be copied to{' '}
            <strong>
              {classSection
                ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
                : 'this section'}
            </strong>
            .
          </Text>
          {availableSourceSections.length === 0 ? (
            <Alert color={colors.info}>
              <Text size="sm">
                {candidateSourceSections.length === 0
                  ? 'No other class sections found. All active class sections will appear here.'
                  : 'No class sections with timetable slots found. Only sections that have at least one timetable slot can be used as a source.'}
              </Text>
            </Alert>
          ) : (
            <>
              <Select
                label="Source Section"
                placeholder="Select a class section to copy from"
                data={availableSourceSections.map((cs) => ({
                  value: cs.id,
                  label: `${cs.classDisplayName || cs.className || 'Unknown'} - ${cs.sectionName || 'Unknown'}`,
                }))}
                value={sourceSectionId}
                onChange={(value) => {
                  setSourceSectionId(value);
                  setSourceTemplateId(null); // Reset template when section changes
                }}
                searchable
                required
              />
              {sourceSectionId && sourceTemplatesLoading && (
                <Skeleton height={36} />
              )}
              {sourceSectionId && !sourceTemplatesLoading && sourceTemplates.length > 0 && (
                <Select
                  label="Subject Template (Optional)"
                  placeholder="Select a subject template to copy"
                  description="If a template is selected, only slots for that template will be copied. Leave empty to copy all slots."
                  data={sourceTemplates.map((t) => ({
                    value: t.id,
                    label: t.name,
                  }))}
                  value={sourceTemplateId}
                  onChange={(value) => setSourceTemplateId(value)}
                  clearable
                  searchable
                />
              )}
              {sourceSectionId && !sourceTemplatesLoading && sourceTemplates.length === 0 && (
                <Alert color={colors.info} variant="light">
                  <Text size="sm">
                    The selected source section's class has no subject templates assigned. All timetable slots will be copied.
                  </Text>
                </Alert>
              )}
              <MantineAlert
                icon={<IconAlertTriangle size={16} />}
                color="yellow"
                variant="light"
                title="Warning"
              >
                <Text size="sm">
                  Any existing timetable slots in <strong>
                    {classSection
                      ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
                      : 'this section'}
                  </strong> that match the same day, time
                  range{sourceTemplateId ? ', and subject template' : ''} will be <strong>replaced</strong>. If you have already
                  assigned subjects or teachers to those slots, they will be overwritten.
                </Text>
              </MantineAlert>
            </>
          )}
          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" onClick={closeReplicateFromSectionModal}>
              Cancel
            </Button>
            <Button
              onClick={handleReplicateFromSection}
              loading={replicateFromSectionMutation.isPending}
              disabled={!sourceSectionId || availableSourceSections.length === 0}
            >
              Copy
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={replicateAcrossSectionsModalOpened}
        onClose={closeReplicateAcrossSectionsModal}
        title="Replicate to Other Sections"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Select the class sections to copy the timetable to. The timetable from{' '}
            <strong>
              {classSection
                ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
                : 'this section'}
            </strong>{' '}
            {selectedTemplateId ? '(for the currently selected subject template)' : '(all slots)'} will be replicated to the selected sections.
          </Text>
          {otherSections.length === 0 ? (
            <Alert color={colors.info}>
              <Text size="sm">
                No other sections found for this class. All sections of the same class will appear
                here.
              </Text>
            </Alert>
          ) : (
            <>
              <MultiSelect
                label="Target Sections"
                placeholder="Select one or more sections"
                data={otherSections.map((cs) => ({
                  value: cs.id,
                  label: `${cs.classDisplayName || cs.className || 'Unknown'} - ${cs.sectionName || 'Unknown'}`,
                }))}
                value={targetSectionIds}
                onChange={setTargetSectionIds}
                searchable
                required
              />
              <MantineAlert
                icon={<IconAlertTriangle size={16} />}
                color="yellow"
                variant="light"
                title="Warning"
              >
                <Text size="sm">
                  Any existing timetable slots in the target sections that match the same day, time
                  range{selectedTemplateId ? ', and subject template' : ''} will be <strong>replaced</strong>. If you have already
                  assigned subjects or teachers to those slots, they will be overwritten.
                </Text>
              </MantineAlert>
            </>
          )}
          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" onClick={closeReplicateAcrossSectionsModal}>
              Cancel
            </Button>
            <Button
              onClick={handleReplicateAcrossSections}
              loading={replicateAcrossSectionsMutation.isPending}
              disabled={targetSectionIds.length === 0 || otherSections.length === 0}
            >
              Replicate
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
