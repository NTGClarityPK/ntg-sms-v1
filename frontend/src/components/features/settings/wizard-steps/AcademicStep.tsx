'use client';

import { Button, Group, Stack, Text, TextInput, NumberInput, MultiSelect } from '@mantine/core';
import { useState } from 'react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { AcademicData } from './types';

interface AcademicStepProps {
  data: AcademicData;
  onChange: (data: AcademicData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function AcademicStep({ data, onChange, onNext, onBack }: AcademicStepProps) {
  const colors = useThemeColors();
  const [newSubject, setNewSubject] = useState({ name: '', code: '', sortOrder: 0 });
  const [newClass, setNewClass] = useState({ name: '', displayName: '', sortOrder: 0 });
  const [newSection, setNewSection] = useState({ name: '', sortOrder: 0 });
  const [newLevel, setNewLevel] = useState({ name: '', classIds: [] as string[] });

  const handleAddSubject = () => {
    if (newSubject.name.trim()) {
      onChange({
        ...data,
        subjects: [...data.subjects, { ...newSubject, name: newSubject.name.trim(), code: newSubject.code.trim() || undefined }],
      });
      setNewSubject({ name: '', code: '', sortOrder: data.subjects.length });
    }
  };

  const handleAddClass = () => {
    if (newClass.name.trim() && newClass.displayName.trim()) {
      onChange({
        ...data,
        classes: [...data.classes, { ...newClass, name: newClass.name.trim(), displayName: newClass.displayName.trim() }],
      });
      setNewClass({ name: '', displayName: '', sortOrder: data.classes.length });
    }
  };

  const handleAddSection = () => {
    if (newSection.name.trim()) {
      onChange({
        ...data,
        sections: [...data.sections, { ...newSection, name: newSection.name.trim() }],
      });
      setNewSection({ name: '', sortOrder: data.sections.length });
    }
  };

  const handleAddLevel = () => {
    if (newLevel.name.trim()) {
      const levelData = {
        name: newLevel.name.trim(),
        sortOrder: data.levels.length,
        classIds: newLevel.classIds,
      };
      onChange({
        ...data,
        levels: [...data.levels, levelData],
        levelClasses: [
          ...data.levelClasses,
          ...newLevel.classIds.map((classId) => ({ levelId: levelData.name, classId })),
        ],
      });
      setNewLevel({ name: '', classIds: [] });
    }
  };

  const handleNext = () => {
    // Validate at least one of each
    if (data.subjects.length === 0 || data.classes.length === 0 || data.sections.length === 0 || data.levels.length === 0) {
      return;
    }
    onNext();
  };

  const classOptions = data.classes.map((c) => ({ value: c.name, label: c.displayName || c.name }));

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        Academic Structure
      </Text>
      <Text size="sm" c="dimmed">
        Configure subjects, classes, sections, and levels for your school.
      </Text>

      <Stack gap="lg" mt="md">
        <div>
          <Text size="sm" fw={500} mb="xs">
            Subjects ({data.subjects.length})
          </Text>
          <Group gap="xs" mb="xs">
            <TextInput
              placeholder="Subject name"
              value={newSubject.name}
              onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
              style={{ flex: 1 }}
            />
            <TextInput
              placeholder="Code (optional)"
              value={newSubject.code}
              onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })}
              style={{ width: 120 }}
            />
            <NumberInput
              placeholder="Order"
              value={newSubject.sortOrder}
              onChange={(val) => setNewSubject({ ...newSubject, sortOrder: Number(val) || 0 })}
              style={{ width: 100 }}
            />
            <Button onClick={handleAddSubject} size="sm">
              Add
            </Button>
          </Group>
          {data.subjects.length > 0 && (
            <Stack gap="xs">
              {data.subjects.map((s, idx) => (
                <Text key={idx} size="sm">
                  {s.name} {s.code && `(${s.code})`}
                </Text>
              ))}
            </Stack>
          )}
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">
            Classes ({data.classes.length})
          </Text>
          <Group gap="xs" mb="xs">
            <TextInput
              placeholder="Class name"
              value={newClass.name}
              onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
              style={{ flex: 1 }}
            />
            <TextInput
              placeholder="Display name"
              value={newClass.displayName}
              onChange={(e) => setNewClass({ ...newClass, displayName: e.target.value })}
              style={{ flex: 1 }}
            />
            <NumberInput
              placeholder="Order"
              value={newClass.sortOrder}
              onChange={(val) => setNewClass({ ...newClass, sortOrder: Number(val) || 0 })}
              style={{ width: 100 }}
            />
            <Button onClick={handleAddClass} size="sm">
              Add
            </Button>
          </Group>
          {data.classes.length > 0 && (
            <Stack gap="xs">
              {data.classes.map((c, idx) => (
                <Text key={idx} size="sm">
                  {c.displayName || c.name}
                </Text>
              ))}
            </Stack>
          )}
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">
            Sections ({data.sections.length})
          </Text>
          <Group gap="xs" mb="xs">
            <TextInput
              placeholder="Section name"
              value={newSection.name}
              onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
              style={{ flex: 1 }}
            />
            <NumberInput
              placeholder="Order"
              value={newSection.sortOrder}
              onChange={(val) => setNewSection({ ...newSection, sortOrder: Number(val) || 0 })}
              style={{ width: 100 }}
            />
            <Button onClick={handleAddSection} size="sm">
              Add
            </Button>
          </Group>
          {data.sections.length > 0 && (
            <Stack gap="xs">
              {data.sections.map((s, idx) => (
                <Text key={idx} size="sm">
                  {s.name}
                </Text>
              ))}
            </Stack>
          )}
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">
            Levels ({data.levels.length})
          </Text>
          <Group gap="xs" mb="xs" align="flex-end">
            <TextInput
              placeholder="Level name"
              value={newLevel.name}
              onChange={(e) => setNewLevel({ ...newLevel, name: e.target.value })}
              style={{ flex: 1 }}
            />
            <MultiSelect
              placeholder="Assign classes"
              data={classOptions}
              value={newLevel.classIds}
              onChange={(val) => setNewLevel({ ...newLevel, classIds: val })}
              style={{ flex: 1 }}
            />
            <Button onClick={handleAddLevel} size="sm">
              Add
            </Button>
          </Group>
          {data.levels.length > 0 && (
            <Stack gap="xs">
              {data.levels.map((l, idx) => (
                <Text key={idx} size="sm">
                  {l.name} - Classes: {l.classIds.length}
                </Text>
              ))}
            </Stack>
          )}
        </div>
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button variant="light" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} color={colors.primary} disabled={data.subjects.length === 0 || data.classes.length === 0 || data.sections.length === 0 || data.levels.length === 0}>
          Next
        </Button>
      </Group>
    </Stack>
  );
}

