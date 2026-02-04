'use client';

import { Select } from '@mantine/core';
import { IconBook } from '@tabler/icons-react';
import type { SubjectTemplate } from '@/types/subject-templates';

interface TemplateSwitcherProps {
  templates: SubjectTemplate[];
  selectedTemplateId: string | null;
  onTemplateChange: (templateId: string | null) => void;
  isLoading?: boolean;
}

export function TemplateSwitcher({
  templates,
  selectedTemplateId,
  onTemplateChange,
  isLoading,
}: TemplateSwitcherProps) {
  if (isLoading || templates.length === 0) {
    return null;
  }

  return (
    <Select
      leftSection={<IconBook size={16} />}
      placeholder="Select template"
      data={templates.map((t) => ({
        value: t.id,
        label: t.name,
      }))}
      value={selectedTemplateId}
      onChange={(value) => onTemplateChange(value)}
      size="sm"
      style={{ minWidth: 200 }}
      searchable
      clearable={false}
    />
  );
}

