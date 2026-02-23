'use client';

import { Container, Title, Text, Stack, Group, Button, Card, Box } from '@mantine/core';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconArrowRight, IconShield, IconCloud, IconAward, IconPhone } from '@tabler/icons-react';
import { GeometricAccent } from '../GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';
import { useAuthStore } from '@/lib/store/auth-store';
import styles from './FinalCTASection.module.css';

const trustBadges = [
  { icon: IconShield, text: 'Bank-Level Security' },
  { icon: IconCloud, text: '99.9% Uptime' },
  { icon: IconAward, text: 'SOC 2 Certified' },
  { icon: IconPhone, text: '24/7 Support' },
];

export function FinalCTASection() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const marketingColors = useMarketingColors();

  const handleLoginClick = () => {
    if (isAuthenticated) {
      router.push('/portal/dashboard');
    } else {
      router.push('/login');
    }
  };

  return (
    <Box style={{ position: 'relative', overflow: 'hidden' }}>
      <GeometricAccent position="top-left" color="primary" size="large" />
      <GeometricAccent position="bottom-right" color="secondary" size="medium" />
      
      <Container size="xl" py={{ base: 'xl', md: 80 }} style={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Card
            p={{ base: 'xl', md: 60 }}
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
                Ready to Transform Your Restaurant?
              </Title>
              <Text 
                size="md"
                maw={600} 
                className={styles.ctaDescriptionText}
                style={{ color: '#ffffff !important' }}
              >
                Start transforming your restaurant operations today with our comprehensive POS solution
              </Text>
            </Box>
            <Group gap="md" justify="center">
              <Button
                component={Link}
                href="/login"
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
                  e.currentTarget.style.setProperty('border', '2px solid #ffffff', 'important'); // Same as default bg
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
                Signup
              </Button>
              <Button
                component={Link}
                href="/contact"
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
                Talk to Sales
              </Button>
            </Group>
            <Group gap="xl" mt="md" justify="center" className="cta-white-text">
              {trustBadges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <Group key={badge.text} gap="xs">
                    <Icon size={20} style={{ color: '#ffffff !important' }} />
                    <Text size="sm" style={{ color: '#ffffff !important' }}>
                      {badge.text}
                    </Text>
                  </Group>
                );
              })}
            </Group>
          </Stack>
        </Card>
      </motion.div>
      </Container>
    </Box>
  );
}

