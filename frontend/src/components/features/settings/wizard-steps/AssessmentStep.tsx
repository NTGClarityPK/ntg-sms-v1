'use client';

import { ActionIcon, Alert, Button, Group, Stack, Text, TextInput, NumberInput } from '@mantine/core';
import { useState } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { AssessmentData } from './types';
import { useTranslations } from 'next-intl';

interface AssessmentStepProps {
  data: AssessmentData;
  onChange: (data: AssessmentData) => void;
  onNext: () => void;
  onBack: () => void;
}

const DEFAULT_LEAVE_QUOTA = 7;

export function AssessmentStep({ data, onChange, onNext, onBack }: AssessmentStepProps) {
  const colors = useThemeColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [newAssessmentType, setNewAssessmentType] = useState({ name: '', sortOrder: 0 });
  const [newGradeTemplate, setNewGradeTemplate] = useState({ name: '' });
  const [newRange, setNewRange] = useState({ letter: '', minPercentage: 0, maxPercentage: 100, sortOrder: 0 });
  const [leaveQuota, setLeaveQuota] = useState(data.leaveQuota ?? DEFAULT_LEAVE_QUOTA);
  const [rangeError, setRangeError] = useState<string | null>(null);

  /** Parent may still have `leaveQuota: null` while the input shows the default; Next must use the effective value. */
  const resolvedLeaveQuota = data.leaveQuota ?? leaveQuota;

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

  const handleRemoveAssessmentType = (index: number) => {
    onChange({
      ...data,
      assessmentTypes: data.assessmentTypes.filter((_, i) => i !== index),
    });
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

  const handleRemoveGradeTemplate = (index: number) => {
    const removed = data.gradeTemplates[index];
    if (!removed) return;
    const templateName = removed.name;
    onChange({
      ...data,
      gradeTemplates: data.gradeTemplates.filter((_, i) => i !== index),
      gradeRanges: data.gradeRanges.filter((gr) => gr.templateId !== templateName),
      classGradeAssignments: data.classGradeAssignments.filter(
        (a) => a.templateId !== templateName,
      ),
    });
  };

  const handleAddRange = () => {
    if (newRange.letter.trim() && data.gradeTemplates.length > 0) {
      const lastTemplate = data.gradeTemplates[data.gradeTemplates.length - 1];
      const templateId = lastTemplate.name;
      const newRangeData = { ...newRange, letter: newRange.letter.trim(), sortOrder: lastTemplate.ranges.length };

      // Validate overlap immediately (inclusive bounds).
      // Example: 80–90 and 90–100 overlaps at 90.
      const candidateMin = Math.min(newRangeData.minPercentage, newRangeData.maxPercentage);
      const candidateMax = Math.max(newRangeData.minPercentage, newRangeData.maxPercentage);
      const overlaps = (lastTemplate.ranges ?? []).some((r) => {
        const rMin = Math.min(r.minPercentage, r.maxPercentage);
        const rMax = Math.max(r.minPercentage, r.maxPercentage);
        return candidateMin <= rMax && candidateMax >= rMin;
      });
      if (overlaps) {
        setRangeError(tSettings('gradeRangeOverlapError') || 'Grade ranges cannot overlap.');
        return;
      }
      setRangeError(null);

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
    if (data.assessmentTypes.length === 0 || data.gradeTemplates.length === 0 || !resolvedLeaveQuota) {
      return;
    }
    if (data.leaveQuota == null) {
      const n =
        typeof resolvedLeaveQuota === 'number'
          ? resolvedLeaveQuota
          : parseInt(String(resolvedLeaveQuota), 10);
      if (Number.isNaN(n)) return;
      onChange({ ...data, leaveQuota: n });
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
              id="assessment-step-type-name"
              placeholder={tSettings('setupWizardAssessmentTypeNamePlaceholder')}
              value={newAssessmentType.name}
              onChange={(e) => setNewAssessmentType({ ...newAssessmentType, name: e.target.value })}
              style={{ flex: 1 }}
            />
            <NumberInput
              id="assessment-step-type-order"
              placeholder={tSettings('setupWizardAssessmentTypeOrderPlaceholder')}
              value={newAssessmentType.sortOrder}
              onChange={(val) => setNewAssessmentType({ ...newAssessmentType, sortOrder: Number(val) || 0 })}
              style={{ width: 100 }}
            />
            <Button id="assessment-step-add-type" onClick={handleAddAssessmentType} size="sm">
              Add
            </Button>
          </Group>
          {data.assessmentTypes.length > 0 && (
            <Stack gap="xs">
              {data.assessmentTypes.map((at, idx) => (
                <Group key={idx} justify="space-between" wrap="nowrap" align="center">
                  <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
                    {at.name}
                  </Text>
                  <ActionIcon
                    id={`assessment-step-remove-type-${idx}`}
                    variant="subtle"
                    color={colors.error}
                    onClick={() => handleRemoveAssessmentType(idx)}
                    aria-label={tSettings('setupWizardRemoveAssessmentType')}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
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
              id="assessment-step-template-name"
              placeholder={tSettings('setupWizardAssessmentGradeTemplatePlaceholder')}
              value={newGradeTemplate.name}
              onChange={(e) => setNewGradeTemplate({ ...newGradeTemplate, name: e.target.value })}
              style={{ flex: 1 }}
            />
            <Button id="assessment-step-add-template" onClick={handleAddGradeTemplate} size="sm">
              Add Template
            </Button>
          </Group>
          {data.gradeTemplates.length > 0 && (
            <Stack gap="md" mt="xs">
              {data.gradeTemplates.map((template, templateIdx) => (
                <div key={templateIdx}>
                  <Group justify="space-between" wrap="nowrap" align="flex-start" mb="xs">
                    <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }}>
                      {template.name} ({template.ranges.length} ranges)
                    </Text>
                    <ActionIcon
                      id={`assessment-step-remove-template-${templateIdx}`}
                      variant="subtle"
                      color={colors.error}
                      onClick={() => handleRemoveGradeTemplate(templateIdx)}
                      aria-label={tSettings('setupWizardRemoveGradeTemplate')}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
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
                          id="assessment-step-range-letter"
                          placeholder={tSettings('setupWizardAssessmentRangeLetterPlaceholder')}
                          value={newRange.letter}
                          onChange={(e) => {
                            setRangeError(null);
                            setNewRange({ ...newRange, letter: e.target.value });
                          }}
                          style={{ width: 100 }}
                        />
                        <NumberInput
                          id="assessment-step-range-min"
                          placeholder={tSettings('setupWizardAssessmentRangeMinPlaceholder')}
                          value={newRange.minPercentage}
                          onChange={(val) => {
                            setRangeError(null);
                            setNewRange({ ...newRange, minPercentage: Number(val) || 0 });
                          }}
                          style={{ width: 100 }}
                        />
                        <NumberInput
                          id="assessment-step-range-max"
                          placeholder={tSettings('setupWizardAssessmentRangeMaxPlaceholder')}
                          value={newRange.maxPercentage}
                          onChange={(val) => {
                            setRangeError(null);
                            setNewRange({ ...newRange, maxPercentage: Number(val) || 100 });
                          }}
                          style={{ width: 100 }}
                        />
                        <Button id="assessment-step-add-range" onClick={handleAddRange} size="sm">
                          Add Range
                        </Button>
                      </Group>
                      {rangeError && (
                        <Alert
                          color={colors.error}
                          variant="light"
                          title={tCommon('error')}
                          mt="xs"
                        >
                          {rangeError}
                        </Alert>
                      )}
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
            id="assessment-step-leave-quota"
            placeholder={tSettings('setupWizardAssessmentLeaveQuotaPlaceholder')}
            value={leaveQuota}
            onChange={handleLeaveQuotaChange}
            min={0}
            style={{ width: 200 }}
          />
        </div>
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button id="assessment-step-back" variant="light" onClick={onBack}>
          Back
        </Button>
        <Button
          id="assessment-step-next"
          onClick={handleNext}
          color={colors.primary}
          disabled={
            data.assessmentTypes.length === 0 ||
            data.gradeTemplates.length === 0 ||
            !resolvedLeaveQuota
          }
        >
          Next
        </Button>
      </Group>
    </Stack>
  );
}

