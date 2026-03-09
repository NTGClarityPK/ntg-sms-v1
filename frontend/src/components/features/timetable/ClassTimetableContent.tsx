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
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useClassSection, useClassSections } from '@/hooks/useClassSections';
import type { ClassSection } from '@/types/class-sections';
import {
  useClassTimetable,
  useClassTimetablesBatch,
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
  const t = useTranslations('timetable');
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
  const availableTemplates = templatesData?.data ?? [];

  // When templates load for the first time and no template is chosen yet,
  // automatically select the first template as the default.
  useEffect(() => {
    if (!templatesLoading && !selectedTemplateId && availableTemplates.length > 0) {
      setSelectedTemplateId(availableTemplates[0].id);
    }
  }, [templatesLoading, selectedTemplateId, availableTemplates]);

  // Only enable timetable query once we know which template to use.
  const timetableEnabled =
    !!classSectionId && !!branchId && !!selectedTemplateId;

  const {
    data: timetableData,
    isLoading: timetableLoading,
    error: timetableError,
    isFetched: timetableFetched,
  } =
    useClassTimetable(
      classSectionId ?? '',
      undefined,
      selectedTemplateId ?? undefined,
      { enabled: timetableEnabled },
    );
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

  // Fetch all class sections with the same classId (excluding current) for replicate to other sections.
  // Pass academicYearId so backend skips getActiveForBranch and responds faster.
  const { data: allClassSectionsData } = useClassSections({
    classId: classId ?? undefined,
    isActive: true,
    minimal: true,
    academicYearId: activeYear?.data?.id,
  });
  const allClassSections = allClassSectionsData?.data ?? [];
  const otherSections = allClassSections
    .filter((cs) => cs.id !== classSectionId)
    .sort((a, b) => {
      // Sort by class sort order first, then by section sort order
      const classOrderA = a.classSortOrder ?? 999;
      const classOrderB = b.classSortOrder ?? 999;
      if (classOrderA !== classOrderB) {
        return classOrderA - classOrderB;
      }
      const sectionOrderA = a.sectionSortOrder ?? 999;
      const sectionOrderB = b.sectionSortOrder ?? 999;
      return sectionOrderA - sectionOrderB;
    });

  // Fetch all active class sections for copying from other sections
  const { data: allActiveSectionsData } = useClassSections({
    isActive: true,
    minimal: true,
  });
  const allActiveSections = allActiveSectionsData?.data ?? [];
  const candidateSourceSections = allActiveSections.filter((cs) => cs.id !== classSectionId);

  // Fetch timetables for all candidate sections in a single batch call,
  // only when the "Copy from other section" modal is open.
  const candidateSourceSectionIds = candidateSourceSections
    .map((cs) => cs.id)
    .filter((id): id is string => !!id);

  const batchTimetablesResponse = useClassTimetablesBatch(
    replicateFromSectionModalOpened ? candidateSourceSectionIds : [],
  );
  const batchTimetables = batchTimetablesResponse.data?.data ?? [];

  const timetablesBySectionId = useMemo(() => {
    const map = new Map<string, ClassTimetable>();
    batchTimetables.forEach((tt) => {
      map.set(tt.classSectionId, tt);
    });
    return map;
  }, [batchTimetables]);

  // Filter sections that have at least one slot and sort by class/section sort order
  const availableSourceSections = useMemo(() => {
    return candidateSourceSections
      .filter((cs) => {
        const timetable = timetablesBySectionId.get(cs.id);
        return timetable && Array.isArray(timetable.slots) && timetable.slots.length > 0;
      })
      .sort((a, b) => {
        // Sort by class sort order first, then by section sort order
        const classOrderA = a.classSortOrder ?? 999;
        const classOrderB = b.classSortOrder ?? 999;
        if (classOrderA !== classOrderB) {
          return classOrderA - classOrderB;
        }
        const sectionOrderA = a.sectionSortOrder ?? 999;
        const sectionOrderB = b.sectionSortOrder ?? 999;
        return sectionOrderA - sectionOrderB;
      });
  }, [candidateSourceSections, timetablesBySectionId]);

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
        title: t('error'),
        message: t('pleaseSelectSourceAndTarget'),
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
        title: t('error'),
        message: t('pleaseSelectTargetSection'),
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
      title: t('confirmReplicationAcrossSections'),
      children: (
        <Stack gap="md">
          <Text size="sm">
            {t('confirmReplicationAcrossMessage', {
              sourceSectionName,
              targetSectionNames,
            })}
          </Text>
          <MantineAlert
            icon={<IconAlertTriangle size={16} />}
            color="yellow"
            variant="light"
            title={t('warning')}
          >
            <Text size="sm">
              {t('confirmReplicationAcrossMessage', {
                sourceSectionName,
                targetSectionNames,
              })}
            </Text>
          </MantineAlert>
          <Text size="sm">{t('areYouSureProceed')}</Text>
        </Stack>
      ),
      labels: { confirm: t('replicate'), cancel: t('cancel') },
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
        title: t('error'),
        message: t('pleaseSelectSourceSection'),
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
      title: t('confirmCopyFromSection'),
      children: (
        <Stack gap="md">
          <Text size="sm">
            {t('confirmCopyFromSectionMessage', {
              sourceSectionName,
              targetSectionName,
            })}
          </Text>
          <MantineAlert
            icon={<IconAlertTriangle size={16} />}
            color="yellow"
            variant="light"
            title={t('warning')}
          >
            <Text size="sm">
              {t('confirmCopyFromSectionMessage', {
                sourceSectionName,
                targetSectionName,
              })}
            </Text>
          </MantineAlert>
          <Text size="sm">{t('areYouSureProceed')}</Text>
        </Stack>
      ),
      labels: { confirm: t('copy'), cancel: t('cancel') },
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
              {t('replicateDay')}
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
              {t('replicateToOtherSections')}
            </Button>
            <Button
              leftSection={<IconCopyOff size={18} />}
              onClick={openReplicateFromSectionModal}
              disabled={!classId || availableSourceSections.length === 0}
              variant="light"
            >
              {t('copyFromOtherSection')}
            </Button>
            <Button
              leftSection={<IconPlus size={18} />}
              onClick={openGenerateModal}
              disabled={!classId}
            >
              {t('generateFromTemplate')}
            </Button>
          </Group>
        </Group>
      )}

      <Stack gap="md">
        <TemplateInfoBanner templateInfo={templateInfoData || null} />

        {classId && templatesLoading && <Skeleton height={36} />}

        {!templatesLoading && classId && availableTemplates.length === 0 && (
          <Alert color={colors.info} title={t('noSubjectTemplatesAssigned')}>
            <Text size="sm">
              {t('noSubjectTemplatesMessage')}
              {classId && (
                <>
                  {' '}
                  {t('toCreateTemplates')}{' '}
                  <Text
                    component="span"
                    fw={500}
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => router.push('/settings/subject-templates')}
                  >
                    {t('settingsSubjectTemplates')}
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
                {t('replicateDay')}
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
                {t('replicateToOtherSections')}
              </Button>
              <Button
                leftSection={<IconCopyOff size={18} />}
                onClick={openReplicateFromSectionModal}
                disabled={!classId || availableSourceSections.length === 0}
                variant="light"
              >
                {t('copyFromOtherSection')}
              </Button>
              <Button
                leftSection={<IconPlus size={18} />}
                onClick={openGenerateModal}
                disabled={!classId}
              >
                {t('generateFromTemplate')}
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
                  <Alert color={colors.info} title={t('noTimetableSlots')}>
                    <Text size="sm">{t('noSlotsClickOrGenerate')}</Text>
                  </Alert>
                )}
              </>
            )}

            {!timetableLoading && timetableFetched && !timetable && !timetableError && (
              <Alert color={colors.info} title={t('noTimetableData')}>
                <Text size="sm">{t('noTimetableDataMessage')}</Text>
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
        title={t('generateModalTitle')}
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('generateModalDescription')}
          </Text>
          {timetable?.slots?.length ? (
            <Alert color="yellow" variant="light" title={t('warning')}>
              <Text size="sm">{t('generateModalWarning')}</Text>
            </Alert>
          ) : null}
          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" onClick={closeGenerateModal}>
              {t('cancel')}
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => handleGenerate()}
              loading={generateMutation.isPending}
            >
              {t('generate')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={replicateModalOpened}
        onClose={closeReplicateModal}
        title={t('replicateDayModalTitle')}
        size="md"
      >
        <Stack gap="md">
          <Select
            label={t('sourceDay')}
            placeholder={t('selectDay')}
            data={dayOptions}
            value={sourceDay !== null ? String(sourceDay) : null}
            onChange={(value) => setSourceDay(value ? Number(value) : null)}
            required
          />
          <MultiSelect
            label={t('targetDays')}
            placeholder={t('selectOneOrMoreDays')}
            data={dayOptions.filter((d) => d.value !== String(sourceDay))}
            value={targetDays.map(String)}
            onChange={(values) => setTargetDays(values.map(Number))}
            required
          />
          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" onClick={closeReplicateModal}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleReplicateDay}
              loading={replicateDayMutation.isPending}
              disabled={!sourceDay || targetDays.length === 0}
            >
              {t('replicate')}
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
        title={t('copyFromSectionModalTitle')}
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('confirmCopyFromSectionMessage', {
              sourceSectionName:
                classSection
                  ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
                  : t('classSection'),
              targetSectionName:
                classSection
                  ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
                  : t('classSection'),
            })}
          </Text>
          {availableSourceSections.length === 0 ? (
            <Alert color={colors.info}>
              <Text size="sm">
                {candidateSourceSections.length === 0
                  ? t('noOtherSections')
                  : t('noSectionsWithSlots')}
              </Text>
            </Alert>
          ) : (
            <>
              <Select
                label={t('sourceSection')}
                placeholder={t('selectSourceSection')}
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
              {sourceSectionId && sourceTemplatesLoading && <Skeleton height={36} />}
              {sourceSectionId && !sourceTemplatesLoading && sourceTemplates.length > 0 && (
                <Select
                  label={t('subjectTemplateOptional')}
                  placeholder={t('selectSubjectTemplateToCopy')}
                  description={t('copyAllSlots')}
                  data={sourceTemplates.map((tpl) => ({
                    value: tpl.id,
                    label: tpl.name,
                  }))}
                  value={sourceTemplateId}
                  onChange={(value) => setSourceTemplateId(value)}
                  clearable
                  searchable
                />
              )}
              {sourceSectionId && !sourceTemplatesLoading && sourceTemplates.length === 0 && (
                <Alert color={colors.info} variant="light">
                  <Text size="sm">{t('sourceHasNoTemplates')}</Text>
                </Alert>
              )}
              <MantineAlert
                icon={<IconAlertTriangle size={16} />}
                color="yellow"
                variant="light"
                title={t('warning')}
              >
                <Text size="sm">
                  {t('confirmCopyFromSectionMessage', {
                    sourceSectionName:
                      classSection
                        ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
                        : t('classSection'),
                    targetSectionName:
                      classSection
                        ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
                        : t('classSection'),
                  })}
                </Text>
              </MantineAlert>
            </>
          )}
          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" onClick={closeReplicateFromSectionModal}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleReplicateFromSection}
              loading={replicateFromSectionMutation.isPending}
              disabled={!sourceSectionId || availableSourceSections.length === 0}
            >
              {t('copy')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={replicateAcrossSectionsModalOpened}
        onClose={closeReplicateAcrossSectionsModal}
        title={t('replicateAcrossModalTitle')}
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('confirmReplicationAcrossMessage', {
              sourceSectionName:
                classSection
                  ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
                  : t('classSection'),
              targetSectionNames: t('selectTargetSections'),
            })}
          </Text>
          {otherSections.length === 0 ? (
            <Alert color={colors.info}>
              <Text size="sm">{t('noOtherSectionsForClass')}</Text>
            </Alert>
          ) : (
            <>
              <MultiSelect
                label={t('selectTargetSections')}
                placeholder={t('selectOneOrMoreDays')}
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
                title={t('warning')}
              >
                <Text size="sm">
                  {t('confirmReplicationAcrossMessage', {
                    sourceSectionName:
                      classSection
                        ? `${classSection.classDisplayName || classSection.className || 'Unknown'} - ${classSection.sectionName || 'Unknown'}`
                        : t('classSection'),
                    targetSectionNames: t('selectTargetSections'),
                  })}
                </Text>
              </MantineAlert>
            </>
          )}
          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="subtle" onClick={closeReplicateAcrossSectionsModal}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleReplicateAcrossSections}
              loading={replicateAcrossSectionsMutation.isPending}
              disabled={targetSectionIds.length === 0 || otherSections.length === 0}
            >
              {t('replicate')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
