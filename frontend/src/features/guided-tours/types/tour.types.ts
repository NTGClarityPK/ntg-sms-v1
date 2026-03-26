import type { GuidedTourName } from '@/lib/store/onboarding-store';

export type TourLauncherDefinition = {
  key: string;
  title: string;
  description?: string;
  available: boolean;
  startRoute: string;
  tourName: GuidedTourName;
};

