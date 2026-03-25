'use client';

import { useFavicon } from '@/hooks/useFavicon';

/**
 * Renders nothing; syncs tab favicon, apple-touch-icon, and Web App Manifest with tenant branding.
 * Updates Next.js metadata links in place (does not remove them) to avoid React head reconciliation errors.
 */
export function FaviconUpdater() {
  useFavicon();
  return null;
}
