'use client';

import type { TourLauncherDefinition } from '@/features/guided-tours/types/tour.types';

export function getTourLauncherDefinitions(): TourLauncherDefinition[] {
  return [
    {
      key: 'assessments',
      title: 'Assessments',
      description: 'Learn how to filter, create, and manage assessments.',
      available: true,
      startRoute: '/assessments',
      tourName: 'assessmentsTour',
    },
  ];
}

