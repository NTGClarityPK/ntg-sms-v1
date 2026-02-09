'use client';

/**
 * Create Event Page
 */

import { Title, Paper, Button, Group, Stack } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { EventForm } from '@/components/features/events/EventForm';
import { useCreateEvent } from '@/hooks/api/useEvents';
import type { CreateEventInput, UpdateEventInput } from '@/types/events';

export default function CreateEventPage() {
  const router = useRouter();
  const createEvent = useCreateEvent();

  const handleSubmit = (values: CreateEventInput | UpdateEventInput) => {
    createEvent.mutate(values as CreateEventInput, {
      onSuccess: () => {
        router.push('/events');
      },
    });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Create Event</Title>
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
        <Stack gap="md">
          <Paper p="md" withBorder>
            <EventForm onSubmit={handleSubmit} isLoading={createEvent.isPending} />
          </Paper>

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => router.back()}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </div>
    </>
  );
}

