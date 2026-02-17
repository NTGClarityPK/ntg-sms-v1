'use client';

import { useState } from 'react';
import { Group, Title, Select, Stack, Alert } from '@mantine/core';
import { useClassSections } from '@/hooks/useClassSections';
import Link from 'next/link';
import { Button } from '@mantine/core';
import type { ClassSection } from '@/types/class-sections';

export default function ClassReportSelectPage() {
  const [classSectionId, setClassSectionId] = useState<string | null>(null);

  const classSectionsQuery = useClassSections({ limit: 100 });
  const list = classSectionsQuery.data?.data as ClassSection[] | undefined;
  const options = (list ?? [])
    .sort((a, b) => {
      const classOrderA = a.classSortOrder ?? 999;
      const classOrderB = b.classSortOrder ?? 999;
      if (classOrderA !== classOrderB) return classOrderA - classOrderB;
      const sectionOrderA = a.sectionSortOrder ?? 999;
      const sectionOrderB = b.sectionSortOrder ?? 999;
      return sectionOrderA - sectionOrderB;
    })
    .map((cs) => ({
      value: cs.id,
      label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
    }));

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Class report</Title>
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
          <Select
            label="Select class section"
            placeholder="Choose a class section"
            data={options}
            value={classSectionId}
            onChange={setClassSectionId}
            clearable
            searchable
            style={{ maxWidth: 400 }}
          />

          {!classSectionId ? (
            <Alert color="blue">Select a class section to view the report.</Alert>
          ) : (
            <Button
              component={Link}
              href={`/reports/class/${classSectionId}`}
              variant="filled"
            >
              View class report
            </Button>
          )}
        </Stack>
      </div>
    </>
  );
}
