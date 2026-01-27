'use client';

import { Button, Group, Stack, Text, TextInput, NumberInput } from '@mantine/core';
import { useState } from 'react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { AssessmentData } from './types';

interface AssessmentStepProps {
  data: AssessmentData;
  onChange: (data: AssessmentData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function AssessmentStep({ data, onChange, onNext, onBack }: AssessmentStepProps) {
  const colors = useThemeColors();
  const [newAssessmentType, setNewAssessmentType] = useState({ name: '', sortOrder: 0 });
  const [newGradeTemplate, setNewGradeTemplate] = useState({ name: '' });
  const [newRange, setNewRange] = useState({ letter: '', minPercentage: 0, maxPercentage: 100, sortOrder: 0 });
  const [leaveQuota, setLeaveQuota] = useState(data.leaveQuota || 7);

  const handleAddAssessmentType = () => {
    if (newAssessmentType.name.trim()) {
      onChange({
        ...data,
        assessmentTypes: [
          ...data.assessmentTypes,
          { ...newAssessmentType, name: newAssessmentType.name.trim() },
        ],
      });
      setNewAssessmentType({ name: '', sortOrder: data.assessmentTypes.length });
    }
  };

  const handleAddGradeTemplate = () => {
    if (newGradeTemplate.name.trim()) {
      onChange({
        ...data,
        gradeTemplates: [
          ...data.gradeTemplates,
          {
            ...newGradeTemplate,
            name: newGradeTemplate.name.trim(),
            ranges: [],
            classAssignments: [],
          },
        ],
      });
      setNewGradeTemplate({ name: '' });
    }
  };

  const handleAddRange = () => {
    if (newRange.letter.trim() && data.gradeTemplates.length > 0) {
      const lastTemplate = data.gradeTemplates[data.gradeTemplates.length - 1];
      const templateId = lastTemplate.name;
      const newRangeData = { ...newRange, letter: newRange.letter.trim(), sortOrder: lastTemplate.ranges.length };
      onChange({
        ...data,
        gradeRanges: [
          ...data.gradeRanges,
          {
            templateId,
            range: newRangeData,
          },
        ],
        gradeTemplates: data.gradeTemplates.map((t, idx) =>
          idx === data.gradeTemplates.length - 1
            ? { ...t, ranges: [...t.ranges, newRangeData] }
            : t,
        ),
      });
      setNewRange({ letter: '', minPercentage: 0, maxPercentage: 100, sortOrder: lastTemplate.ranges.length + 1 });
    }
  };

  const handleLeaveQuotaChange = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    setLeaveQuota(numValue);
    onChange({
      ...data,
      leaveQuota: numValue,
    });
  };

  const handleNext = () => {
    if (data.assessmentTypes.length === 0 || data.gradeTemplates.length === 0 || !data.leaveQuota) {
      return;
    }
    onNext();
  };

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        Assessment Settings
      </Text>
      <Text size="sm" c="dimmed">
        Configure assessment types, grade templates, and leave quota.
      </Text>

      <Stack gap="lg" mt="md">
        <div>
          <Text size="sm" fw={500} mb="xs">
            Assessment Types ({data.assessmentTypes.length})
          </Text>
          <Group gap="xs" mb="xs">
            <TextInput
              placeholder="Type name"
              value={newAssessmentType.name}
              onChange={(e) => setNewAssessmentType({ ...newAssessmentType, name: e.target.value })}
              style={{ flex: 1 }}
            />
            <NumberInput
              placeholder="Order"
              value={newAssessmentType.sortOrder}
              onChange={(val) => setNewAssessmentType({ ...newAssessmentType, sortOrder: Number(val) || 0 })}
              style={{ width: 100 }}
            />
            <Button onClick={handleAddAssessmentType} size="sm">
              Add
            </Button>
          </Group>
          {data.assessmentTypes.length > 0 && (
            <Stack gap="xs">
              {data.assessmentTypes.map((at, idx) => (
                <Text key={idx} size="sm">
                  {at.name}
                </Text>
              ))}
            </Stack>
          )}
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">
            Grade Templates ({data.gradeTemplates.length})
          </Text>
          <Group gap="xs" mb="xs">
            <TextInput
              placeholder="Template name"
              value={newGradeTemplate.name}
              onChange={(e) => setNewGradeTemplate({ ...newGradeTemplate, name: e.target.value })}
              style={{ flex: 1 }}
            />
            <Button onClick={handleAddGradeTemplate} size="sm">
              Add Template
            </Button>
          </Group>
          {data.gradeTemplates.length > 0 && (
            <Stack gap="md" mt="xs">
              {data.gradeTemplates.map((template, templateIdx) => (
                <div key={templateIdx}>
                  <Text size="sm" fw={500} mb="xs">
                    {template.name} ({template.ranges.length} ranges)
                  </Text>
                  {template.ranges.length > 0 && (
                    <Stack gap="xs" mb="xs" pl="md">
                      {template.ranges.map((range, rangeIdx) => (
                        <Text key={rangeIdx} size="sm" c="dimmed">
                          {range.letter}: {range.minPercentage}% - {range.maxPercentage}%
                        </Text>
                      ))}
                    </Stack>
                  )}
                  {templateIdx === data.gradeTemplates.length - 1 && (
                    <div>
                      <Text size="xs" c="dimmed" mb="xs">
                        Add grade ranges to this template:
                      </Text>
                      <Group gap="xs" mb="xs">
                        <TextInput
                          placeholder="Letter (A, B, C...)"
                          value={newRange.letter}
                          onChange={(e) => setNewRange({ ...newRange, letter: e.target.value })}
                          style={{ width: 100 }}
                        />
                        <NumberInput
                          placeholder="Min %"
                          value={newRange.minPercentage}
                          onChange={(val) => setNewRange({ ...newRange, minPercentage: Number(val) || 0 })}
                          style={{ width: 100 }}
                        />
                        <NumberInput
                          placeholder="Max %"
                          value={newRange.maxPercentage}
                          onChange={(val) => setNewRange({ ...newRange, maxPercentage: Number(val) || 100 })}
                          style={{ width: 100 }}
                        />
                        <Button onClick={handleAddRange} size="sm">
                          Add Range
                        </Button>
                      </Group>
                    </div>
                  )}
                </div>
              ))}
            </Stack>
          )}
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">
            Leave Quota (per academic year)
          </Text>
          <NumberInput
            value={leaveQuota}
            onChange={handleLeaveQuotaChange}
            min={0}
            style={{ width: 200 }}
          />
        </div>
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button variant="light" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} color={colors.primary} disabled={data.assessmentTypes.length === 0 || data.gradeTemplates.length === 0 || !data.leaveQuota}>
          Next
        </Button>
      </Group>
    </Stack>
  );
}

