'use client';

import { Container, Grid, Group, Text, Stack, Anchor } from '@mantine/core';
import {
  IconBrandTwitter,
  IconBrandFacebook,
  IconBrandLinkedin,
  IconBrandInstagram,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';

const footerLinks = {
  product: [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Demo', href: '/contact' },
  ],
  company: [
    { label: 'About Us', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
};

export function MarketingFooter() {
  const marketingColors = useMarketingColors();
  
  return (
    <footer
      style={{
        backgroundColor: marketingColors.backgroundSecondary,
        borderTop: `1px solid ${marketingColors.borderPrimary}`,
        padding: '4rem 0 2rem',
        marginTop: '4rem',
      }}
    >
      <Container size="xl">
        <Grid>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
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
                NTG Alma
              </Text>
              <Text size="sm" style={{ color: marketingColors.textSecondary }}>
                The complete School Management System for modern schools and trusts.
                Streamline academics, attendance, and communication in one place.
              </Text>
              <Group gap="xs">
                <Anchor href="#" style={{ color: marketingColors.textSecondary }} aria-label="Twitter">
                  <IconBrandTwitter size={20} />
                </Anchor>
                <Anchor href="#" style={{ color: marketingColors.textSecondary }} aria-label="Facebook">
                  <IconBrandFacebook size={20} />
                </Anchor>
                <Anchor href="#" style={{ color: marketingColors.textSecondary }} aria-label="LinkedIn">
                  <IconBrandLinkedin size={20} />
                </Anchor>
                <Anchor href="#" style={{ color: marketingColors.textSecondary }} aria-label="Instagram">
                  <IconBrandInstagram size={20} />
                </Anchor>
              </Group>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 6, md: 4 }}>
            <Stack gap="md">
              <Text fw={600} style={{ color: marketingColors.textPrimary }}>Product</Text>
              {footerLinks.product.map((link) => (
                <Anchor
                  key={link.href}
                  component={Link}
                  href={link.href}
                  size="sm"
                  style={{ color: marketingColors.textSecondary }}
                >
                  {link.label}
                </Anchor>
              ))}
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 6, md: 4 }}>
            <Stack gap="md">
              <Text fw={600} style={{ color: marketingColors.textPrimary }}>Company</Text>
              {footerLinks.company.map((link) => (
                <Anchor
                  key={link.href}
                  component={Link}
                  href={link.href}
                  size="sm"
                  style={{ color: marketingColors.textSecondary }}
                >
                  {link.label}
                </Anchor>
              ))}
            </Stack>
          </Grid.Col>
        </Grid>

        <Text
          size="sm"
          ta="center"
          mt="xl"
          pt="xl"
          style={{
            color: marketingColors.textSecondary,
            borderTop: `1px solid ${marketingColors.borderPrimary}`,
          }}
        >
          © {new Date().getFullYear()} NTG Alma. All rights reserved.
        </Text>
      </Container>
    </footer>
  );
}

