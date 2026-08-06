'use client';

import { ActionIcon, Button, Group, NumberInput, Stack, Table, Text, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import type { RatingScaleLevel } from '@/types/behavioral-framework';

interface RatingScaleEditorProps {
  levels: RatingScaleLevel[];
  onChange: (levels: RatingScaleLevel[]) => void;
}

export function RatingScaleEditor({ levels, onChange }: RatingScaleEditorProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');

  const updateLevel = (index: number, patch: Partial<RatingScaleLevel>) => {
    onChange(levels.map((level, i) => (i === index ? { ...level, ...patch } : level)));
  };

  const removeLevel = (index: number) => {
    onChange(levels.filter((_, i) => i !== index));
  };

  const addLevel = () => {
    const nextOrder =
      levels.length === 0 ? 1 : Math.max(...levels.map((l) => l.order)) + 1;
    onChange([
      ...levels,
      {
        code: '',
        label: '',
        order: nextOrder,
      },
    ]);
  };

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>
        {t('behaviorFrameworkScaleTitle')}
      </Text>
      <Table.ScrollContainer minWidth={420}>
        <Table id="behavior-framework-scale-table" striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('behaviorFrameworkScaleCode')}</Table.Th>
              <Table.Th>{t('behaviorFrameworkScaleLabel')}</Table.Th>
              <Table.Th>{t('behaviorFrameworkScaleOrder')}</Table.Th>
              <Table.Th w={48} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {levels.map((level, index) => (
              <Table.Tr key={`scale-${index}`}>
                <Table.Td>
                  <TextInput
                    id={`behavior-framework-scale-${index}-code`}
                    value={level.code}
                    onChange={(e) => updateLevel(index, { code: e.currentTarget.value })}
                    size="xs"
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    id={`behavior-framework-scale-${index}-label`}
                    value={level.label}
                    onChange={(e) => updateLevel(index, { label: e.currentTarget.value })}
                    size="xs"
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    id={`behavior-framework-scale-${index}-order`}
                    value={level.order}
                    onChange={(value) =>
                      updateLevel(index, {
                        order: typeof value === 'number' ? value : 0,
                      })
                    }
                    size="xs"
                    min={0}
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    id={`behavior-framework-scale-${index}-remove`}
                    variant="subtle"
                    color="red"
                    onClick={() => removeLevel(index)}
                    aria-label={tCommon('remove')}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Group>
        <Button
          id="behavior-framework-scale-add"
          variant="light"
          size="xs"
          onClick={addLevel}
        >
          {t('behaviorFrameworkScaleAdd')}
        </Button>
      </Group>
    </Stack>
  );
}
