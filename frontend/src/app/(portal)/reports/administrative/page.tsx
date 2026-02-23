'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirects /reports/administrative to /reports?tab=administrative
 * so the main report tabs remain visible and the user stays on the same page.
 */
export default function AdministrativeReportsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/reports?tab=administrative');
  }, [router]);

  return null;
}
