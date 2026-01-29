'use client';

import { useMemo } from 'react';
import { Title, Group, Button, Skeleton, Text, Stack } from '@mantine/core';
import { IconPlus, IconChecklist } from '@tabler/icons-react';
import { useClassSections, useBulkCreateClassSections } from '@/hooks/useClassSections';
import { ClassSectionGrid } from '@/components/features/academic/ClassSectionGrid';
import { CreateClassSectionModal } from '@/components/features/academic/CreateClassSectionModal';
import { useDisclosure } from '@mantine/hooks';
import { useClasses } from '@/hooks/useCoreLookups';
import { useSections } from '@/hooks/useCoreLookups';
import { modals } from '@mantine/modals';

export default function ClassSectionsPage() {
  const [opened, { open, close }] = useDisclosure(false);
  const { data, isLoading, error } = useClassSections();
  const { data: classesData } = useClasses();
  const { data: sectionsData } = useSections();
  const bulkCreate = useBulkCreateClassSections();

  const classes = classesData?.data || [];
  const sections = sectionsData?.data || [];
  const classSections = data?.data || [];

  // Find all missing combinations
  const missingCombinations = useMemo(() => {
    const existing = new Set(
      classSections.map((cs) => `${cs.classId}-${cs.sectionId}`)
    );
    const missing: Array<{ classId: string; sectionId: string }> = [];
    
    classes.forEach((cls) => {
      sections.forEach((sec) => {
        const key = `${cls.id}-${sec.id}`;
        if (!existing.has(key)) {
          missing.push({ classId: cls.id, sectionId: sec.id });
        }
      });
    });
    
    return missing;
  }, [classes, sections, classSections]);

  const handleBulkCreate = () => {
    if (missingCombinations.length === 0) {
      modals.openConfirmModal({
        title: 'No Missing Combinations',
        children: (
          <Text size="sm">
            All class-section combinations have already been created.
          </Text>
        ),
        labels: { confirm: 'OK', cancel: '' },
        confirmProps: { style: { display: 'none' } },
        cancelProps: { style: { display: 'none' } },
      });
      return;
    }

    modals.openConfirmModal({
      title: 'Create All Class Sections',
      children: (
        <Text size="sm">
          This will create {missingCombinations.length} class-section combination(s) with default capacity of 30.
          <br />
          <br />
          <strong>Combinations to create:</strong>
          <br />
          {missingCombinations.slice(0, 10).map((combo, idx) => {
            const cls = classes.find((c) => c.id === combo.classId);
            const sec = sections.find((s) => s.id === combo.sectionId);
            return (
              <Text key={idx} size="sm">
                • {cls?.displayName || cls?.name} - {sec?.name}
              </Text>
            );
          })}
          {missingCombinations.length > 10 && (
            <Text size="sm" c="dimmed">
              ... and {missingCombinations.length - 10} more
            </Text>
          )}
        </Text>
      ),
      labels: { confirm: 'Create All', cancel: 'Cancel' },
      confirmProps: { color: 'blue' },
      onConfirm: () => {
        bulkCreate.mutate({
          classSections: missingCombinations.map((combo) => ({
            classId: combo.classId,
            sectionId: combo.sectionId,
            capacity: 30,
          })),
        });
      },
    });
  };

  if (isLoading) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>Class Sections</Title>
            <Group>
              <Button leftSection={<IconPlus size={16} />} onClick={open}>
                Create Class-Section
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
          <Group justify="space-between" w="100%">
            <Title order={1}>Class Sections</Title>
            <Group>
              <Button leftSection={<IconPlus size={16} />} onClick={open}>
                Create Class-Section
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
          <Text c="red">Error loading class sections: {error instanceof Error ? error.message : 'Unknown error'}</Text>
        </div>
      </>  
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Class Sections</Title>
          <Group>
            {missingCombinations.length > 0 && (
              <Button
                leftSection={<IconChecklist size={16} />}
                variant="light"
                onClick={handleBulkCreate}
                loading={bulkCreate.isPending}
              >
                Create All ({missingCombinations.length})
              </Button>
            )}
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Create Class-Section
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
        <ClassSectionGrid classSections={classSections} />
      </div>
      <CreateClassSectionModal opened={opened} onClose={close} />
    </>
  );
}

