'use client';

import { Title, Text, Stack, Skeleton, Group, Alert, Paper, Modal, Badge } from '@mantine/core';
import { useStudentTimetable, useTimingTemplateInfo } from '@/hooks/useTimetable';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useStudentTemplate } from '@/hooks/useSubjectTemplates';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { getThemeColorShade } from '@/lib/utils/theme';

// Helper to convert hex to RGB for rgba calculations (local copy since it's not exported)
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}
import { useTranslations } from 'next-intl';
import { useThemeStore } from '@/lib/store/theme-store';
import { TimetableGrid } from '@/components/features/timetable/TimetableGrid';
import { useMyStudent } from '@/hooks/useStudents';
import { useClassSections } from '@/hooks/useClassSections';
import { useState, useEffect, useMemo } from 'react';
import { useDisclosure } from '@mantine/hooks';
import type { TimetableSlot } from '@/types/timetable';
import { IconX, IconClock } from '@tabler/icons-react';

export default function MyTimetablePage() {
  const t = useTranslations('timetable');
  const colors = useThemeColors();
  const { themeVersion } = useThemeStore();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { data: activeYearResponse } = useActiveAcademicYear();
  const activeYear = activeYearResponse?.data ?? null;
  const activeYearId = activeYear?.id;

  // Get light background color for banner (similar to blue-0 shade)
  // Reactive to theme changes via themeVersion dependency
  const bannerBackgroundColor = useMemo(() => getThemeColorShade(0), [themeVersion]);

  // Get light background colors for badges (light variant backgrounds)
  const currentBadgeBg = useMemo(() => {
    // Mix success color with white for light background (similar to Mantine's light variant)
    const rgb = hexToRgb(colors.success);
    if (!rgb) return colors.success;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;
  }, [colors.success, themeVersion]);

  const upcomingBadgeBg = useMemo(() => {
    // Mix info color with white for light background
    const rgb = hexToRgb(colors.info);
    if (!rgb) return colors.info;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;
  }, [colors.info, themeVersion]);

  // Get current student
  const { data: myStudentData, isLoading: myStudentLoading, error: myStudentError } = useMyStudent();
  const studentId = myStudentData?.data?.id;

  // Get student's template assignment
  const { data: templateData, isLoading: templateLoading } = useStudentTemplate(
    studentId ?? null,
    activeYearId ?? null,
    branchId ?? null,
  );

  // Get class-section ID from student's classId and sectionId
  const { data: classSectionsData, isLoading: classSectionsLoading } = useClassSections(
    myStudentData?.data?.classId && myStudentData?.data?.sectionId && activeYearId
      ? {
          classId: myStudentData.data.classId,
          sectionId: myStudentData.data.sectionId,
          academicYearId: activeYearId,
          minimal: true,
        }
      : undefined,
  );
  const classSectionId = classSectionsData?.data?.[0]?.id;

  // Get timetable filtered by template
  const { data: timetableData, isLoading: timetableLoading, error: timetableError } =
    useStudentTimetable(studentId ?? null, activeYearId);

  // Get timing template info for grid (needed for vertical timeline, but banner is removed)
  const { data: templateInfoData, isLoading: templateInfoLoading } = useTimingTemplateInfo(classSectionId ?? null);

  const timetable = timetableData?.data;
  const templateInfo = templateInfoData;
  
  // State for slot details modal
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [slotModalOpened, { open: openSlotModal, close: closeSlotModal }] = useDisclosure(false);

  // State for next period
  const [nextPeriod, setNextPeriod] = useState<{
    slot: TimetableSlot | null;
    timeUntil: { hours: number; minutes: number } | null;
    status: 'upcoming' | 'current' | 'none';
  } | null>(null);
  
  // Use template info from student data if available, otherwise from separate query
  const subjectTemplate = myStudentData?.data?.subjectTemplateId
    ? {
        id: myStudentData.data.subjectTemplateId,
        name: myStudentData.data.subjectTemplateName || 'Unknown Template',
      }
    : templateData?.data;

  // Calculate next period
  useEffect(() => {
    if (!timetable?.slots || timetable.slots.length === 0) {
      setNextPeriod(null);
      return;
    }

    const updateNextPeriod = () => {
      const now = new Date();
      const currentDay = now.getDay(); // 0-6 (Sunday = 0, Monday = 1, etc.)
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTime = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}:00`;

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // Filter today's slots - check if day matches
      const todaySlots = timetable.slots.filter((s) => s.dayOfWeek === currentDay);

      // If no slots for today, try to find next available slot from any day
      if (todaySlots.length === 0) {
        // Find the next slot from any day (for better UX - show next period even if not today)
        const allUpcomingSlots = timetable.slots
          .map((s) => {
            // Calculate days until this slot's day
            let daysUntil = s.dayOfWeek - currentDay;
            if (daysUntil < 0) daysUntil += 7; // Wrap around to next week
            
            const [startH, startM] = s.startTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const currentMinutesTotal = currentHours * 60 + currentMinutes;
            
            // If same day, only include if time is in future
            if (daysUntil === 0 && startMinutes <= currentMinutesTotal) {
              return null;
            }
            
            return { slot: s, daysUntil, startMinutes };
          })
          .filter((item): item is { slot: TimetableSlot; daysUntil: number; startMinutes: number } => item !== null)
          .sort((a, b) => {
            // Sort by days until first, then by time
            if (a.daysUntil !== b.daysUntil) {
              return a.daysUntil - b.daysUntil;
            }
            return a.startMinutes - b.startMinutes;
          });

        if (allUpcomingSlots.length > 0) {
          const { slot: nextSlot, daysUntil, startMinutes } = allUpcomingSlots[0];

          // Calculate total time until next period
          const currentMinutesTotal = currentHours * 60 + currentMinutes;
          let totalMinutesUntil = 0;
          
          if (daysUntil === 0) {
            // Same day, just calculate time difference
            totalMinutesUntil = startMinutes - currentMinutesTotal;
          } else {
            // Different day: calculate minutes until end of today + minutes until slot time on target day
            const minutesUntilEndOfDay = (24 * 60) - currentMinutesTotal;
            totalMinutesUntil = minutesUntilEndOfDay + ((daysUntil - 1) * 24 * 60) + startMinutes;
          }
          
          const hours = Math.floor(totalMinutesUntil / 60);
          const minutes = totalMinutesUntil % 60;
          
          setNextPeriod({ 
            slot: nextSlot, 
            timeUntil: { hours, minutes }, 
            status: 'upcoming'
          });
          return;
        }

        setNextPeriod({ slot: null, timeUntil: null, status: 'none' });
        return;
      }

      // Check if currently in a period
      const currentSlot = todaySlots.find((s) => {
        const [startH, startM] = s.startTime.split(':').map(Number);
        const [endH, endM] = s.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const currentMinutesTotal = currentHours * 60 + currentMinutes;
        return currentMinutesTotal >= startMinutes && currentMinutesTotal < endMinutes;
      });

      if (currentSlot) {
        setNextPeriod({ slot: currentSlot, timeUntil: null, status: 'current' });
        return;
      }

      // Find next upcoming slot
      const upcomingSlots = todaySlots
        .filter((s) => {
          const [startH, startM] = s.startTime.split(':').map(Number);
          const startMinutes = startH * 60 + startM;
          const currentMinutesTotal = currentHours * 60 + currentMinutes;
          return startMinutes > currentMinutesTotal;
        })
        .sort((a, b) => {
          const [aH, aM] = a.startTime.split(':').map(Number);
          const [bH, bM] = b.startTime.split(':').map(Number);
          return aH * 60 + aM - (bH * 60 + bM);
        });

      if (upcomingSlots.length > 0) {
        const nextSlot = upcomingSlots[0];
        const [startH, startM] = nextSlot.startTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const currentMinutesTotal = currentHours * 60 + currentMinutes;
        const diffMinutes = startMinutes - currentMinutesTotal;

        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;

        setNextPeriod({
          slot: nextSlot,
          timeUntil: { hours, minutes },
          status: 'upcoming',
        });
      } else {
        setNextPeriod({ slot: null, timeUntil: null, status: 'none' });
      }
    };

    updateNextPeriod(); // Initial calculation
    const interval = setInterval(updateNextPeriod, 60000); // Update every 60 seconds

    return () => {
      clearInterval(interval);
    };
  }, [timetable?.slots]);

  // Loading state: show page as soon as student, timetable and class-section are ready.
  // Template info loads after classSectionId; we show the grid area as skeleton until then so the card doesn't hang.
  if (myStudentLoading || timetableLoading || classSectionsLoading) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>{t('myTimetable')}</Title>
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

  // Check if student data is available
  if (!myStudentData?.data) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>{t('myTimetable')}</Title>
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
          <Alert color={colors.warning} title={t('student')}>
            <Text size="sm">
              {t('noTimetableSlotsMessage')}
            </Text>
          </Alert>
        </div>
      </>
    );
  }

  // Error or no template assigned
  if (timetableError || !subjectTemplate) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>{t('myTimetable')}</Title>
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
          <Alert color={colors.warning} title={t('noSubjectTemplatesAssigned')}>
            <Text size="sm">
              {t('noSubjectTemplateMessage')}
            </Text>
          </Alert>
        </div>
      </>
    );
  }

  // No timetable data
  if (!timetable) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>{t('myTimetable')}</Title>
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
          <Alert color={colors.info} title={t('noTimetableAvailable')}>
            <Text size="sm">{t('noTimetableForClassSection')}</Text>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('myTimetable')}</Title>
          {/* Next Period Badge */}
          {nextPeriod && nextPeriod.status !== 'none' && (
            <Badge
              size="lg"
              variant="light"
              color={nextPeriod.status === 'current' ? colors.success : colors.info}
              leftSection={<IconClock size={16} />}
              style={{
                whiteSpace: 'nowrap',
                backgroundColor: nextPeriod.status === 'current' ? currentBadgeBg : upcomingBadgeBg,
              }}
            >
              {nextPeriod.status === 'current' ? (
                <Text size="sm" fw={500}>
                  {t('currently')} {nextPeriod.slot?.subjectName || t('freePeriod')}
                </Text>
              ) : (
                nextPeriod.slot && nextPeriod.timeUntil && (
                  <Text size="sm" fw={500}>
                    {t('upcoming')} {nextPeriod.slot.subjectName || t('freePeriod')}{' '}
                    {nextPeriod.timeUntil.hours > 0
                      ? `${nextPeriod.timeUntil.hours} hour${nextPeriod.timeUntil.hours > 1 ? 's' : ''} `
                      : ''}
                    {nextPeriod.timeUntil.minutes} minute{nextPeriod.timeUntil.minutes !== 1 ? 's' : ''}
                  </Text>
                )
              )}
            </Badge>
          )}
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
          {/* Student Info Banner */}
          <Paper p="md" withBorder style={{ backgroundColor: bannerBackgroundColor }}>
            <Text size="sm" fw={500}>
              {t('showingTimetableFor')} <Text component="span" fw={600}>{[myStudentData.data.firstName, myStudentData.data.lastName].filter(Boolean).join(' ') || t('student')}</Text>{' '}
              <Text component="span" fw={600}>{subjectTemplate?.name || t('unknownTemplate')}</Text>{' '}
              <Text component="span" fw={600}>
                {timetable ? `${timetable.className} - ${timetable.sectionName}` : t('unknownClass')}
              </Text>
            </Text>
          </Paper>

          {timetable && (
            templateInfoLoading ? (
              <Skeleton height={400} radius="sm" />
            ) : (
              <TimetableGrid
                classSectionId={classSectionId ?? ''}
                slots={timetable.slots}
                onSlotClick={(slot, day, timeRange, target) => {
                  if (slot) {
                    setSelectedSlot(slot);
                    openSlotModal();
                  }
                }}
                templateInfo={templateInfo || null}
                conflicts={[]}
                isLoading={timetableLoading}
              />
            )
          )}

          {timetable && timetable.slots.length === 0 && (
            <Alert color={colors.info} title={t('noTimetableSlots')}>
              <Text size="sm">
                {t('noSlotsForClassSection')}
              </Text>
            </Alert>
          )}
        </Stack>
      </div>

      {/* Slot Details Modal for Students */}
      <Modal
        opened={slotModalOpened}
        onClose={closeSlotModal}
        title={t('slotDetailsTitle')}
        size="md"
      >
        {selectedSlot && (
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={2} style={{ flex: 1 }}>
                <Text size="lg" fw={600} lineClamp={1}>
                  {selectedSlot.subjectName || t('freePeriod')}
                </Text>
                <Text size="sm" c="dimmed">
                  {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                </Text>
              </Stack>

              {selectedSlot.periodNumber && (
                <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {t('period')} {selectedSlot.periodNumber}
                </Text>
              )}
            </Group>

            <Group justify="space-between" align="center" wrap="nowrap">
              <Badge
                size="lg"
                variant="light"
                color={
                  selectedSlot.slotType === 'class'
                    ? colors.primary
                    : selectedSlot.slotType === 'assembly'
                      ? 'orange'
                      : selectedSlot.slotType === 'break'
                        ? 'yellow'
                        : 'gray'
                }
              >
                {t(`slotType_${selectedSlot.slotType}` as 'slotType_class' | 'slotType_assembly' | 'slotType_break')}
              </Badge>
            </Group>

            {selectedSlot.staffName && (
              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  {t('teacher')}
                </Text>
                <Text size="sm" fw={500}>
                  {selectedSlot.staffName}
                </Text>
              </div>
            )}

            {selectedSlot.room && (
              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  {t('room')}
                </Text>
                <Text size="sm" fw={500}>
                  {selectedSlot.room}
                </Text>
              </div>
            )}

            <div>
              <Text size="xs" c="dimmed" mb={4}>
                {t('day')}
              </Text>
              <Text size="sm" fw={500}>
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][selectedSlot.dayOfWeek]}
              </Text>
            </div>

            {selectedSlot.className && selectedSlot.sectionName && (
              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  {t('class')}
                </Text>
                <Text size="sm" fw={500}>
                  {selectedSlot.className} - {selectedSlot.sectionName}
                </Text>
              </div>
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}

// Format time from HH:MM:SS to HH:MM AM/PM
const formatTime = (time: string): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours || '0', 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes || '00'} ${ampm}`;
};

