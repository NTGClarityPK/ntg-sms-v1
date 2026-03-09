'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OfflineDocumentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/storage?tab=offline-documents');
  }, [router]);

  return null;
}
