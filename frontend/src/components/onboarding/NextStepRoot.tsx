'use client';

import type { PropsWithChildren } from 'react';
import { NextStep, NextStepProvider } from 'nextstepjs';
import { allGuidedTourSteps } from '@/features/guided-tours/tours/allTourSteps';
import { OnboardingTourCard } from '@/components/onboarding/OnboardingTourCard';
import { requestOpenToursModal, stopTour } from '@/lib/store/onboarding-store';

export function NextStepRoot({ children }: PropsWithChildren) {
  return (
    <NextStepProvider>
      <NextStep
        steps={allGuidedTourSteps}
        showNextStep={true}
        cardComponent={OnboardingTourCard}
        shadowOpacity="0.35"
        overlayZIndex={10000}
        noInViewScroll
        scrollToTop={false}
        onSkip={() => {
          stopTour();
          requestOpenToursModal();
        }}
        onComplete={() => {
          stopTour();
          requestOpenToursModal();
        }}
      >
        {children}
      </NextStep>
    </NextStepProvider>
  );
}

