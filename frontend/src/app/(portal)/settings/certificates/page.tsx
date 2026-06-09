'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Certificate branding lives on the Certificates page (Settings tab). */
export default function CertificateSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/certificates?tab=settings');
  }, [router]);

  return null;
}
