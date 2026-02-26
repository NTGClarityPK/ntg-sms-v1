'use client';

import { useEffect, useMemo } from 'react';
import { Modal, Select, NumberInput, Button, Stack, Switch, Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useCreateClassSection, useUpdateClassSection } from '@/hooks/useClassSections';
import type { ClassSection } from '@/types/class-sections';
import { useClasses } from '@/hooks/useCoreLookups';
import { useSections } from '@/hooks/useCoreLookups';

interface CreateClassSectionModalProps {
  opened: boolean;
  onClose: () => void;
  classSection?: ClassSection | null;
  initialClassId?: string | null;
  initialSectionId?: string | null;
}

export function CreateClassSectionModal({
  opened,
  onClose,
  classSection,
  initialClassId,
  initialSectionId,
}: CreateClassSectionModalProps) {
  const t = useTranslations('class');
  const createClassSectionSchema = useMemo(
    () =>
      z.object({
        classId: z.string().min(1, t('classRequired')),
        sectionId: z.string().min(1, t('sectionRequired')),
        capacity: z.number().min(1, t('capacityMin')).optional(),
        isActive: z.boolean().optional(),
      }),
    [t],
  );
  const isEdit = !!classSection;
  const createClassSection = useCreateClassSection();
  const updateClassSection = useUpdateClassSection();
  const { data: classesData } = useClasses();
  const { data: sectionsData } = useSections();

  const classes = classesData?.data || [];
  const sections = sectionsData?.data || [];

  const form = useForm({
    initialValues: {
      classId: '',
      sectionId: '',
      capacity: undefined as number | undefined,
      isActive: true,
    },
    validate: zodResolver(createClassSectionSchema),
  });

  // Reset form when classSection prop changes (for edit mode) or when modal opens with initial values
  useEffect(() => {
    if (classSection) {
      form.setValues({
        classId: classSection.classId,
        sectionId: classSection.sectionId,
        capacity: classSection.capacity,
        isActive: classSection.isActive,
      });
    } else if (opened && initialClassId && initialSectionId) {
      // Pre-populate with initial values when creating from a specific card
      form.setValues({
        classId: initialClassId,
        sectionId: initialSectionId,
        capacity: undefined,
        isActive: true,
      });
    } else if (!opened) {
      // Reset when modal closes
      form.reset();
    }
  }, [classSection, opened, initialClassId, initialSectionId]);

  const handleSubmit = async (values: typeof form.values) => {
    if (isEdit) {
      await updateClassSection.mutateAsync({
        id: classSection!.id,
        input: {
          ...(values.capacity != null && values.capacity > 0 && { capacity: values.capacity }),
          isActive: values.isActive,
        },
      });
    } else {
      await createClassSection.mutateAsync({
        classId: values.classId,
        sectionId: values.sectionId,
        ...(values.capacity != null && values.capacity > 0 && { capacity: values.capacity }),
      });
    }
    form.reset();
    onClose();
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const classOptions = classes.map((c) => ({
    value: c.id,
    label: c.displayName || c.name,
  }));

  const sectionOptions = sections.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={isEdit ? t('editClassSection') : t('createClassSection')}
      size="md"
    >
      <form id="create-class-section-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {!isEdit && (
            <>
              <Select
                id="create-class-section-class"
                label={t('classLabel')}
                placeholder={t('selectClass')}
                data={classOptions}
                required
                {...form.getInputProps('classId')}
              />
              <Select
                id="create-class-section-section"
                label={t('sectionLabel')}
                placeholder={t('selectSection')}
                data={sectionOptions}
                required
                {...form.getInputProps('sectionId')}
              />
            </>
          )}
          <NumberInput
            id="create-class-section-capacity"
            label={t('capacityOptional')}
            placeholder={t('capacityPlaceholder')}
            min={1}
            {...form.getInputProps('capacity')}
          />
          <Switch
            id="create-class-section-active"
            label={t('active')}
            {...form.getInputProps('isActive', { type: 'checkbox' })}
          />
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button id="create-class-section-cancel" variant="subtle" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button
            id="create-class-section-submit"
            type="submit"
            loading={createClassSection.isPending || updateClassSection.isPending}
          >
            {isEdit ? t('update') : t('create')}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

