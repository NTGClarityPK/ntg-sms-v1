'use client';

import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useSubjects } from '@/hooks/useCoreLookups';
import { useClasses } from '@/hooks/useCoreLookups';
import { useLevels } from '@/hooks/useCoreLookups';
import type { SubjectTemplate } from '@/types/subject-templates';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useTranslations } from 'next-intl';

interface SubjectTemplateCardProps {
  template: SubjectTemplate;
  onEdit: (template: SubjectTemplate) => void;
  onDelete: (template: SubjectTemplate) => void;
  isDeleting?: boolean;
}

export function SubjectTemplateCard({
  template,
  onEdit,
  onDelete,
  isDeleting,
}: SubjectTemplateCardProps) {
  const colors = useThemeColors();
  const tSettings = useTranslations('settings');
  const subjectsQuery = useSubjects();
  const classesQuery = useClasses();
  const levelsQuery = useLevels();

  const subjectMap = new Map(
    (subjectsQuery.data?.data ?? []).map((s) => [s.id, s.name]),
  );
  const classMap = new Map(
    (classesQuery.data?.data ?? []).map((c) => [c.id, c.displayName || c.name]),
  );
  const levelMap = new Map(
    (levelsQuery.data?.data ?? []).map((l) => [l.id, l.name]),
  );

  const subjectNames = template.subjectIds
    .map((id) => subjectMap.get(id))
    .filter((name): name is string => !!name);
  const classNames = template.assignedClassIds
    .map((id) => classMap.get(id))
    .filter((name): name is string => !!name);
  const levelNames = template.assignedLevelIds
    .map((id) => levelMap.get(id))
    .filter((name): name is string => !!name);

  return (
    <Card shadow={undefined} withBorder p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={4}>{template.name}</Title>
            {template.description && (
              <Text size="sm" c="dimmed" mt={4}>
                {template.description}
              </Text>
            )}
          </Stack>
          <Group gap="xs">
            <Button
              id={`subject-template-card-${template.id}-edit`}
              variant="light"
              size="compact-sm"
              leftSection={<IconEdit size={16} />}
              onClick={() => onEdit(template)}
            >
              {tSettings('subjectTemplateEditButton')}
            </Button>
            <Button
              id={`subject-template-card-${template.id}-delete`}
              variant="light"
              color={colors.error}
              size="compact-sm"
              leftSection={<IconTrash size={16} />}
              onClick={() => onDelete(template)}
              disabled={isDeleting}
              loading={!isDeleting ? false : true}
            >
              {tSettings('subjectTemplateDeleteButton')}
            </Button>
          </Group>
        </Group>

        {subjectNames.length > 0 && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {tSettings('subjectTemplateSubjectsLabel', { count: subjectNames.length })}
            </Text>
            <Group gap="xs">
              {subjectNames.map((name) => (
                <Badge key={name} variant="light" size="sm">
                  {name}
                </Badge>
              ))}
            </Group>
          </Stack>
        )}

        {(classNames.length > 0 || levelNames.length > 0) && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {tSettings('subjectTemplateAssignedTo')}
            </Text>
            {classNames.length > 0 && (
              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  {tSettings('subjectTemplateAssignedClasses')}
                </Text>
                {classNames.map((name) => (
                  <Badge key={name} variant="light" color="blue" size="sm">
                    {name}
                  </Badge>
                ))}
              </Group>
            )}
            {levelNames.length > 0 && (
              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  {tSettings('subjectTemplateAssignedLevels')}
                </Text>
                {levelNames.map((name) => (
                  <Badge key={name} variant="light" color="green" size="sm">
                    {name}
                  </Badge>
                ))}
              </Group>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
