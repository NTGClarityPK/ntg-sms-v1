'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  ScrollArea,
  Skeleton,
  Text,
  Group,
  Button,
  Paper,
} from '@mantine/core';
import { StarRating } from './StarRating';
import type { BehavioralMatrixRow, BehavioralMatrixResponse } from '@/types/behavioral';
import { useCreateBehavioralMutation, useUpdateBehavioralMutation } from '@/hooks/useBehavioral';

interface BehavioralMatrixProps {
  data: BehavioralMatrixResponse | null;
  isLoading: boolean;
  onSaved?: () => void;
}

/**
 * Grid: rows = students, columns = attributes. Cells are StarRating (1–5).
 * Save per row: create or update assessment for that student/month.
 */
export function BehavioralMatrix({ data, isLoading, onSaved }: BehavioralMatrixProps) {
  const t = useTranslations('behavioral');
  const createMutation = useCreateBehavioralMutation();
  const updateMutation = useUpdateBehavioralMutation();

  const [localRows, setLocalRows] = useState<Record<string, Record<string, number>>>({});

  const attributes = useMemo(() => data?.attributes ?? [], [data]);
  const rows = useMemo(() => data?.rows ?? [], [data]);

  const getScoresForRow = useCallback(
    (row: BehavioralMatrixRow): Record<string, number> => {
      const key = row.studentId;
      if (localRows[key]) return localRows[key];
      return row.scores ?? {};
    },
    [localRows],
  );

  const setScoreForRow = useCallback(
    (studentId: string, attributeName: string, score: number) => {
      setLocalRows((prev) => {
        const rowScores = { ...(prev[studentId] ?? {}) };
        rowScores[attributeName] = score;
        return { ...prev, [studentId]: rowScores };
      });
    },
    [],
  );

  const assessmentMonth = data?.assessmentMonth ?? new Date().toISOString().slice(0, 7) + '-01';

  const handleSaveRow = useCallback(
    async (row: BehavioralMatrixRow) => {
      const scoresToSave = getScoresForRow(row);
      const scoreEntries = Object.entries(scoresToSave).filter(([, v]) => v >= 1 && v <= 5);
      if (scoreEntries.length === 0) return;

      const payload = {
        studentId: row.studentId,
        assessmentMonth,
        scores: scoreEntries.map(([attributeName, score]) => ({ attributeName, score })),
      };

      if (row.assessmentId) {
        await updateMutation.mutateAsync({
          id: row.assessmentId,
          input: { scores: payload.scores },
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setLocalRows((prev) => {
        const next = { ...prev };
        delete next[row.studentId];
        return next;
      });
      onSaved?.();
    },
    [
      assessmentMonth,
      getScoresForRow,
      createMutation,
      updateMutation,
      onSaved,
    ],
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <Paper withBorder p="md">
        <Skeleton height={200} radius="sm" />
      </Paper>
    );
  }

  if (!data || attributes.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text c="dimmed">{t('noAttributesConfigured')}</Text>
      </Paper>
    );
  }

  if (rows.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text c="dimmed">{t('noStudentsInSection')}</Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <ScrollArea>
        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('student')}</Table.Th>
              {attributes.map((attr) => (
                <Table.Th key={attr}>{attr}</Table.Th>
              ))}
              <Table.Th>{t('actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.studentId}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {row.studentName}
                  </Text>
                </Table.Td>
                {attributes.map((attr) => (
                  <Table.Td key={attr}>
                    <StarRating
                      value={getScoresForRow(row)[attr] ?? 0}
                      onChange={(score) => setScoreForRow(row.studentId, attr, score)}
                      readonly={false}
                    />
                  </Table.Td>
                ))}
                <Table.Td>
                  <Button
                    size="xs"
                    variant="light"
                    loading={isSaving}
                    onClick={() => handleSaveRow(row)}
                  >
                    {t('save')}
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
  );
}
