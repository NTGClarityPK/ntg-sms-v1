'use client';

import { Modal, Select, NumberInput, Textarea, Button, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useEffect } from 'react';
import { useUniforms } from '@/hooks/useInventory';
import { useDirectIssuance } from '@/hooks/useUniformIssuances';
import { useStudents } from '@/hooks/useStudents';
import type { UniformItem } from '@/types/inventory';

const schema = z.object({
  studentId: z.string().min(1, 'Select a student'),
  uniformItemId: z.string().min(1, 'Select an item'),
  size: z.string().min(1, 'Select size'),
  quantity: z.number().min(1, 'At least 1'),
  notes: z.string().optional(),
});

interface DirectIssueModalProps {
  opened: boolean;
  onClose: () => void;
}

export function DirectIssueModal({ opened, onClose }: DirectIssueModalProps) {
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
    <Modal opened={opened} onClose={onClose} title="Direct issuance">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Select
            label="Student"
            placeholder="Select student"
            data={students.map((s) => ({
              value: s.id,
              label: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.studentId || s.id,
            }))}
            searchable
            {...form.getInputProps('studentId')}
          />
          <Select
            label="Item"
            placeholder="Select item"
            data={uniforms.map((u) => ({ value: u.id, label: u.name }))}
            {...form.getInputProps('uniformItemId')}
            onChange={(v) => {
              form.setFieldValue('uniformItemId', v ?? '');
              form.setFieldValue('size', '');
            }}
          />
          <Select
            label="Size"
            placeholder="Select size"
            data={sizes.map((s) => ({ value: s, label: s }))}
            {...form.getInputProps('size')}
          />
          <NumberInput
            label="Quantity"
            min={1}
            {...form.getInputProps('quantity')}
          />
          <Textarea
            label="Notes (optional)"
            {...form.getInputProps('notes')}
          />
          <Button
            type="submit"
            loading={directIssueMutation.isPending}
          >
            Issue
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
