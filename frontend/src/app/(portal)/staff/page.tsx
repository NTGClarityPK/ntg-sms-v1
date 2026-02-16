'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Staff list has been consolidated into Users screen.
 * Redirect /staff to /users to avoid redundant tab.
 */
export default function StaffPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/users');
  }, [router]);
  return null;
}
