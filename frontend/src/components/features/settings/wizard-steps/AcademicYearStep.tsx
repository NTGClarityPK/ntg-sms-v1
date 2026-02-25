'use client';

import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { AcademicYearData } from './types';

interface AcademicYearStepProps {
  data: AcademicYearData | null;
  onChange: (data: AcademicYearData) => void;
  onNext: () => void;
}

export function AcademicYearStep({ data, onChange, onNext }: AcademicYearStepProps) {
  const colors = useThemeColors();

  const form = useForm<AcademicYearData>({
    initialValues: data || {
      name: '',
      startDate: '',
      endDate: '',
    },
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Name is required' : null),
      startDate: (value) => (!value ? 'Start date is required' : null),
      endDate: (value, values) => {
        if (!value) return 'End date is required';
        if (values.startDate && value && values.startDate >= value) {
          return 'End date must be after start date';
        }
        return null;
      },
    },
  });

  const handleNext = () => {
    if (form.validate().hasErrors) return;
    onChange(form.values);
    onNext();
  };

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        Academic Year Activation
      </Text>
      <Text size="sm" c="dimmed">
        Create and activate an academic year for your school. This will be the active year used throughout the system.
      </Text>

      <form id="wizard-academic-year-form" onSubmit={form.onSubmit(handleNext)}>
        <Stack gap="md">
          <TextInput
            id="wizard-academic-year-name"
            label="Academic Year Name"
            placeholder="2025-2026"
            required
            {...form.getInputProps('name')}
          />
          <TextInput
            id="wizard-academic-year-start"
            label="Start Date"
            type="date"
            required
            {...form.getInputProps('startDate')}
          />
          <TextInput
            id="wizard-academic-year-end"
            label="End Date"
            type="date"
            required
            {...form.getInputProps('endDate')}
          />
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button id="wizard-academic-year-next" onClick={handleNext} color={colors.primary}>
            Next
          </Button>
        </Group>
      </form>
    </Stack>
  );
}


