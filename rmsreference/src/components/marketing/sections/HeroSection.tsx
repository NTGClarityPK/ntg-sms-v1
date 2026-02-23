'use client';

import { Container, Title, Text, Group, Button, Stack, Box, Image } from '@mantine/core';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { IconArrowRight } from '@tabler/icons-react';
import { GradientBackground } from '../GradientBackground';
import { GeometricAccent } from '../GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';
import { ImageLightbox } from '@/components/shared/ImageLightbox';
import styles from './HeroSection.module.css';

export function HeroSection() {
  const marketingColors = useMarketingColors();

  return (
    <Box style={{ position: 'relative', overflow: 'hidden' }}>
      <GradientBackground variant="primary" intensity="medium" />
      <GeometricAccent position="top-right" color="primary" size="large" />
      <GeometricAccent position="bottom-left" color="secondary" size="medium" />
      
      <Container size="xl" py={{ base: 'xl', md: 80 }} style={{ position: 'relative', zIndex: 1 }}>
        <Stack gap="xl" align="center" ta="center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Title
              order={1}
              fw={900}
              style={{
                fontFamily: 'var(--font-audiowide)',
                lineHeight: 1.2,
                background: marketingColors.gradientPrimaryToSecondary,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: `0 4px 20px ${marketingColors.shadowPrimary}`,
                letterSpacing: '-0.02em',
                color: marketingColors.textPrimary,
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              }}
            >
              Transform Your Restaurant
              <br />
              Operations in One Day
            </Title>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Text 
              size="md"
              maw={700}
              className={styles.heroDescriptionText}
              style={{ 
                color: marketingColors.textSecondary,
                fontWeight: 500,
              }}
            >
              Complete cloud-based POS system with kitchen display, inventory management, and
              real-time analytics.
            </Text>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Group gap="md" justify="center">
              <Button
                component={Link}
                href="/login"
                size="lg"
                rightSection={<IconArrowRight size={20} />}
                color={undefined}
                styles={{
                  root: {
                    backgroundColor: `${marketingColors.primary} !important`,
                    color: `${marketingColors.textOnPrimary} !important`,
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
                  e.currentTarget.style.setProperty('background-color', marketingColors.backgroundPrimary, 'important');
                  e.currentTarget.style.setProperty('color', marketingColors.textPrimary, 'important');
                  e.currentTarget.style.setProperty('border', `2px solid ${marketingColors.primary}`, 'important'); // Same as default bg
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.setProperty('background-color', marketingColors.primary, 'important');
                  e.currentTarget.style.setProperty('color', marketingColors.textOnPrimary, 'important');
                  e.currentTarget.style.setProperty('border-color', 'transparent', 'important');
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Login
              </Button>
              <Button
                component={Link}
                href="/pricing"
                size="lg"
                color={undefined}
                styles={{
                  root: {
                    backgroundColor: `${marketingColors.primary} !important`,
                    color: `${marketingColors.textOnPrimary} !important`,
                    fontWeight: 600,
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
                  e.currentTarget.style.setProperty('background-color', marketingColors.backgroundPrimary, 'important');
                  e.currentTarget.style.setProperty('color', marketingColors.textPrimary, 'important');
                  e.currentTarget.style.setProperty('border', `2px solid ${marketingColors.primary}`, 'important'); // Same as default bg
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.setProperty('background-color', marketingColors.primary, 'important');
                  e.currentTarget.style.setProperty('color', marketingColors.textOnPrimary, 'important');
                  e.currentTarget.style.setProperty('border-color', 'transparent', 'important');
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                See Pricing
              </Button>
            </Group>
          </motion.div>

        {/* Hero Demo Image/Video */}
        <ImageLightbox src="/RMS UI.png" alt="NTG Resto Dashboard Demo">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            style={{
              width: '100%',
              maxWidth: '1200px',
              aspectRatio: '1920 / 1080',
              borderRadius: '12px',
              marginTop: '2rem',
              boxShadow: `0 20px 60px ${marketingColors.shadowCard}`,
              border: `2px solid ${marketingColors.borderPrimary}`,
              overflow: 'hidden',
              position: 'relative',
              backgroundColor: marketingColors.backgroundSecondary,
            }}
          >
            <Image
              src="/RMS UI.png"
              alt="NTG Resto Dashboard Demo"
              fit="cover"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
              onError={(e) => {
                // Show placeholder if image doesn't exist
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const placeholder = target.parentElement?.querySelector('.image-placeholder') as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = 'flex';
                }
              }}
            />
            <Box
              className="image-placeholder"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: marketingColors.backgroundSecondary,
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <Text c="dimmed" style={{ fontWeight: 500, fontSize: '1.1rem' }}>
                Dashboard Screenshot / Demo Video
              </Text>
              <Text size="sm" c="dimmed" style={{ opacity: 0.7 }}>
                1920 x 1080 placeholder
              </Text>
            </Box>
          </motion.div>
        </ImageLightbox>
      </Stack>
      </Container>
    </Box>
  );
}

