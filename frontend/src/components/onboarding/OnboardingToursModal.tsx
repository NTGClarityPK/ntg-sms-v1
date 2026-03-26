'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal, SimpleGrid, Card, Text, Group, Button, Badge, Stack } from '@mantine/core';
import { useRouter, usePathname } from 'next/navigation';
import { useNextStep } from 'nextstepjs';
import { getTourLauncherDefinitions } from '@/features/guided-tours/tours/tourLaunchers';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { apiClient } from '@/lib/api-client';

type Props = {
  opened: boolean;
  onClose: () => void;
};

export function OnboardingToursModal({ opened, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { startNextStep } = useNextStep();
  const [isStarting, setIsStarting] = useState(false);

  const launchers = useMemo(() => getTourLauncherDefinitions(), []);
  const { setReturnPath } = useOnboardingStore();

  useEffect(() => {
    if (!opened) {
      setIsStarting(false);
    }
  }, [opened]);

  const markSeen = async () => {
    // Backend implementation is added in the persistence todo.
    // This call will start working once `UpdateProfileDto` accepts `onboardingSeenToursModal`.
    try {
      await apiClient.put('/api/v1/auth/profile', { onboardingSeenToursModal: true });
    } catch {
      // Non-blocking: do not prevent tours from starting
    }
  };

  const waitForSelector = async (selector: string, timeoutMs: number) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = document.querySelector(selector);
      if (el) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  };

  const handleStartTour = async (tour: (typeof launchers)[number]) => {
    if (!tour.available) return;
    setIsStarting(true);
    setReturnPath(pathname || '/');
    await markSeen();
    onClose();

    if (pathname !== tour.startRoute) {
      router.push(tour.startRoute);
      // App Router navigation + data loading can vary; wait for a known anchor before starting
      await waitForSelector('#assessments-search', 5000);
    } else {
      await waitForSelector('#assessments-search', 1500);
    }

    startNextStep(tour.tourName);
    setIsStarting(false);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Take a tour" centered size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Select a screen to tour. You can skip at any time.
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {launchers.map((tour) => (
            <Card key={tour.key} withBorder radius="md" p="md">
              <Group justify="space-between" align="flex-start" gap="xs">
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text fw={700}>{tour.title}</Text>
                  {tour.description ? (
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {tour.description}
                    </Text>
                  ) : null}
                </Stack>
                <Badge variant="light" color={tour.available ? 'green' : 'gray'}>
                  {tour.available ? 'Available' : 'Coming soon'}
                </Badge>
              </Group>

              <Group justify="flex-end" mt="md">
                <Button
                  onClick={() => void handleStartTour(tour)}
                  disabled={!tour.available}
                  loading={isStarting}
                  id={`tour-start-${tour.key}`}
                >
                  Start
                </Button>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Modal>
  );
}

