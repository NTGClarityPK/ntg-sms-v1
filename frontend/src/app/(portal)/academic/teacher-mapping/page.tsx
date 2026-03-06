'use client';

import { useState } from 'react';
import { Container, Title, Group, Button, Skeleton, Text, SegmentedControl, Stack } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useTeacherAssignments } from '@/hooks/useTeacherAssignments';
import { TeacherMappingList } from '@/components/features/academic/TeacherMappingList';
import { TeacherMappingMatrix } from '@/components/features/academic/TeacherMappingMatrix';
import { CreateAssignmentModal } from '@/components/features/academic/CreateAssignmentModal';
import { useDisclosure } from '@mantine/hooks';

type ViewMode = 'list' | 'matrix';

export default function TeacherMappingPage() {
  const t = useTranslations('teacher');
  const [opened, { open, close }] = useDisclosure(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // Fetch enough assignments to cover all subjects/class-sections for the branch.
  // Backend pagination will cap this to its max, but we request a high limit so
  // the matrix view has a complete picture instead of only the first page.
  const { data, isLoading, error } = useTeacherAssignments({ limit: 500 });

  // Show skeleton when loading OR when data is not yet available (prevents flash of content)
  if (isLoading || !data) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%" mt="xs">
            <Title order={1}>{t('title')}</Title>
            <Group>
              <SegmentedControl
                value={viewMode}
                onChange={(value) => setViewMode(value as ViewMode)}
                data={[
                  { label: t('listView'), value: 'list' },
                  { label: t('matrixView'), value: 'matrix' },
                ]}
              />
              <Button leftSection={<IconPlus size={16} />} onClick={open}>
                {t('createAssignment')}
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
            <Skeleton height={40} width="30%" />
            <Skeleton height={400} />
            <Skeleton height={200} />
          </Stack>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%" mt="xs">
            <Title order={1}>{t('title')}</Title>
            <Group>
              <SegmentedControl
                value={viewMode}
                onChange={(value) => setViewMode(value as ViewMode)}
                data={[
                  { label: t('listView'), value: 'list' },
                  { label: t('matrixView'), value: 'matrix' },
                ]}
              />
              <Button leftSection={<IconPlus size={16} />} onClick={open}>
                {t('createAssignment')}
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
          <Text c="red">
            {t('errorLoading', { message: error instanceof Error ? error.message : 'Unknown error' })}
          </Text>
        </div>
      </>
    );
  }

  const assignments = data?.data || [];

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" mt="xs">
          <Title order={1}>{t('title')}</Title>
          <Group>
            <SegmentedControl
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
              data={[
                { label: t('listView'), value: 'list' },
                { label: t('matrixView'), value: 'matrix' },
              ]}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              {t('createAssignment')}
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
        {viewMode === 'list' ? (
          <TeacherMappingList assignments={assignments} meta={data?.meta} />
        ) : (
          <TeacherMappingMatrix assignments={assignments} />
        )}
      </div>
      <CreateAssignmentModal opened={opened} onClose={close} />
    </>
  );
}

