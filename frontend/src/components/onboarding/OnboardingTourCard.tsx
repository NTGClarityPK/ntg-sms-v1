'use client';

import type { CardComponentProps } from 'nextstepjs';
import { Paper, Group, Text, Progress, Button, Stack, Box } from '@mantine/core';

export function OnboardingTourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const atStart = currentStep === 0;
  const atEnd = currentStep === totalSteps - 1;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  return (
    <Paper shadow="md" radius="md" p="md" maw={420} miw={260} withBorder>
      <Stack gap="sm">
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Box style={{ minWidth: 0 }}>
            <Text fw={700} truncate>
              {step.title}
            </Text>
          </Box>
          {step.icon ? (
            <Text fw={700} style={{ whiteSpace: 'nowrap' }}>
              {step.icon}
            </Text>
          ) : null}
        </Group>

        <Box>
          <Text size="sm">{step.content}</Text>
        </Box>

        <Progress value={progress} size="sm" radius="xl" />

        <Group justify="space-between" align="center">
          <Button
            variant="light"
            onClick={prevStep}
            disabled={atStart}
            style={{ display: step.showControls ? 'inline-flex' : 'none' }}
          >
            Back
          </Button>

          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {currentStep + 1} of {totalSteps}
          </Text>

          <Button
            onClick={nextStep}
            color={atEnd ? 'green' : undefined}
            style={{ display: step.showControls ? 'inline-flex' : 'none' }}
          >
            {atEnd ? 'Finish' : 'Next'}
          </Button>
        </Group>

        {skipTour && !atEnd ? (
          <Button
            variant="subtle"
            onClick={skipTour}
            style={{ display: step.showSkip ? 'inline-flex' : 'none' }}
          >
            Skip tour
          </Button>
        ) : null}

        {arrow}
      </Stack>
    </Paper>
  );
}

