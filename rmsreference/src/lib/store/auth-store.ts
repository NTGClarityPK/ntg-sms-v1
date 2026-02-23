import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Role, Permission } from '../api/roles';
import { useThemeStore } from './theme-store';
import { useRestaurantStore } from './restaurant-store';
import { DEFAULT_THEME_COLOR } from '../utils/theme';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string; // Keep for backward compatibility
  roles?: Role[]; // New: multiple roles
  permissions?: Permission[]; // New: aggregated permissions from all roles
  tenantId: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setPermissions: (permissions: Permission[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),
      setPermissions: (permissions) =>
        set((state) => ({
          user: state.user ? { ...state.user, permissions } : null,
        })),
      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
        });
        // Also clear restaurant store, branch store, and theme on logout to prevent stale data
        if (typeof window !== 'undefined') {
          import('./restaurant-store').then(({ useRestaurantStore }) => {
            useRestaurantStore.getState().setRestaurant(null);
          });
          import('./branch-store').then(({ useBranchStore }) => {
            useBranchStore.getState().setSelectedBranchId(null);
          });
          import('./theme-store').then(({ useThemeStore }) => {
            import('../utils/theme').then(({ DEFAULT_THEME_COLOR }) => {
              useThemeStore.getState().setPrimaryColor(DEFAULT_THEME_COLOR);
            });
          });
        }
      },
    }),
    {
      name: 'rms-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

