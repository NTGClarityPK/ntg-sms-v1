'use client';

import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { useTranslations } from 'next-intl';

export interface AcademicYearFormValues {
  name: string;
  startDate: string;
  endDate: string;
}

interface AcademicYearFormProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: AcademicYearFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function AcademicYearForm({ opened, onClose, onSubmit, isSubmitting }: AcademicYearFormProps) {
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');

  const form = useForm<AcademicYearFormValues>({
    initialValues: {
      name: '',
      startDate: '',
      endDate: '',
    },
    validate: {
      name: (value) => (value.trim().length === 0 ? tSettings('academicYearNameRequired') : null),
      startDate: (value) => (!value ? tSettings('academicYearStartDateRequired') : null),
      endDate: (value, values) => {
        if (!value) return tSettings('academicYearEndDateRequired');
        if (values.startDate && value && values.startDate >= value) {
          return tSettings('academicYearEndDateAfterStart');
        }
        return null;
      },
    },
    transformValues: (values) => ({
      name: values.name.trim(),
      startDate: values.startDate,
      endDate: values.endDate,
    }),
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await onSubmit(values);
      form.reset();
      onClose();
      notifications.show({
        title: tCommon('success'),
        message: tSettings('academicYearCreated'),
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({
        title: tCommon('error'),
        message,
        color: notifyColors.error,
      });
    }
  });

  return (
    <Modal opened={opened} onClose={onClose} title={tSettings('academicYearFormTitle')} size="md">
      <form id="academic-year-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            id="academic-year-form-name"
            label={tCommon('name')}
            placeholder={tSettings('academicYearNamePlaceholder')}
            {...form.getInputProps('name')}
          />
          <TextInput
            id="academic-year-form-start-date"
            label={tSettings('academicYearStartDateLabel')}
            type="date"
            {...form.getInputProps('startDate')}
          />
          <TextInput
            id="academic-year-form-end-date"
            label={tSettings('academicYearEndDateLabel')}
            type="date"
            {...form.getInputProps('endDate')}
          />
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button id="academic-year-form-cancel" variant="light" onClick={onClose} disabled={isSubmitting}>
            {tCommon('cancel')}
          </Button>
          <Button id="academic-year-form-submit" type="submit" loading={isSubmitting}>
            {tCommon('save')}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}


