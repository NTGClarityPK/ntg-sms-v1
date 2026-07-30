'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Rubric presets live on Settings → Integrations. */
export default function RubricPresetsSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings?section=integrations');
  }, [router]);

  return null;
}
