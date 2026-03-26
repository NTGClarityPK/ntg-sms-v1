'use client';

import type { TourLauncherDefinition } from '@/features/guided-tours/types/tour.types';
import { IconClipboardCheck } from '@tabler/icons-react';

export function getTourLauncherDefinitions(): TourLauncherDefinition[] {
  return [
    {
      key: 'assessments',
      label: 'ASSESSMENTS',
      title: 'Assessment management',
      icon: <IconClipboardCheck size={18} />,
      available: true,
      startRoute: '/assessments',
      tourName: 'assessmentsTour',
    },
  ];
}

