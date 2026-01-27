'use client';

import { Button, Checkbox, Group, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { BehaviorData } from './types';

interface BehaviorStepProps {
  data: BehaviorData | null;
  onChange: (data: BehaviorData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BehaviorStep({ data, onChange, onNext, onBack }: BehaviorStepProps) {
  const colors = useThemeColors();
  const [newAttribute, setNewAttribute] = useState('');

  const formData = data || {
    enabled: false,
    mandatory: false,
    attributes: [],
  };

  const handleToggleEnabled = (checked: boolean) => {
    onChange({
      ...formData,
      enabled: checked,
    });
  };

  const handleToggleMandatory = (checked: boolean) => {
    onChange({
      ...formData,
      mandatory: checked,
    });
  };

  const handleAddAttribute = () => {
    if (newAttribute.trim() && !formData.attributes.includes(newAttribute.trim())) {
      onChange({
        ...formData,
        attributes: [...formData.attributes, newAttribute.trim()],
      });
      setNewAttribute('');
    }
  };

  const handleRemoveAttribute = (attribute: string) => {
    onChange({
      ...formData,
      attributes: formData.attributes.filter((a) => a !== attribute),
    });
  };

  const handleNext = () => {
    onChange(formData);
    onNext();
  };

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        Behavioral Assessment Settings
      </Text>
      <Text size="sm" c="dimmed">
        Configure behavioral assessment features for student evaluations.
      </Text>

      <Stack gap="lg" mt="md">
        <Checkbox
          label="Enable behavioral assessment"
          checked={formData.enabled}
          onChange={(e) => handleToggleEnabled(e.currentTarget.checked)}
        />

        {formData.enabled && (
          <>
            <Checkbox
              label="Make behavioral assessment mandatory"
              checked={formData.mandatory}
              onChange={(e) => handleToggleMandatory(e.currentTarget.checked)}
            />

            <div>
              <Text size="sm" fw={500} mb="xs">
                Assessment Attributes
              </Text>
              <Group gap="xs" mb="xs">
                <TextInput
                  placeholder="Add attribute (e.g., Respect, Responsibility)"
                  value={newAttribute}
                  onChange={(e) => setNewAttribute(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAttribute();
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <Button onClick={handleAddAttribute} size="sm">
                  Add
                </Button>
              </Group>
              {formData.attributes.length > 0 && (
                <Stack gap="xs">
                  {formData.attributes.map((attr) => (
                    <Group key={attr} justify="space-between">
                      <Text size="sm">{attr}</Text>
                      <Button
                        variant="subtle"
                        color="red"
                        size="xs"
                        onClick={() => handleRemoveAttribute(attr)}
                      >
                        Remove
                      </Button>
                    </Group>
                  ))}
                </Stack>
              )}
            </div>
          </>
        )}
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


