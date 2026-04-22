'use client';

import { Modal, Select, Button, Stack, Group, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslations } from 'next-intl';
import { useAssignClassTeacher } from '@/hooks/useClassSections';
import type { ClassSection } from '@/types/class-sections';
import { useStaff } from '@/hooks/useStaff';

interface AssignClassTeacherModalProps {
  opened: boolean;
  onClose: () => void;
  classSection: ClassSection;
}

export function AssignClassTeacherModal({
  opened,
  onClose,
  classSection,
}: AssignClassTeacherModalProps) {
  const t = useTranslations('class');
  const tCommon = useTranslations('common');
  const assignClassTeacher = useAssignClassTeacher();
  const { data: staffData } = useStaff();
  const staffResponse = staffData as
    | {
        data?: Array<{
          id: string;
          fullName?: string | null;
          employeeId?: string | null;
          isActive: boolean;
          roles?: Array<{ roleName: string }>;
        }>;
      }
    | null
    | undefined;
  const staff = staffResponse?.data || [];

  // Only allow staff who have the class_teacher role and are active
  const availableStaff = staff.filter(
    (s) => s.isActive && s.roles?.some((r: any) => r.roleName === 'class_teacher'),
  );

  const form = useForm({
    initialValues: {
      staffId: classSection.classTeacherId || null,
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    await assignClassTeacher.mutateAsync({
      id: classSection.id,
      input: {
        staffId: values.staffId ?? null,
      },
    });
    form.reset();
    onClose();
  };

  const staffOptions = availableStaff.map((s) => ({
    value: s.id,
    label: s.fullName || s.employeeId || 'Unknown',
  }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('assignClassTeacherTitle')}
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Select
            searchable
            clearable
            nothingFoundMessage={tCommon('notFound')}
            label={t('classTeacher')}
            placeholder={t('noneUnassign')}
            data={staffOptions}
            {...form.getInputProps('staffId')}
          />
          {classSection.classTeacherName && (
            <Text size="sm" c="dimmed">
              {t('currentTeacher', { name: classSection.classTeacherName })}
            </Text>
          )}
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" loading={assignClassTeacher.isPending}>
            {form.values.staffId ? t('assign') : t('unassign')}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

