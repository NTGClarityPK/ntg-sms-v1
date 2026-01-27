'use client';

import { Button, Checkbox, Group, Stack, Text, TextInput, NumberInput } from '@mantine/core';
import { useState } from 'react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { ScheduleData } from './types';

interface ScheduleStepProps {
  data: ScheduleData;
  onChange: (data: ScheduleData) => void;
  onNext: () => void;
  onBack: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function ScheduleStep({ data, onChange, onNext, onBack }: ScheduleStepProps) {
  const colors = useThemeColors();
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    startTime: '08:00',
    endTime: '14:00',
    periodDurationMinutes: 45,
  });

  const handleToggleDay = (dayOfWeek: number) => {
    const existing = data.schoolDays.find((d) => d.dayOfWeek === dayOfWeek);
    if (existing) {
      onChange({
        ...data,
        schoolDays: data.schoolDays.filter((d) => d.dayOfWeek !== dayOfWeek),
      });
    } else {
      onChange({
        ...data,
        schoolDays: [...data.schoolDays, { dayOfWeek, isActive: true }],
      });
    }
  };

  const handleAddTemplate = () => {
    if (newTemplate.name.trim()) {
      onChange({
        ...data,
        timingTemplates: [
          ...data.timingTemplates,
          {
            ...newTemplate,
            name: newTemplate.name.trim(),
            slots: [],
            classIds: [],
          },
        ],
      });
      setNewTemplate({ name: '', startTime: '08:00', endTime: '14:00', periodDurationMinutes: 45 });
    }
  };

  const handleNext = () => {
    if (data.schoolDays.length === 0 || data.timingTemplates.length === 0) {
      return;
    }
    onNext();
  };

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        Schedule Settings
      </Text>
      <Text size="sm" c="dimmed">
        Configure school days and timing templates.
      </Text>

      <Stack gap="lg" mt="md">
        <div>
          <Text size="sm" fw={500} mb="xs">
            School Days
          </Text>
          <Group gap="md">
            {DAYS_OF_WEEK.map((day) => {
              const isActive = data.schoolDays.some((d) => d.dayOfWeek === day.value);
              return (
                <Checkbox
                  key={day.value}
                  label={day.label}
                  checked={isActive}
                  onChange={() => handleToggleDay(day.value)}
                />
              );
            })}
          </Group>
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">
            Timing Templates ({data.timingTemplates.length})
          </Text>
          <Group gap="xs" mb="xs" align="flex-end">
            <TextInput
              placeholder="Template name"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              style={{ flex: 1 }}
            />
            <TextInput
              label="Start"
              type="time"
              value={newTemplate.startTime}
              onChange={(e) => setNewTemplate({ ...newTemplate, startTime: e.target.value })}
              style={{ width: 120 }}
            />
            <TextInput
              label="End"
              type="time"
              value={newTemplate.endTime}
              onChange={(e) => setNewTemplate({ ...newTemplate, endTime: e.target.value })}
              style={{ width: 120 }}
            />
            <NumberInput
              label="Period (min)"
              value={newTemplate.periodDurationMinutes}
              onChange={(val) => setNewTemplate({ ...newTemplate, periodDurationMinutes: Number(val) || 45 })}
              style={{ width: 120 }}
            />
            <Button onClick={handleAddTemplate} size="sm">
              Add
            </Button>
          </Group>
          {data.timingTemplates.length > 0 && (
            <Stack gap="xs">
              {data.timingTemplates.map((t, idx) => (
                <Text key={idx} size="sm">
                  {t.name} ({t.startTime} - {t.endTime}, {t.periodDurationMinutes} min)
                </Text>
              ))}
            </Stack>
          )}
        </div>
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button variant="light" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} color={colors.primary} disabled={data.schoolDays.length === 0 || data.timingTemplates.length === 0}>
          Next
        </Button>
      </Group>
    </Stack>
  );
}

