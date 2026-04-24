import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/auth';

type AuthStoreState = {
  user: User | null;
  branchId: string | null;
  /** True once persisted state has been rehydrated on the client. */
  hasHydrated: boolean;

  setUser: (user: User | null) => void;
  setBranchId: (branchId: string | null) => void;
  markHydrated: () => void;
  clear: () => void;
};

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      user: null,
      branchId: null,
      hasHydrated: false,

      setUser: (user) => set({ user }),
      setBranchId: (branchId) => set({ branchId }),
      markHydrated: () => set({ hasHydrated: true }),
      clear: () => set({ user: null, branchId: null }),
    }),
    {
      name: 'ntg-auth-storage',
      partialize: (state) => ({ user: state.user, branchId: state.branchId }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

