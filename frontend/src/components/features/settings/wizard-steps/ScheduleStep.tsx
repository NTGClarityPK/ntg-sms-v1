'use client';

import { ActionIcon, Button, Checkbox, Divider, Group, Paper, Stack, Text, TextInput, NumberInput } from '@mantine/core';
import { useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { ScheduleData } from './types';

interface ScheduleStepProps {
  data: ScheduleData;
  onChange: (data: ScheduleData) => void;
  onNext: () => void;
  onBack: () => void;
}

interface TimingSlot {
  name: string;
  startTime: string;
  endTime: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function ScheduleStep({ data, onChange, onNext, onBack }: ScheduleStepProps) {
  const colors = useThemeColors();
  
  // State for the main timing template
  const [templateName, setTemplateName] = useState('Primary Morning Schedule');
  const [schoolStartTime, setSchoolStartTime] = useState('08:00');
  const [schoolEndTime, setSchoolEndTime] = useState('14:00');
  const [periodDuration, setPeriodDuration] = useState(60);
  
  // State for slots
  const [slots, setSlots] = useState<TimingSlot[]>([]);
  const [newSlot, setNewSlot] = useState({ name: '', startTime: '', endTime: '' });

  const handleToggleDay = (dayOfWeek: number) => {
    const existing = data.schoolDays.find((d) => d.dayOfWeek === dayOfWeek);
    if (existing) {
      onChange({
        ...data,
        schoolDays: data.schoolDays.filter((d) => d.dayOfWeek !== dayOfWeek),
      });
    } else {
      onChange({
        ...data,
        schoolDays: [...data.schoolDays, { dayOfWeek, isActive: true }],
      });
    }
  };

  const handleAddSlot = () => {
    if (newSlot.name.trim()) {
      setSlots([...slots, { ...newSlot, name: newSlot.name.trim() }]);
      setNewSlot({ name: '', startTime: '', endTime: '' });
    }
  };

  const handleRemoveSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (data.schoolDays.length === 0) {
      return;
    }
    
    if (!templateName.trim() || !schoolStartTime || !schoolEndTime) {
      return;
    }

    // Validate end time > start time
    if (schoolStartTime >= schoolEndTime) {
      return;
    }

    // Build the timing template with slots
    const timingTemplate = {
      name: templateName.trim(),
      startTime: schoolStartTime,
      endTime: schoolEndTime,
      periodDurationMinutes: periodDuration,
      slots: slots.map((slot, idx) => ({
        name: slot.name,
        startTime: slot.startTime || '',
        endTime: slot.endTime || '',
        sortOrder: idx,
      })),
      classIds: [],
    };

    // Update data with the timing template
    onChange({
      ...data,
      timingTemplates: [timingTemplate],
    });

    onNext();
  };

  const isNextDisabled = 
    data.schoolDays.length === 0 || 
    !templateName.trim() || 
    !schoolStartTime || 
    !schoolEndTime ||
    schoolStartTime >= schoolEndTime;

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        Schedule Settings
      </Text>
      <Text size="sm" c="dimmed">
        Configure school days and timing template.
      </Text>

      <Stack gap="lg" mt="md">
        {/* School Days Section */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            School Days
          </Text>
          <Group gap="md">
            {DAYS_OF_WEEK.map((day) => {
              const isActive = data.schoolDays.some((d) => d.dayOfWeek === day.value);
              return (
                <Checkbox
                  key={day.value}
                  label={day.label}
                  checked={isActive}
                  onChange={() => handleToggleDay(day.value)}
                />
              );
            })}
          </Group>
        </div>

        <Divider />

        {/* Timing Template Section */}
        <div>
          <Text size="sm" fw={500} mb="md">
            Timing Template
          </Text>
          
          <Stack gap="md">
            {/* Template Name */}
            <TextInput
              label="Name"
              placeholder="Primary Morning Schedule"
              value={templateName}
              onChange={(e) => setTemplateName(e.currentTarget.value)}
              required
            />

            {/* School Start/End Time */}
            <Group grow>
              <TextInput
                label="School start time"
                type="time"
                value={schoolStartTime}
                onChange={(e) => setSchoolStartTime(e.currentTarget.value)}
                required
              />
              <TextInput
                label="School end time"
                type="time"
                value={schoolEndTime}
                onChange={(e) => setSchoolEndTime(e.currentTarget.value)}
                error={schoolStartTime >= schoolEndTime ? 'End time must be after start time' : null}
                required
              />
            </Group>

            {/* Period Duration */}
            <NumberInput
              label="Period duration (minutes)"
              value={periodDuration}
              min={1}
              onChange={(val) => setPeriodDuration(Number(val) || 60)}
              required
            />

            <Divider my="sm" />

            {/* Slots Section */}
            <Group justify="space-between" align="center">
              <Text fw={500}>Slots (Assembly, Break, etc.)</Text>
              <Button 
                size="compact-sm" 
                leftSection={<IconPlus size={16} />} 
                onClick={handleAddSlot}
                variant="light"
                disabled={!newSlot.name.trim()}
              >
                Add Slot
              </Button>
            </Group>

            {/* Add Slot Form */}
            <Paper withBorder p="sm" bg="gray.0">
              <Stack gap="xs">
                <TextInput
                  placeholder="Slot name (e.g., Assembly, Break, Lunch)"
                  value={newSlot.name}
                  onChange={(e) => setNewSlot({ ...newSlot, name: e.currentTarget.value })}
                />
                <Group grow>
                  <TextInput
                    placeholder="Start time (optional)"
                    type="time"
                    value={newSlot.startTime}
                    onChange={(e) => setNewSlot({ ...newSlot, startTime: e.currentTarget.value })}
                  />
                  <TextInput
                    placeholder="End time (optional)"
                    type="time"
                    value={newSlot.endTime}
                    onChange={(e) => setNewSlot({ ...newSlot, endTime: e.currentTarget.value })}
                  />
                </Group>
              </Stack>
            </Paper>

            {/* Display Added Slots */}
            {slots.length === 0 ? (
              <Text size="sm" c="dimmed">
                No slots added yet. Click "Add Slot" to add custom slots like Assembly, Break, Lunch, etc.
              </Text>
            ) : (
              <Stack gap="sm">
                {slots.map((slot, index) => (
                  <Paper key={index} withBorder p="sm">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Text size="sm" fw={500}>{slot.name}</Text>
                        {(slot.startTime || slot.endTime) && (
                          <Text size="xs" c="dimmed">
                            {slot.startTime && `${slot.startTime}`}
                            {slot.startTime && slot.endTime && ' - '}
                            {slot.endTime && `${slot.endTime}`}
                          </Text>
                        )}
                      </Stack>
                      <ActionIcon
                        variant="subtle"
                        color={colors.error}
                        onClick={() => handleRemoveSlot(index)}
                        size="sm"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </div>
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button variant="light" onClick={onBack}>
          Back
        </Button>
        <Button 
          onClick={handleNext} 
          color={colors.primary} 
          disabled={isNextDisabled}
        >
          Next
        </Button>
      </Group>
    </Stack>
  );
}

