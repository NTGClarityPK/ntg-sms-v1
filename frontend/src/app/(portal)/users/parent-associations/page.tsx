'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParentAssociationsRedirectPage() {
  const router = useRouter();

  // Client-side redirect to keep backwards compatibility (old path) without breaking bookmarks.
  useEffect(() => {
    router.replace('/parent-associations');
  }, [router]);

  return null;
}

