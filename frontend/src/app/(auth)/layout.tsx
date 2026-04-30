'use client';

import { ReactNode, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Box, Title, Text, Card, Group, Image } from '@mantine/core';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { useTheme } from '@/lib/hooks/use-theme';

interface AuthLayoutProps {
  children: ReactNode;
}

// Helper function to calculate shade from a base color (for auth pages)
function calculateShade(baseColor: string, shade: number = 8): string {
  // Convert hex to RGB
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Darken: mix with black
  const factor = (shade - 6) / 3;
  const darkenFactor = factor * 0.4;
  const newR = Math.round(Math.max(0, r * (1 - darkenFactor)));
  const newG = Math.round(Math.max(0, g * (1 - darkenFactor)));
  const newB = Math.round(Math.max(0, b * (1 - darkenFactor)));

  return `#${[newR, newG, newB].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const pathname = usePathname();
  const isCallback = pathname === '/auth/callback';
  const primary = DEFAULT_THEME_COLOR;
  const primaryShade = useMemo(() => calculateShade(DEFAULT_THEME_COLOR, 8), []);
  const { isDark } = useTheme();

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${primary} 0%, ${primaryShade} 100%)`,
        padding: '20px',
      }}
    >
      {/* Left Side - Decorative (Hidden on Mobile) */}
      <Box
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: '100vh',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        visibleFrom="md"
      >
        <Box
          style={{
            textAlign: 'center',
            color: 'white',
            zIndex: 10,
          }}
        >
          <Box
            style={{
              width: 155,
              height: 155,
              margin: '28px auto 24px',
              borderRadius: 9999,
              border: '2px solid rgba(255, 255, 255, 0.55)',
              background: 'rgba(255, 255, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              backdropFilter: 'blur(8px)',
            }}
          >
            <Image src="/alma-logo.svg" alt="NTG Alma" fit="contain" />
          </Box>
          <Title order={1} size="2.5rem" fw={800} mb="md" c="white">
            School Management
          </Title>
          <Text size="lg" c="white" opacity={0.9}>
            Streamline your school operations
          </Text>
          <Box
            mt="md"
            style={{
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Box style={{ width: 260, height: 84 }}>
              <Image
                src="/ntg-logo.svg"
                alt="NTG Clarity"
                fit="contain"
                width="100%"
                height="100%"
                style={{
                  objectFit: 'contain',
                  filter: 'brightness(0) saturate(100%) invert(100%)',
                }}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Right Side - Form Container */}
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          minHeight: '100vh',
          width: '100%',
          flex: 1,
        }}
      >
        <Card
          shadow="xl"
          radius="xl"
          padding="xl"
          withBorder
          style={{
            backdropFilter: 'blur(20px)',
            maxWidth: '650px',
            width: '100%',
            minHeight: '500px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* App Name Header */}
          <Box ta="center" mb="xl">
            <Title
              order={1}
              size="2.2rem"
              fw={800}
              style={{
                color: primary,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                marginBottom: '8px',
              }}
            >
              NTG Alma
            </Title>
            <Text size="sm" fw={500} c={isDark ? 'white' : '#4a4a4a'}>
              School Management System
            </Text>
          </Box>

          {/* Language Switcher - hidden on callback page */}
          {!isCallback && (
            <Group justify="flex-end" mb="md">
              <LanguageSwitcher />
            </Group>
          )}

          {children}
        </Card>
      </Box>
    </Box>
  );
}
