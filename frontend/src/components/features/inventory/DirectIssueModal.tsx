'use client';

import { Modal, Select, NumberInput, Textarea, Button, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useUniforms } from '@/hooks/useInventory';
import { useDirectIssuance } from '@/hooks/useUniformIssuances';
import { useStudents } from '@/hooks/useStudents';
import type { UniformItem } from '@/types/inventory';

interface DirectIssueModalProps {
  opened: boolean;
  onClose: () => void;
}

export function DirectIssueModal({ opened, onClose }: DirectIssueModalProps) {
  const t = useTranslations('inventory');
  const schema = useMemo(
    () =>
      z.object({
        studentId: z.string().min(1, t('selectStudentRequired')),
        uniformItemId: z.string().min(1, t('selectItemRequired')),
        size: z.string().min(1, t('selectSizeRequired')),
        quantity: z.number().min(1, t('quantityMinOne')),
        notes: z.string().optional(),
      }),
    [t],
  );
  const directIssueMutation = useDirectIssuance();
  const { data: uniformsResponse } = useUniforms({ page: 1, limit: 200 });
  const { data: studentsData } = useStudents({ page: 1, limit: 500 });

  const uniforms = (uniformsResponse as { data?: UniformItem[] })?.data ?? [];
  const students = studentsData?.data ?? [];

  const form = useForm({
    initialValues: {
      studentId: '',
      uniformItemId: '',
      size: '',
      quantity: 1,
      notes: '',
    },
    validate: zodResolver(schema),
  });

  useEffect(() => {
    if (opened) form.reset();
  }, [opened]);

  const sizes =
    uniforms.find((u) => u.id === form.values.uniformItemId)?.stock?.map(
      (s) => s.size,
    ) ?? [];

  const handleSubmit = (values: typeof form.values) => {
    directIssueMutation.mutate(
      {
        studentId: values.studentId,
        uniformItemId: values.uniformItemId,
        size: values.size,
        quantity: values.quantity,
        notes: values.notes.trim() || undefined,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t('directIssuanceTitle')}>
      <form id="direct-issue-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Select
            id="direct-issue-student"
            label={t('student')}
            placeholder={t('selectStudent')}
            data={students.map((s) => ({
              value: s.id,
              label: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.studentId || s.id,
            }))}
            searchable
            {...form.getInputProps('studentId')}
          />
          <Select
            id="direct-issue-item"
            label={t('items')}
            placeholder={t('selectItem')}
            data={uniforms.map((u) => ({ value: u.id, label: u.name }))}
            {...form.getInputProps('uniformItemId')}
            onChange={(v) => {
              form.setFieldValue('uniformItemId', v ?? '');
              form.setFieldValue('size', '');
            }}
          />
          <Select
            id="direct-issue-size"
            label={t('size')}
            placeholder={t('selectSizeRequired')}
            data={sizes.map((s) => ({ value: s, label: s }))}
            {...form.getInputProps('size')}
          />
          <NumberInput
            id="direct-issue-quantity"
            label={t('quantity')}
            min={1}
            {...form.getInputProps('quantity')}
          />
          <Textarea
            id="direct-issue-notes"
            label={t('notesOptional')}
            {...form.getInputProps('notes')}
          />
          <Button
            id="direct-issue-submit"
            type="submit"
            loading={directIssueMutation.isPending}
          >
            {t('issue')}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
