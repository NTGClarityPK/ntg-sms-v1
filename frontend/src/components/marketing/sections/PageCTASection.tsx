'use client';

import { Container, Title, Text, Stack, Card, Button, Group, Box } from '@mantine/core';
import Link from 'next/link';
import { IconArrowRight } from '@tabler/icons-react';
import { GeometricAccent } from '../GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';

interface PageCTASectionProps {
  title: string;
  description: string;
  primaryButtonText?: string;
  primaryButtonHref?: string;
  secondaryButtonText?: string;
  secondaryButtonHref?: string;
}

export function PageCTASection({
  title,
  description,
  primaryButtonText = 'Signup',
  primaryButtonHref = '/login',
  secondaryButtonText = 'View Pricing',
  secondaryButtonHref = '/pricing',
}: PageCTASectionProps) {
  const marketingColors = useMarketingColors();

  return (
    <Box style={{ position: 'relative', overflow: 'hidden' }}>
      <GeometricAccent position="top-right" color="primary" size="medium" />
      
      <Container size="xl" py={{ base: 'xl', md: 80 }} style={{ position: 'relative', zIndex: 1 }}>
        <Card
          padding={60}
          radius="lg"
          style={{
            background: marketingColors.ctaBackground,
            textAlign: 'center',
            boxShadow: `0 20px 60px ${marketingColors.ctaShadow}`,
            border: 'none',
          }}
        >
          <Stack gap="xl" align="center">
            <Box className="cta-white-text">
              <Title
                order={2}
                style={{
                  fontFamily: 'var(--font-audiowide)',
                  color: '#ffffff !important',
                  textShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                }}
              >
                {title}
              </Title>
              <Text 
                size="md"
                maw={600} 
                style={{ color: '#ffffff !important' }}
                fz={{ base: 'var(--mantine-font-size-md)', md: 'var(--mantine-font-size-lg)' }}
              >
                {description}
              </Text>
            </Box>
            <Group gap="md" justify="center">
              <Button
                component={Link}
                href={primaryButtonHref}
                size="lg"
                rightSection={<IconArrowRight size={20} />}
                color={undefined}
                styles={{
                  root: {
                    backgroundColor: '#ffffff !important',
                    color: `${marketingColors.textPrimary} !important`,
                    fontWeight: 700,
                    padding: '16px 32px',
                    borderRadius: '12px',
                    border: '2px solid transparent',
                    transition: 'all 0.3s ease',
                    lineHeight: 1.5,
                    minHeight: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.setProperty('background-color', marketingColors.primary, 'important');
                  e.currentTarget.style.setProperty('color', '#ffffff', 'important');
                  e.currentTarget.style.setProperty('border', '2px solid #ffffff', 'important');
                  const icon = e.currentTarget.querySelector('svg');
                  if (icon) {
                    icon.style.setProperty('color', '#ffffff', 'important');
                  }
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.setProperty('background-color', '#ffffff', 'important');
                  e.currentTarget.style.setProperty('color', marketingColors.textPrimary, 'important');
                  e.currentTarget.style.setProperty('border-color', 'transparent', 'important');
                  const icon = e.currentTarget.querySelector('svg');
                  if (icon) {
                    icon.style.setProperty('color', marketingColors.textPrimary, 'important');
                  }
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {primaryButtonText}
              </Button>
              <Button
                component={Link}
                href={secondaryButtonHref}
                size="lg"
                color={undefined}
                styles={{
                  root: {
                    backgroundColor: '#ffffff !important',
                    color: `${marketingColors.textPrimary} !important`,
                    fontWeight: 600,
                    padding: '16px 32px',
                    borderRadius: '12px',
                    border: '2px solid transparent',
                    transition: 'all 0.3s ease',
                  },
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.setProperty('background-color', marketingColors.primary, 'important');
                  e.currentTarget.style.setProperty('color', '#ffffff', 'important');
                  e.currentTarget.style.setProperty('border-color', '#ffffff', 'important');
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.setProperty('background-color', '#ffffff', 'important');
                  e.currentTarget.style.setProperty('color', marketingColors.textPrimary, 'important');
                  e.currentTarget.style.setProperty('border-color', 'transparent', 'important');
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {secondaryButtonText}
              </Button>
            </Group>
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}
