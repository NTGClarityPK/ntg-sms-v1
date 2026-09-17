'use client';

import { useEffect } from 'react';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslations } from 'next-intl';
import type { AcademicYear } from '@/types/settings';

export interface AcademicYearDatesFormValues {
  startDate: string;
  endDate: string;
}

interface EditAcademicYearDatesModalProps {
  opened: boolean;
  year: AcademicYear | null;
  onClose: () => void;
  onSubmit: (values: AcademicYearDatesFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function EditAcademicYearDatesModal({
  opened,
  year,
  onClose,
  onSubmit,
  isSubmitting,
}: EditAcademicYearDatesModalProps) {
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');

  const form = useForm<AcademicYearDatesFormValues>({
    initialValues: {
      startDate: '',
      endDate: '',
    },
    validate: {
      startDate: (value) => (!value ? tSettings('academicYearStartDateRequired') : null),
      endDate: (value, values) => {
        if (!value) return tSettings('academicYearEndDateRequired');
        if (values.startDate && value && values.startDate >= value) {
          return tSettings('academicYearEndDateAfterStart');
        }
        return null;
      },
    },
  });

  useEffect(() => {
    if (!year || !opened) return;
    form.setValues({
      startDate: year.startDate,
      endDate: year.endDate,
    });
    form.clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when modal opens for a year
  }, [year?.id, opened]);

  const handleSubmit = form.onSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={tSettings('academicYearEditDatesTitle')}
      size="md"
    >
      <form id="academic-year-edit-dates-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {tSettings('academicYearEditDatesHelp', { name: year?.name ?? '' })}
          </Text>
          <TextInput
            id="academic-year-edit-name"
            label={tCommon('name')}
            value={year?.name ?? ''}
            disabled
          />
          <TextInput
            id="academic-year-edit-start-date"
            label={tSettings('academicYearStartDateLabel')}
            type="date"
            {...form.getInputProps('startDate')}
          />
          <TextInput
            id="academic-year-edit-end-date"
            label={tSettings('academicYearEndDateLabel')}
            type="date"
            {...form.getInputProps('endDate')}
          />
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button
            id="academic-year-edit-dates-cancel"
            variant="light"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            id="academic-year-edit-dates-submit"
            type="submit"
            loading={isSubmitting}
          >
            {tCommon('save')}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
