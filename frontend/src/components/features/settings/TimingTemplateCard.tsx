'use client';

import { Badge, Button, Card, Group, MultiSelect, Stack, Text } from '@mantine/core';
import type { ClassEntity, TimingTemplate } from '@/types/settings';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useEffect, useMemo, useState } from 'react';

interface TimingTemplateCardProps {
  template: TimingTemplate;
  classes: ClassEntity[];
  unavailableClassIds: string[];
  isSavingAssignments: boolean;
  onAssignClasses: (templateId: string, classIds: string[]) => Promise<void>;
}

export function TimingTemplateCard({
  template,
  classes,
  unavailableClassIds,
  isSavingAssignments,
  onAssignClasses,
}: TimingTemplateCardProps) {
  const colors = useThemeColors();
  const [selected, setSelected] = useState<string[]>(template.assignedClassIds);

  useEffect(() => {
    setSelected(template.assignedClassIds);
  }, [template.assignedClassIds]);

  const options = useMemo(() => {
    const unavailableSet = new Set(unavailableClassIds);
    const sortedClasses = [...classes].sort((a, b) => 
      a.displayName.localeCompare(b.displayName)
    );
    return sortedClasses
      .filter((c) => !unavailableSet.has(c.id) || selected.includes(c.id))
      .map((c) => ({
        value: c.id,
        label: c.displayName,
      }));
  }, [classes, selected, unavailableClassIds]);

  const handleSelectionChange = (nextSelected: string[]) => {
    const unavailableSet = new Set(unavailableClassIds);
    const safeSelection = nextSelected.filter(
      (classId) => !unavailableSet.has(classId) || selected.includes(classId),
    );
    setSelected(safeSelection);
  };

  const hasChanges =
    selected.length !== template.assignedClassIds.length ||
    selected.some((id) => !template.assignedClassIds.includes(id));

  return (
    <Card withBorder p="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs">
          <Text fw={600}>{template.name}</Text>
          <Text c="dimmed" size="sm">
            {template.startTime} → {template.endTime} • {template.periodDurationMinutes} min
          </Text>
          {template.slots && template.slots.length > 0 && (
            <Group gap="xs" mt="xs">
              {template.slots.map((slot) => (
                <Badge key={slot.id} variant="dot" size="sm">
                  {slot.name}
                  {slot.startTime && slot.endTime && ` (${slot.startTime} - ${slot.endTime})`}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
        <Badge variant="light" color={colors.info}>
          {template.assignedClassIds.length} classes
        </Badge>
      </Group>

      <Stack gap="sm" mt="md">
        <MultiSelect
          id={`timing-template-card-${template.id}-classes`}
          label="Assigned classes"
          data={options}
          value={selected}
          onChange={handleSelectionChange}
          searchable
          placeholder="Select classes"
        />
        <Group justify="flex-end">
          <Button
            id={`timing-template-card-${template.id}-save`}
            variant="light"
            disabled={!hasChanges}
            loading={isSavingAssignments}
            onClick={() => onAssignClasses(template.id, selected)}
          >
            Save assignments
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}


