'use client';

import { ActionIcon, Button, Group, Stack, Text, TextInput, NumberInput, MultiSelect } from '@mantine/core';
import { useState } from 'react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { AcademicData } from './types';
import { IconX } from '@tabler/icons-react';

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

  const removeSubject = (index: number) => {
    onChange({
      ...data,
      subjects: data.subjects.filter((_, i) => i !== index),
    });
  };

  const removeClass = (index: number) => {
    const classNameToRemove = data.classes[index]?.name;

    onChange({
      ...data,
      classes: data.classes.filter((_, i) => i !== index),
      levels: data.levels.map((lvl) => ({
        ...lvl,
        classIds: lvl.classIds.filter((cn) => cn !== classNameToRemove),
      })),
      levelClasses: data.levelClasses.filter((lc) => lc.classId !== classNameToRemove),
    });
  };

  const removeSection = (index: number) => {
    onChange({
      ...data,
      sections: data.sections.filter((_, i) => i !== index),
    });
  };

  const removeLevel = (index: number) => {
    const levelNameToRemove = data.levels[index]?.name;

    onChange({
      ...data,
      levels: data.levels.filter((_, i) => i !== index),
      levelClasses: data.levelClasses.filter((lc) => lc.levelId !== levelNameToRemove),
    });
  };

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

  // Classes already assigned to an existing level should not be available for new levels
  const assignedClassNames = new Set<string>();
  data.levels.forEach((lvl) => {
    lvl.classIds.forEach((name) => assignedClassNames.add(name));
  });

  const classOptions = data.classes
    .filter((c) => !assignedClassNames.has(c.name))
    .map((c) => ({ value: c.name, label: c.displayName || c.name }));

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
                <Group key={`${s.name}-${s.code ?? ''}-${idx}`} justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="sm">
                    {s.name} {s.code && `(${s.code})`}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color={colors.error}
                    onClick={() => removeSubject(idx)}
                    aria-label={`Remove subject ${s.name}`}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
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
                <Group key={`${c.name}-${idx}`} justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="sm">{c.displayName || c.name}</Text>
                  <ActionIcon
                    variant="subtle"
                    color={colors.error}
                    onClick={() => removeClass(idx)}
                    aria-label={`Remove class ${c.displayName || c.name}`}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
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
                <Group key={`${s.name}-${idx}`} justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="sm">{s.name}</Text>
                  <ActionIcon
                    variant="subtle"
                    color={colors.error}
                    onClick={() => removeSection(idx)}
                    aria-label={`Remove section ${s.name}`}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
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
                <Group key={`${l.name}-${idx}`} justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="sm">
                    {l.name} - Classes: {l.classIds.length}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color={colors.error}
                    onClick={() => removeLevel(idx)}
                    aria-label={`Remove level ${l.name}`}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
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


