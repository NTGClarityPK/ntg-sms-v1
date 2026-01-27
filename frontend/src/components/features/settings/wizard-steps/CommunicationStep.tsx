'use client';

import { Button, Group, SegmentedControl, Stack, Text } from '@mantine/core';
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
    teacherStudent: 'both' as const,
    teacherParent: 'both' as const,
  };

  const handleTeacherStudentChange = (value: string | null) => {
    if (!value) return;
    onChange({ ...formData, teacherStudent: value as CommunicationData['teacherStudent'] });
  };

  const handleTeacherParentChange = (value: string | null) => {
    if (!value) return;
    onChange({ ...formData, teacherParent: value as CommunicationData['teacherParent'] });
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
          <SegmentedControl
            value={formData.teacherStudent}
            onChange={handleTeacherStudentChange}
            data={[
              { value: 'teacher_only', label: 'Teacher only' },
              { value: 'both', label: 'Both ways' },
            ]}
            fullWidth
          />
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">
            Teacher ↔ Parent Messaging
          </Text>
          <SegmentedControl
            value={formData.teacherParent}
            onChange={handleTeacherParentChange}
            data={[
              { value: 'teacher_only', label: 'Teacher only' },
              { value: 'both', label: 'Both ways' },
            ]}
            fullWidth
          />
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

