import { Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Settings</Title>
        </Group>
      </div>

      <Stack gap="md">
        <Text c="dimmed">Configure the core system settings used across the application.</Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card component={Link} href="/settings/academic-years" withBorder p="md">
            <Title order={3}>Academic years</Title>
            <Text c="dimmed" size="sm">
              Create, activate, and lock academic years.
            </Text>
          </Card>

          <Card component={Link} href="/settings/academic" withBorder p="md">
            <Title order={3}>Academic</Title>
            <Text c="dimmed" size="sm">
              Subjects, classes, sections, and levels.
            </Text>
          </Card>

          <Card component={Link} href="/settings/schedule" withBorder p="md">
            <Title order={3}>Schedule</Title>
            <Text c="dimmed" size="sm">
              School days, timing templates, and holidays.
            </Text>
          </Card>

          <Card component={Link} href="/settings/assessment" withBorder p="md">
            <Title order={3}>Assessment</Title>
            <Text c="dimmed" size="sm">
              Assessment types, grade templates, and leave quota.
            </Text>
          </Card>

          <Card component={Link} href="/settings/communication" withBorder p="md">
            <Title order={3}>Communication</Title>
            <Text c="dimmed" size="sm">
              Messaging direction and library categories.
            </Text>
          </Card>

          <Card component={Link} href="/settings/behavior" withBorder p="md">
            <Title order={3}>Behavior</Title>
            <Text c="dimmed" size="sm">
              Behavioral assessment settings and attributes.
            </Text>
          </Card>
        </SimpleGrid>
      </Stack>
    </>
  );
}


