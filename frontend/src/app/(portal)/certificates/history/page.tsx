'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CertificatesHistoryRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/certificates?tab=history');
  }, [router]);
  return null;
}
