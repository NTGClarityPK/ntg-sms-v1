'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal, SimpleGrid, Card, Text, Stack, Box, Group, useMantineTheme } from '@mantine/core';
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
  const theme = useMantineTheme();
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
    <Modal
      opened={opened}
      onClose={onClose}
      title="Welcome! Let's Get You Started"
      centered
      size="xl"
      styles={{
        title: { fontWeight: 800 },
      }}
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          (Optimized for laptops and desktops)
        </Text>
        <Text size="sm" c="dimmed">
          Choose a guided tour below, or launch one anytime from your profile menu (top-right corner).
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="sm">
          {launchers.map((tour) => (
            <Card
              key={tour.key}
              withBorder
              radius="md"
              p="md"
              component="button"
              type="button"
              id={`tour-card-${tour.key}`}
              onClick={() => void handleStartTour(tour)}
              disabled={!tour.available || isStarting}
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: tour.available && !isStarting ? 'pointer' : 'not-allowed',
                background: 'transparent',
                position: 'relative',
                opacity: tour.available ? 1 : 0.6,
              }}
            >
              <Group gap="sm" align="flex-start" wrap="nowrap">
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: theme.radius.sm,
                    color: theme.colors[theme.primaryColor][6],
                    flexShrink: 0,
                  }}
                >
                  {tour.icon}
                </Box>
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: 0.8 }}>
                    {tour.label}
                  </Text>
                  <Text fw={600} size="md">
                    {tour.title}
                  </Text>
                </Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Modal>
  );
}

