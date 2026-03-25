'use client';

import { create } from 'zustand';

const BRANDING_STORAGE_KEY = 'tenant-branding';

type TenantBrandingState = {
  name: string;
  logoUrl: string | null;
  setBranding: (branding: { name?: string; logoUrl?: string | null }) => void;
};

const getInitialBranding = (): { name: string; logoUrl: string | null } => {
  if (typeof window === 'undefined') {
    return { name: 'NTG Alma', logoUrl: null };
  }

  const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
  if (!raw) return { name: 'NTG Alma', logoUrl: null };

  try {
    const parsed = JSON.parse(raw) as { name?: string; logoUrl?: string | null };
    return {
      name: parsed.name || 'NTG Alma',
      logoUrl: parsed.logoUrl || null,
    };
  } catch {
    return { name: 'NTG Alma', logoUrl: null };
  }
};

export const useTenantBrandingStore = create<TenantBrandingState>((set) => ({
  ...getInitialBranding(),
  setBranding: (branding) =>
    set((state) => {
      const next = {
        name: branding.name ?? state.name,
        logoUrl:
          branding.logoUrl === undefined
            ? state.logoUrl
            : branding.logoUrl,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(next));
      }

      return next;
    }),
}));

