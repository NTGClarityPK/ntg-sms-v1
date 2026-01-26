'use client';

import { useState } from 'react';
import { Container, Title, Group, Button, Loader, Text, SegmentedControl } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useTeacherAssignments } from '@/hooks/useTeacherAssignments';
import { TeacherMappingList } from '@/components/features/academic/TeacherMappingList';
import { TeacherMappingMatrix } from '@/components/features/academic/TeacherMappingMatrix';
import { CreateAssignmentModal } from '@/components/features/academic/CreateAssignmentModal';
import { useDisclosure } from '@mantine/hooks';

type ViewMode = 'list' | 'matrix';

export default function TeacherMappingPage() {
  const [opened, { open, close }] = useDisclosure(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const { data, isLoading, error } = useTeacherAssignments();

  if (isLoading) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>Teacher Mapping</Title>
          <Group>
            <SegmentedControl
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
              data={[
                { label: 'List View', value: 'list' },
                { label: 'Matrix View', value: 'matrix' },
              ]}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Create Assignment
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
          <Group justify="center" py="xl">
            <Loader size="lg" />
          </Group>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>Teacher Mapping</Title>
          <Group>
            <SegmentedControl
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
              data={[
                { label: 'List View', value: 'list' },
                { label: 'Matrix View', value: 'matrix' },
              ]}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Create Assignment
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
          <Text c="red">
            Error loading teacher assignments:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
        </div>
      </>
    );
  }

  const assignments = data?.data || [];

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>Teacher Mapping</Title>
        <Group>
          <SegmentedControl
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            data={[
              { label: 'List View', value: 'list' },
              { label: 'Matrix View', value: 'matrix' },
            ]}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Create Assignment
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

