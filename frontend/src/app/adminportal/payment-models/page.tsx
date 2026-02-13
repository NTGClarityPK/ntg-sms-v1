'use client';

import { Group, Title, Stack, Text, Paper, Center } from '@mantine/core';

export default function PaymentModelsPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Payment Models</Title>
        </Group>
      </div>
      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Paper withBorder p="xl">
          <Center>
            <Stack gap="md" align="center">
              <Title order={2}>Coming soon...</Title>
              <Text size="sm" c="dimmed">
                Payment models functionality will be available here.
              </Text>
            </Stack>
          </Center>
        </Paper>
      </div>
    </>
  );
}
