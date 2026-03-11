'use client';

import { useFavicon } from '@/hooks/useFavicon';

/**
 * Renders nothing; syncs document favicon with tenant logo (or default NTG logo).
 * Mounted inside Providers so it runs on every page.
 */
export function FaviconUpdater() {
  useFavicon();
  return null;
}
