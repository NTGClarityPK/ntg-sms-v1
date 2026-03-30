'use client';

import { Tabs, TextInput, Text, Group } from '@mantine/core';
import { IconCircleCheck, IconAlertCircle } from '@tabler/icons-react';

export interface TranslatableValue {
  en: string;
  ar: string;
}

interface TranslatableInputProps {
  label: string;
  description?: string;
  value: TranslatableValue;
  onChange: (value: TranslatableValue) => void;
  required?: boolean;
  placeholder?: { en?: string; ar?: string };
  id?: string;
}

export function TranslatableInput({
  label,
  description,
  value,
  onChange,
  required = false,
  placeholder,
  id = 'translatable-input',
}: TranslatableInputProps) {
  const enFilled = (value.en ?? '').trim().length > 0;
  const arFilled = (value.ar ?? '').trim().length > 0;
  // "required" here means: at least one language must be provided (not both).
  // Do NOT set the HTML `required` attribute on both inputs, otherwise the browser will
  // block submission until both fields are filled.
  const missingBoth = required && !enFilled && !arFilled;
  const enWarning = missingBoth;
  const arWarning = missingBoth;

  return (
    <Tabs defaultValue="en" id={id}>
      <Tabs.List>
        <Tabs.Tab
          value="en"
          leftSection={
            enFilled ? (
              <IconCircleCheck size={14} color="var(--mantine-color-green-6)" />
            ) : enWarning ? (
              <IconAlertCircle size={14} color="var(--mantine-color-yellow-6)" />
            ) : null
          }
        >
          English
        </Tabs.Tab>
        <Tabs.Tab
          value="ar"
          leftSection={
            arFilled ? (
              <IconCircleCheck size={14} color="var(--mantine-color-green-6)" />
            ) : arWarning ? (
              <IconAlertCircle size={14} color="var(--mantine-color-yellow-6)" />
            ) : null
          }
        >
          العربية
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="en" pt="sm">
        <TextInput
          label={label}
          description={description}
          value={value.en ?? ''}
          onChange={(e) => onChange({ ...value, en: e.target.value })}
          placeholder={placeholder?.en}
          withAsterisk={required}
          dir="ltr"
        />
      </Tabs.Panel>
      <Tabs.Panel value="ar" pt="sm">
        <TextInput
          label={label}
          description={description}
          value={value.ar ?? ''}
          onChange={(e) => onChange({ ...value, ar: e.target.value })}
          placeholder={placeholder?.ar}
          withAsterisk={required}
          dir="rtl"
        />
      </Tabs.Panel>
    </Tabs>
  );
}
