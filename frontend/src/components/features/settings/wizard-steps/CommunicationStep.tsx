'use client';

import { Button, Checkbox, Group, Stack, Text } from '@mantine/core';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { CommunicationData } from './types';

interface CommunicationStepProps {
  data: CommunicationData | null;
  onChange: (data: CommunicationData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function CommunicationStep({ data, onChange, onNext, onBack }: CommunicationStepProps) {
  const colors = useThemeColors();

  const formData = data || {
    teacherStudent: 'none' as const,
    teacherParent: 'none' as const,
  };

  const teacherCanSendToStudent = formData.teacherStudent === 'teacher_only' || formData.teacherStudent === 'both';
  const teacherCanSendToParent = formData.teacherParent === 'teacher_only' || formData.teacherParent === 'both';

  const handleTeacherStudentChange = (checked: boolean) => {
    onChange({
      ...formData,
      teacherStudent: checked ? 'teacher_only' : 'none',
    });
  };

  const handleTeacherParentChange = (checked: boolean) => {
    onChange({
      ...formData,
      teacherParent: checked ? 'teacher_only' : 'none',
    });
  };

  const handleNext = () => {
    onChange(formData);
    onNext();
  };

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        Communication Settings
      </Text>
      <Text size="sm" c="dimmed">
        Configure messaging directions between teachers, students, and parents.
      </Text>

      <Stack gap="lg" mt="md">
        <div>
          <Text size="sm" fw={500} mb="xs">
            Teacher ↔ Student Messaging
          </Text>
          <Stack gap="xs">
            <Checkbox
              label="Teacher can send to student"
              checked={teacherCanSendToStudent}
              onChange={(e) => handleTeacherStudentChange(e.currentTarget.checked)}
            />
          </Stack>
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">
            Teacher ↔ Parent Messaging
          </Text>
          <Stack gap="xs">
            <Checkbox
              label="Teacher can send to parent"
              checked={teacherCanSendToParent}
              onChange={(e) => handleTeacherParentChange(e.currentTarget.checked)}
            />
          </Stack>
        </div>
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button variant="light" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} color={colors.primary}>
          Next
        </Button>
      </Group>
    </Stack>
  );
}

