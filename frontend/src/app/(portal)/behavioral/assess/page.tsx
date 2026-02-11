'use client';

import { useState } from 'react';
import {
  Group,
  Title,
  Text,
  Select,
  Stack,
  Skeleton,
  Alert,
} from '@mantine/core';
import { useClassSections } from '@/hooks/useClassSections';
import { useBehavioralMatrix } from '@/hooks/useBehavioral';
import { BehavioralMatrix } from '@/components/features/behavioral/BehavioralMatrix';

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -2; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

const monthOptions = getMonthOptions();
const defaultMonth = new Date().toISOString().slice(0, 7) + '-01';

export default function BehavioralAssessPage() {
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(defaultMonth);

  const classSectionsQuery = useClassSections({ limit: 100, minimal: true });
  const matrixQuery = useBehavioralMatrix(classSectionId, month);

  const classSectionOptions =
    classSectionsQuery.data?.data?.map((cs) => ({
      value: cs.id,
      label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
    })) ?? [];

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Behavioral matrix</Title>
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
          <Group align="flex-end" wrap="wrap">
            <Select
              label="Class section"
              placeholder="Select class section"
              data={classSectionOptions}
              value={classSectionId}
              onChange={(v) => setClassSectionId(v)}
              clearable
              style={{ minWidth: 200 }}
            />
            <Select
              label="Month"
              data={monthOptions}
              value={month}
              onChange={(v) => setMonth(v ?? defaultMonth)}
              style={{ minWidth: 140 }}
            />
          </Group>

          {!classSectionId ? (
            <Alert color="blue">
              Select a class section and month to load the matrix.
            </Alert>
          ) : (
            <BehavioralMatrix
              data={matrixQuery.data ?? null}
              isLoading={matrixQuery.isLoading}
              onSaved={() => matrixQuery.refetch()}
            />
          )}
        </Stack>
      </div>
    </>
  );
}
