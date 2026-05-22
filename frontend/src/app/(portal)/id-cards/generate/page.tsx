'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — generation lives on the Generate tab of /id-cards. */
export default function IdCardsGenerateRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/id-cards?tab=generate');
  }, [router]);
  return null;
}
