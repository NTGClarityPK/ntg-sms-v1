'use client';

/**
 * Edit Event Page
 */

import { Title, Paper, Button, Group, Stack, Skeleton, Alert } from '@mantine/core';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EventForm } from '@/components/features/events/EventForm';
import { useEvent, useUpdateEvent } from '@/hooks/api/useEvents';
import type { CreateEventInput, UpdateEventInput } from '@/types/events';

export default function EditEventPage() {
  const t = useTranslations('event');
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { data: eventData, isLoading } = useEvent(eventId);
  const updateEvent = useUpdateEvent(eventId);

  const event = eventData?.data;

  const handleSubmit = (values: CreateEventInput | UpdateEventInput) => {
    updateEvent.mutate(values as UpdateEventInput, {
      onSuccess: () => {
        router.push(`/events/${eventId}`);
      },
    });
  };

  if (isLoading || !eventData) {
    return (
      <>
        <div className="page-title-bar">
          <Skeleton height={40} width={200} />
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
            <Skeleton height={200} />
          </Stack>
        </div>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('eventNotFound')}</Title>
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
          <Alert color="red">{t('eventNotFoundMessage')}</Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('editEvent')}</Title>
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
            <EventForm event={event} onSubmit={handleSubmit} isLoading={updateEvent.isPending} />
          </Paper>

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => router.back()}>
              {t('cancel')}
            </Button>
          </Group>
        </Stack>
      </div>
    </>
  );
}

