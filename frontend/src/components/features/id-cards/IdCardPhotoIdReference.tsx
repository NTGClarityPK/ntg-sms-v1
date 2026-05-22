'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Collapse,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useIdCardClassSectionRecipients } from '@/hooks/useIdCards';
import { useStaff } from '@/hooks/useStaff';
import { buildIdCardStatusSummaryParts } from '@/lib/id-cards/format-status-summary';
import { ID_CARD_STATUS_COLOUR } from '@/lib/id-cards/status-colour';
import { formatStaffRoleLabel } from '@/lib/id-cards/format-staff-role';
import { formatStudentName } from '@/types/students';
import type { IdCardPersonType, IdCardStatus } from '@/types/id-cards';

type Props = {
  personType: IdCardPersonType;
  classSectionId: string | null;
  classSectionLabel: string;
  staffRoleId?: string | null;
  selectedStaffIds?: string[];
};

export function IdCardPhotoIdReference({
  personType,
  classSectionId,
  classSectionLabel,
  staffRoleId = null,
  selectedStaffIds = [],
}: Props) {
  const t = useTranslations('idCards');
  const [opened, { toggle }] = useDisclosure(false);

  const canLoadStudents = personType === 'student' && !!classSectionId;
  const canLoadStaff = personType === 'staff';

  const { data: studentData, isLoading: studentsLoading } = useIdCardClassSectionRecipients(
    classSectionId,
    opened && canLoadStudents,
  );

  const studentRows = studentData?.recipients ?? [];
  const statusCounts = studentData?.statusCounts ?? {};

  const { data: staffResponse, isLoading: staffLoading } = useStaff({
    isActive: true,
    limit: 500,
    role: staffRoleId ?? undefined,
    enabled: opened && canLoadStaff,
  });

  const staffRows = useMemo(() => {
    let list = staffResponse?.data ?? [];
    if (selectedStaffIds.length > 0) {
      const idSet = new Set(selectedStaffIds);
      list = list.filter((s) => idSet.has(s.id));
    }
    return [...list].sort((a, b) =>
      (a.fullName ?? a.employeeId ?? '').localeCompare(b.fullName ?? b.employeeId ?? ''),
    );
  }, [staffResponse?.data, selectedStaffIds]);

  const statusSummaryParts = useMemo(
    () =>
      buildIdCardStatusSummaryParts(
        statusCounts,
        (s) => t(`status.${s}`),
        (count, status) => t('wizard.generatedStatusPart', { count, status }),
      ),
    [statusCounts, t],
  );

  const toggleLabel =
    personType === 'student'
      ? t('wizard.photoIdsToggleStudents', { section: classSectionLabel || t('classSection') })
      : t('wizard.photoIdsToggleStaff');

  const showStudentPlaceholder = personType === 'student' && !classSectionId;

  if (showStudentPlaceholder) {
    return (
      <Text size="sm" c="dimmed">
        {t('wizard.photoIdsSelectClassSection')}
      </Text>
    );
  }

  const isLoading = personType === 'student' ? studentsLoading : staffLoading;

  return (
    <Stack gap={6}>
      <UnstyledButton onClick={toggle} id="id-cards-photo-ids-toggle">
        <Group gap={6} wrap="nowrap">
          {opened ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          <Text size="sm" fw={500} c="var(--mantine-color-anchor)">
            {toggleLabel}
          </Text>
        </Group>
      </UnstyledButton>

      <Collapse in={opened}>
        <Paper withBorder p="sm" radius="md">
          {isLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : personType === 'student' ? (
            studentRows.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t('wizard.photoIdsEmptyStudents')}
              </Text>
            ) : (
              <Stack gap="sm">
                {statusSummaryParts.length > 0 ? (
                  <Text size="sm" fw={500}>
                    {t('wizard.generatedSummary', { parts: statusSummaryParts.join(', ') })}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t('wizard.generatedSummaryNone')}
                  </Text>
                )}
                <ScrollArea.Autosize mah={220} type="auto">
                  <Stack gap={8}>
                    {studentRows.map((s) => (
                      <Group key={s.id} gap="xs" wrap="nowrap" align="flex-start" justify="space-between">
                        <Text size="sm" lineClamp={2} style={{ flex: 1, minWidth: 0 }}>
                          {formatStudentName(s)}
                          <Text span c="dimmed">
                            {' '}
                            :{' '}
                          </Text>
                          <Text span fw={600}>
                            {s.studentId}
                          </Text>
                        </Text>
                        <StudentCardStatusBadge status={s.cardStatus} label={t} />
                      </Group>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              </Stack>
            )
          ) : staffRows.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t('wizard.photoIdsEmptyStaff')}
            </Text>
          ) : (
            <ScrollArea.Autosize mah={220} type="auto">
              <Stack gap={8}>
                {staffRows.map((s) => {
                  const roleLabel =
                    s.roles?.map((r) => formatStaffRoleLabel(r.roleName)).join(', ') ?? '—';
                  return (
                    <Text key={s.id} size="sm" lineClamp={3}>
                      {s.fullName ?? '—'}
                      <Text span c="dimmed">
                        {' '}
                        ·{' '}
                      </Text>
                      <Text span>{roleLabel}</Text>
                      <Text span c="dimmed">
                        {' '}
                        :{' '}
                      </Text>
                      <Text span fw={600}>
                        {s.employeeId ?? '—'}
                      </Text>
                    </Text>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Paper>
      </Collapse>
    </Stack>
  );
}

function StudentCardStatusBadge({
  status,
  label,
}: {
  status: IdCardStatus | null;
  label: ReturnType<typeof useTranslations<'idCards'>>;
}) {
  if (!status) {
    return (
      <Badge variant="light" color="gray" size="sm">
        {label('status.notGenerated')}
      </Badge>
    );
  }
  return (
    <Badge variant="light" color={ID_CARD_STATUS_COLOUR[status]} size="sm">
      {label(`status.${status}`)}
    </Badge>
  );
}
