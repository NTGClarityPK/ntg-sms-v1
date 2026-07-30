'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import {
  useCreateGoogleMapping,
  useDeleteGoogleMapping,
  useGoogleCourses,
  useGoogleMappings,
  useGoogleWorkspaceSettings,
} from '@/hooks/api/useGoogleWorkspace';
import { useClassSections } from '@/hooks/useClassSections';
import { useCoreLookups } from '@/hooks/useCoreLookups';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';

export function CourseMappingTable() {
  const t = useTranslations('googleClassroom');
  const tCommon = useTranslations('common');
  const { data: settings } = useGoogleWorkspaceSettings();
  const connected = settings?.isConnected ?? false;
  const { data: mappings, isLoading, error } = useGoogleMappings();
  const { data: courses } = useGoogleCourses(connected);
  const { data: activeYearResponse } = useActiveAcademicYear();
  const activeYear = activeYearResponse?.data;
  const { data: classSectionsData } = useClassSections({
    limit: 500,
    academicYearId: activeYear?.id,
  });
  const { data: subjectsData } = useCoreLookups('subjects');
  const createMapping = useCreateGoogleMapping();
  const deleteMapping = useDeleteGoogleMapping();
  const [opened, { open, close }] = useDisclosure(false);
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [googleCourseId, setGoogleCourseId] = useState<string | null>(null);

  const list = mappings ?? [];
  const classSections = classSectionsData?.data ?? [];
  const subjects = subjectsData?.data ?? [];
  const courseOptions = (courses ?? []).map((c) => ({
    value: c.id,
    label: c.section ? `${c.name} (${c.section})` : c.name,
  }));

  const handleCreate = () => {
    if (!classSectionId || !subjectId || !googleCourseId) return;
    const course = (courses ?? []).find((c) => c.id === googleCourseId);
    createMapping.mutate(
      {
        classSectionId,
        subjectId,
        googleCourseId,
        googleCourseName: course?.name,
        googleCourseSection: course?.section,
      },
      {
        onSuccess: () => {
          close();
          setClassSectionId(null);
          setSubjectId(null);
          setGoogleCourseId(null);
        },
      },
    );
  };

  if (isLoading) {
    return <Skeleton height={180} />;
  }

  if (error) {
    return (
      <Alert color="red" title={tCommon('error')}>
        {error.message}
      </Alert>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Title order={4}>{t('courseMappings')}</Title>
          <Button
            id="google-classroom-add-mapping"
            leftSection={<IconPlus size={16} />}
            variant="light"
            disabled={!connected}
            onClick={open}
          >
            {t('addMapping')}
          </Button>
        </Group>

        {list.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('notMapped')}
          </Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('almaClassSubject')}</Table.Th>
                <Table.Th>{t('googleCourse')}</Table.Th>
                <Table.Th>{tCommon('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((m) => (
                <Table.Tr key={m.id}>
                  <Table.Td>
                    {[m.classSectionLabel, m.subjectName].filter(Boolean).join(' · ') || '—'}
                  </Table.Td>
                  <Table.Td>
                    {m.googleCourseName
                      ? m.googleCourseSection
                        ? `${m.googleCourseName} (${m.googleCourseSection})`
                        : m.googleCourseName
                      : m.googleCourseId}
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      id={`google-classroom-delete-mapping-${m.id}`}
                      variant="subtle"
                      color="red"
                      loading={deleteMapping.isPending}
                      onClick={() => deleteMapping.mutate(m.id)}
                      aria-label={tCommon('delete')}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>

      <Modal
        opened={opened}
        onClose={close}
        title={t('addMapping')}
        id="google-classroom-add-mapping-modal"
      >
        <Stack gap="md">
          <Select
            id="google-mapping-class-section"
            label={t('classSection')}
            placeholder={tCommon('select')}
            data={classSections.map((cs) => ({
              value: cs.id,
              label:
                [cs.classDisplayName || cs.className, cs.sectionName]
                  .filter(Boolean)
                  .join(' - ') || cs.id,
            }))}
            description={activeYear ? `Showing sections for ${activeYear.name}` : undefined}
            value={classSectionId}
            onChange={setClassSectionId}
            searchable
          />
          <Select
            id="google-mapping-subject"
            label={t('subject')}
            placeholder={tCommon('select')}
            data={subjects.map((s) => ({
              value: s.id,
              label: s.name,
            }))}
            value={subjectId}
            onChange={setSubjectId}
            searchable
          />
          <Select
            id="google-mapping-course"
            label={t('googleCourse')}
            placeholder={tCommon('select')}
            data={courseOptions}
            value={googleCourseId}
            onChange={setGoogleCourseId}
            searchable
          />
          <Group justify="flex-end">
            <Button id="google-mapping-cancel" variant="default" onClick={close}>
              {tCommon('cancel')}
            </Button>
            <Button
              id="google-mapping-save"
              onClick={handleCreate}
              loading={createMapping.isPending}
              disabled={!classSectionId || !subjectId || !googleCourseId}
            >
              {t('save')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
