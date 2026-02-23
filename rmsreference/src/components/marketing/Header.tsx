'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Group,
  Button,
  Burger,
  Drawer,
  Stack,
  Text,
  Image,
  Box,
} from '@mantine/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';

const links = [
  { link: '/home', label: 'Home' },
  { link: '/features', label: 'Features' },
  { link: '/pricing', label: 'Pricing' },
  { link: '/about', label: 'About' },
  { link: '/contact', label: 'Contact' },
];

export function MarketingHeader() {
  const [opened, setOpened] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const marketingColors = useMarketingColors();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const items = links.map((link) => (
    <Link
      key={link.label}
      href={link.link}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        fontWeight: pathname === link.link ? 600 : 400,
        borderBottom: pathname === link.link ? `2px solid ${marketingColors.primary}` : 'none',
        paddingBottom: '4px',
        transition: 'all 0.2s',
      }}
    >
      {link.label}
    </Link>
  ));

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom: scrolled ? '1px solid #dee2e6' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <Container size="xl" py="md">
        <Group justify="space-between" align="center">
          <Link href="/home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Box
              style={{
                width: '48px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Image
                src="/ntg-logo.svg"
                alt="NTG Clarity"
                width="100%"
                height="100%"
                fit="contain"
                style={{ objectFit: 'contain' }}
              />
            </Box>
            <Text
              size="xl"
              fw={700}
              style={{
                fontFamily: 'var(--font-audiowide)',
                background: marketingColors.gradientPrimary,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              NTG Resto
            </Text>
          </Link>

          <Group gap="xl" visibleFrom="md">
            {items}
            <Button
              component={Link}
              href="/login"
              color={undefined}
              styles={{
                root: {
                  backgroundColor: `${marketingColors.primary} !important`,
                  color: `${marketingColors.textOnPrimary} !important`,
                  fontWeight: 600,
                  border: '2px solid transparent',
                  transition: 'all 0.3s ease',
                  lineHeight: 1.5,
                  minHeight: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.setProperty('background-color', marketingColors.backgroundPrimary, 'important');
                e.currentTarget.style.setProperty('color', marketingColors.textPrimary, 'important');
                e.currentTarget.style.setProperty('border', `2px solid ${marketingColors.primary}`, 'important');
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.setProperty('background-color', marketingColors.primary, 'important');
                e.currentTarget.style.setProperty('color', marketingColors.textOnPrimary, 'important');
                e.currentTarget.style.setProperty('border-color', 'transparent', 'important');
              }}
            >
              Login
            </Button>
          </Group>

          <Burger
            opened={opened}
            onClick={() => setOpened(true)}
            hiddenFrom="md"
            aria-label="Toggle navigation"
          />
        </Group>
      </Container>

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        position="right"
        padding="xl"
        size="sm"
      >
        <Stack gap="lg">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.link}
              onClick={() => setOpened(false)}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                fontSize: '1.1rem',
                fontWeight: pathname === link.link ? 600 : 400,
              }}
            >
              {link.label}
            </Link>
          ))}
          <Button
            component={Link}
            href="/login"
            fullWidth
            color={undefined}
            styles={{
              root: {
                backgroundColor: `${marketingColors.primary} !important`,
                color: `${marketingColors.textOnPrimary} !important`,
                fontWeight: 600,
                border: '2px solid transparent',
                transition: 'all 0.3s ease',
              },
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.setProperty('background-color', marketingColors.backgroundPrimary, 'important');
              e.currentTarget.style.setProperty('color', marketingColors.textPrimary, 'important');
              e.currentTarget.style.setProperty('border-color', marketingColors.primary, 'important');
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.setProperty('background-color', marketingColors.primary, 'important');
              e.currentTarget.style.setProperty('color', marketingColors.textOnPrimary, 'important');
              e.currentTarget.style.setProperty('border-color', 'transparent', 'important');
            }}
          >
            Login
          </Button>
        </Stack>
      </Drawer>
    </motion.header>
  );
}

