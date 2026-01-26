'use client';

import { useEffect } from 'react';
import { Modal, Select, NumberInput, Button, Stack, Switch, Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useCreateClassSection, useUpdateClassSection } from '@/hooks/useClassSections';
import type { ClassSection } from '@/types/class-sections';
import { useClasses } from '@/hooks/useCoreLookups';
import { useSections } from '@/hooks/useCoreLookups';

const createClassSectionSchema = z.object({
  classId: z.string().min(1, 'Class is required'),
  sectionId: z.string().min(1, 'Section is required'),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  isActive: z.boolean().optional(),
});

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
      capacity: 30,
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
        capacity: 30,
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
          capacity: values.capacity,
          isActive: values.isActive,
        },
      });
    } else {
      await createClassSection.mutateAsync({
        classId: values.classId,
        sectionId: values.sectionId,
        capacity: values.capacity,
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
      title={isEdit ? 'Edit Class Section' : 'Create Class Section'}
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {!isEdit && (
            <>
              <Select
                label="Class"
                placeholder="Select class"
                data={classOptions}
                required
                {...form.getInputProps('classId')}
              />
              <Select
                label="Section"
                placeholder="Select section"
                data={sectionOptions}
                required
                {...form.getInputProps('sectionId')}
              />
            </>
          )}
          <NumberInput
            label="Capacity"
            placeholder="Enter capacity"
            min={1}
            required
            {...form.getInputProps('capacity')}
          />
          <Switch
            label="Active"
            {...form.getInputProps('isActive', { type: 'checkbox' })}
          />
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createClassSection.isPending || updateClassSection.isPending}
          >
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

