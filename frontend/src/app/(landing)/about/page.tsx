'use client';

import type { ComponentType } from 'react';
import { MarketingHeader } from '@/components/marketing/Header';
import { MarketingFooter } from '@/components/marketing/Footer';
import { Container, Title, Text, Stack, Card, Button, Group, Box, Grid } from '@mantine/core';
import { motion } from 'framer-motion';
import { IconUsers, IconTarget, IconHeartHandshake, IconRocket } from '@tabler/icons-react';
import { GeometricAccent } from '@/components/marketing/GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';
import { PageCTASection } from '@/components/marketing/sections/PageCTASection';

const values = [
  {
    icon: IconTarget,
    title: 'Our mission',
    description:
      'To empower schools and trusts with technology that simplifies day-to-day operations and puts learning first.',
  },
  {
    icon: IconUsers,
    title: 'Our team',
    description:
      'Developers, educators, and operations specialists working together to build the best School Management System.',
  },
  {
    icon: IconHeartHandshake,
    title: 'Our values',
    description:
      'Transparency, reliability, and putting schools and families first. Your success is our success.',
  },
  {
    icon: IconRocket,
    title: 'Our vision',
    description:
      'To become the leading school management platform globally, helping institutions of every size thrive.',
  },
];

function ValueCard({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: ComponentType<{ size?: number | string }>;
  title: string;
  description: string;
  index: number;
}) {
  const marketingColors = useMarketingColors();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card
        shadow="md"
        padding="xl"
        radius="lg"
        withBorder
        style={{
          borderWidth: '2px',
          borderColor: marketingColors.borderPrimary,
          background: marketingColors.gradientCard,
          transition: 'all 0.3s ease',
          height: '100%',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-8px)';
          e.currentTarget.style.boxShadow = `0 20px 40px ${marketingColors.shadowCardHover}`;
          e.currentTarget.style.borderColor = marketingColors.borderHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '';
          e.currentTarget.style.borderColor = marketingColors.borderPrimary;
        }}
      >
        <Stack gap="md" align="center" ta="center">
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              backgroundColor: marketingColors.primaryBackground,
              color: marketingColors.primary,
            }}
          >
            <Icon size={40} />
          </Box>
          <Title order={3} size="h4" fw={700} style={{ color: marketingColors.textPrimary }}>
            {title}
          </Title>
          <Text size="md" style={{ color: marketingColors.textSecondary, lineHeight: 1.7 }}>
            {description}
          </Text>
        </Stack>
      </Card>
    </motion.div>
  );
}

export default function AboutPage() {
  const marketingColors = useMarketingColors();

  return (
    <>
      <MarketingHeader />
      <main style={{ paddingTop: '80px' }}>
        {/* Hero Section */}
        <Box style={{ position: 'relative', overflow: 'hidden' }}>
          <GeometricAccent position="top-right" color="primary" size="large" />
          <GeometricAccent position="bottom-left" color="secondary" size="medium" />
          <GeometricAccent position="top-left" color="primary" size="small" />
          <GeometricAccent position="bottom-right" color="secondary" size="small" />
          
          <Container size="xl" pt={{ base: 'xl', md: 100 }} pb={{ base: 'xl', md: 40 }} style={{ position: 'relative', zIndex: 1 }}>
            <Stack gap="xl" align="center">
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
                  About NTG Alma
                </Title>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Text 
                  size="md"
                  fz={{ base: 'var(--mantine-font-size-md)', md: 'var(--mantine-font-size-xl)' }}
                  maw={700}
                  style={{ 
                    color: marketingColors.textSecondary,
                    fontWeight: 500,
                  }}
                >
                  We&apos;re building the future of school management, one feature at a time — born from a deep understanding of how schools and trusts actually run.
                </Text>
              </motion.div>
            </Stack>
          </Container>
        </Box>

        {/* Values Section */}
        <Box style={{ position: 'relative', overflow: 'hidden' }}>
          <GeometricAccent position="top-left" color="primary" size="medium" />
          <GeometricAccent position="bottom-right" color="secondary" size="large" />
          
          <Container size="xl" py={{ base: 'xl', md: 80 }} style={{ position: 'relative', zIndex: 1 }}>
            <Grid>
              {values.map((value, index) => (
                <Grid.Col key={value.title} span={{ base: 12, sm: 6, md: 6 }}>
                  <ValueCard {...value} index={index} />
                </Grid.Col>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Story Section */}
        <Box style={{ position: 'relative', overflow: 'hidden' }}>
          <GeometricAccent position="top-right" color="primary" size="medium" />
          
          <Container size="xl" py={{ base: 'xl', md: 80 }} style={{ position: 'relative', zIndex: 1 }}>
            <Card
              shadow="xl"
              padding={60}
              radius="lg"
              style={{
                background: marketingColors.gradientCard,
                borderWidth: '2px',
                borderColor: marketingColors.borderPrimary,
              }}
            >
              <Stack gap="lg">
                <Title order={2} size="h2" fw={700} style={{ color: marketingColors.textPrimary }}>
                  Our Story
                </Title>
                <Text size="lg" style={{ color: marketingColors.textSecondary, lineHeight: 1.8 }}>
                  NTG Alma was founded to make school operations effortless. After years alongside schools and trusts, we kept seeing the same problem: data scattered across spreadsheets, legacy systems, and inbox threads — with no single view for leadership or parents.
                </Text>
                <Text size="lg" style={{ color: marketingColors.textSecondary, lineHeight: 1.8 }}>
                  We set out to unify attendance, timetables, assessments, communication, and reporting in one cloud platform — with multi-language and multi-branch support built in. Today we support schools from single sites to large trusts, helping them save time and stay aligned.
                </Text>
              </Stack>
            </Card>
          </Container>
        </Box>

        {/* CTA Section */}
        <PageCTASection
          title="Join Us on This Journey"
          description="Let&apos;s work together to transform your school operations"
          primaryButtonText="Signup"
          primaryButtonHref="/login"
          secondaryButtonText="View Pricing"
          secondaryButtonHref="/pricing"
        />
      </main>
      <MarketingFooter />
    </>
  );
}

