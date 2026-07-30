'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Google Classroom settings live on Settings → Integrations. */
export default function GoogleClassroomSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings?section=integrations');
  }, [router]);

  return null;
}
