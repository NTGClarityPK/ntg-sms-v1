'use client';

import { useEffect, useRef, useState } from 'react';
import { Affix, Badge, Box, Tooltip, rem } from '@mantine/core';
import { IconHeadset } from '@tabler/icons-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSupportUnreadSummary } from '@/hooks/api/useSupport';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export function SupportFloatingButton() {
  const t = useTranslations('support');
  const router = useRouter();
  const pathname = usePathname();
  const isOnline = useOnlineStatus();
  const { user, isAuthenticated } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { primary } = useThemeColors();
  const { data: unread } = useSupportUnreadSummary(
    !!isAuthenticated && !!branchId && isOnline && pathname !== '/support',
  );
  const count = unread?.count ?? 0;
  const prevCountRef = useRef(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prevCountRef.current === 0 && count >= 1) {
      setPulse(true);
      const timer = window.setTimeout(() => setPulse(false), 1800);
      prevCountRef.current = count;
      return () => window.clearTimeout(timer);
    }
    prevCountRef.current = count;
    return undefined;
  }, [count]);

  const hide =
    !isAuthenticated ||
    !branchId ||
    !isOnline ||
    pathname === '/support' ||
    (pathname?.startsWith('/support/') ?? false);

  if (hide) return null;

  const badgeLabel = count > 9 ? '9+' : String(count);

  return (
    <Affix position={{ bottom: rem(24), right: rem(24) }} zIndex={200}>
      <Box style={{ position: 'relative' }}>
        <Tooltip label={t('fabTooltip')} withArrow position="left">
          <Box
            id="support-fab"
            component="button"
            type="button"
            aria-label={t('fabAria')}
            onClick={() => router.push('/support')}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: primary,
              color: 'var(--mantine-color-white)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--mantine-shadow-md)',
              transform: pulse ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 400ms ease',
            }}
          >
            <IconHeadset size={26} />
          </Box>
        </Tooltip>
        {count > 0 && (
          <Badge
            id="support-fab-badge"
            size="sm"
            color="red"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              pointerEvents: 'none',
              minWidth: 20,
              height: 20,
              paddingInline: count > 9 ? 4 : 0,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {badgeLabel}
          </Badge>
        )}
      </Box>
    </Affix>
  );
}
