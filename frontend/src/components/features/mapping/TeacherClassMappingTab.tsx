'use client';

import { useState } from 'react';
import {
  Group,
  Button,
  Skeleton,
  Text,
  SegmentedControl,
  Stack,
  Title,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useTeacherAssignments } from '@/hooks/useTeacherAssignments';
import { TeacherMappingList } from '@/components/features/academic/TeacherMappingList';
import { TeacherMappingMatrix } from '@/components/features/academic/TeacherMappingMatrix';
import { CreateAssignmentModal } from '@/components/features/academic/CreateAssignmentModal';
import { useDisclosure } from '@mantine/hooks';

type ViewMode = 'list' | 'matrix';

interface TeacherClassMappingTabProps {
  showTitle?: boolean;
}

export function TeacherClassMappingTab({ showTitle = false }: TeacherClassMappingTabProps) {
  const t = useTranslations('teacher');
  const [opened, { open, close }] = useDisclosure(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // Fetch enough assignments to cover all subjects/class-sections for the branch.
  const { data, isLoading, error } = useTeacherAssignments({ limit: 500 });

  if (isLoading) {
    return (
      <Stack gap="md">
        {showTitle && <Title order={2}>{t('title')}</Title>}
        <Group justify="space-between" w="100%">
          <SegmentedControl
            id="teacher-mapping-view-mode"
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            data={[
              { label: t('listView'), value: 'list' },
              { label: t('matrixView'), value: 'matrix' },
            ]}
          />
          <Button id="teacher-mapping-btn-create" leftSection={<IconPlus size={16} />} onClick={open}>
            {t('createAssignment')}
          </Button>
        </Group>
        <Skeleton height={40} width="30%" />
        <Skeleton height={400} />
        <Skeleton height={200} />
        <CreateAssignmentModal opened={opened} onClose={close} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack gap="md">
        {showTitle && <Title order={2}>{t('title')}</Title>}
        <Group justify="space-between" w="100%">
          <SegmentedControl
            id="teacher-mapping-view-mode"
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            data={[
              { label: t('listView'), value: 'list' },
              { label: t('matrixView'), value: 'matrix' },
            ]}
          />
          <Button id="teacher-mapping-btn-create" leftSection={<IconPlus size={16} />} onClick={open}>
            {t('createAssignment')}
          </Button>
        </Group>
        <Text c="red">
          {t('errorLoading', { message: error instanceof Error ? error.message : 'Unknown error' })}
        </Text>
        <CreateAssignmentModal opened={opened} onClose={close} />
      </Stack>
    );
  }

  if (!data) {
    return (
      <Stack gap="md">
        {showTitle && <Title order={2}>{t('title')}</Title>}
        <Group justify="space-between" w="100%">
          <SegmentedControl
            id="teacher-mapping-view-mode"
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            data={[
              { label: t('listView'), value: 'list' },
              { label: t('matrixView'), value: 'matrix' },
            ]}
          />
          <Button id="teacher-mapping-btn-create" leftSection={<IconPlus size={16} />} onClick={open}>
            {t('createAssignment')}
          </Button>
        </Group>
        <Text c="red">{t('errorLoading', { message: 'No data returned from server' })}</Text>
        <CreateAssignmentModal opened={opened} onClose={close} />
      </Stack>
    );
  }

  const assignments = data.data || [];

  return (
    <>
      {showTitle && <Title order={2}>{t('title')}</Title>}
      <Group justify="space-between" w="100%" mb="md">
        <SegmentedControl
          id="teacher-mapping-view-mode"
          value={viewMode}
          onChange={(value) => setViewMode(value as ViewMode)}
          data={[
            { label: t('listView'), value: 'list' },
            { label: t('matrixView'), value: 'matrix' },
          ]}
        />
        <Button id="teacher-mapping-btn-create" leftSection={<IconPlus size={16} />} onClick={open}>
          {t('createAssignment')}
        </Button>
      </Group>

      {viewMode === 'list' ? (
        <TeacherMappingList assignments={assignments} meta={data.meta} />
      ) : (
        <TeacherMappingMatrix assignments={assignments} />
      )}

      <CreateAssignmentModal opened={opened} onClose={close} />
    </>
  );
}

