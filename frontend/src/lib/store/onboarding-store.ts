import { create } from 'zustand';

export type GuidedTourName = 'assessmentsTour';

type OnboardingState = {
  returnPath: string | null;
  activeTourName: GuidedTourName | null;
  openToursModalRequested: boolean;

  setReturnPath: (path: string | null) => void;
  startTour: (tourName: GuidedTourName) => void;
  stopTour: () => void;
  requestOpenToursModal: () => void;
  clearOpenToursModalRequested: () => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  returnPath: null,
  activeTourName: null,
  openToursModalRequested: false,

  setReturnPath: (path) => set({ returnPath: path }),
  startTour: (tourName) => set({ activeTourName: tourName }),
  stopTour: () => set({ activeTourName: null }),
  requestOpenToursModal: () => set({ openToursModalRequested: true }),
  clearOpenToursModalRequested: () => set({ openToursModalRequested: false }),
}));

export const requestOpenToursModal = () => useOnboardingStore.getState().requestOpenToursModal();
export const clearOpenToursModalRequested = () =>
  useOnboardingStore.getState().clearOpenToursModalRequested();
export const stopTour = () => useOnboardingStore.getState().stopTour();

