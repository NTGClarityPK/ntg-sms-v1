'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  ScrollArea,
  Skeleton,
  Text,
  Button,
  Paper,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
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
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
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

  const tableMinWidth = useMemo(() => {
    const n = attributes.length;
    const studentCol = isMobile ? 140 : 160;
    const attrCol = isMobile ? 108 : 128;
    const actionsCol = isMobile ? 120 : 96;
    return Math.max(320, studentCol + n * attrCol + actionsCol);
  }, [attributes.length, isMobile]);

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
    <Paper withBorder p={{ base: 'sm', sm: 'md' }}>
      <ScrollArea type="auto" scrollbars="x" w="100%">
        <Table withTableBorder withColumnBorders striped style={{ minWidth: tableMinWidth }}>
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
                      size={isMobile ? 18 : 22}
                    />
                  </Table.Td>
                ))}
                <Table.Td style={{ width: 1, verticalAlign: 'middle' }}>
                  <Button
                    size="xs"
                    variant="light"
                    fullWidth={isMobile}
                    maw={isMobile ? 120 : undefined}
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
