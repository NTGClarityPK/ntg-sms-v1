import { create } from 'zustand';

interface ApiLimitState {
  isOpen: boolean;
  dailyLimit: number;
  currentCount: number | undefined;
  openModal: (dailyLimit?: number, currentCount?: number) => void;
  closeModal: () => void;
}

export const useApiLimitStore = create<ApiLimitState>((set) => ({
  isOpen: false,
  dailyLimit: 10000,
  currentCount: undefined,
  openModal: (dailyLimit = 10000, currentCount?: number) =>
    set({ isOpen: true, dailyLimit, currentCount }),
  closeModal: () => set({ isOpen: false }),
}));

















