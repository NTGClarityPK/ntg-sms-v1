import type { GuidedTourName } from '@/lib/store/onboarding-store';
import type { ReactNode } from 'react';

export type TourLauncherDefinition = {
  key: string;
  label: string;
  title: string;
  icon: ReactNode;
  available: boolean;
  startRoute: string;
  tourName: GuidedTourName;
};

