'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — history lives on /substitution?tab=history */
export default function SubstitutionHistoryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/substitution?tab=history');
  }, [router]);

  return null;
}
