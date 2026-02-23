'use client';

import { MarketingHeader } from '@/components/marketing/Header';
import { MarketingFooter } from '@/components/marketing/Footer';
import { Container, Title, Text, Stack, Card, Button, List, ThemeIcon, Group, Box, Badge } from '@mantine/core';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { IconCheck } from '@tabler/icons-react';
import { GeometricAccent } from '@/components/marketing/GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';
import { PageCTASection } from '@/components/marketing/sections/PageCTASection';
import { plans } from '@/lib/constants/plans';

function PricingCard({ plan, index }: { plan: typeof plans[0]; index: number }) {
  const marketingColors = useMarketingColors();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      style={{ width: '100%', height: '100%', display: 'flex', flex: 1 }}
    >
      <Card
        shadow={plan.popular ? 'xl' : 'md'}
        padding="xl"
        radius="lg"
        withBorder
        style={{
          border: plan.popular ? `3px solid ${marketingColors.primary}` : `2px solid ${marketingColors.borderPrimary}`,
          background: marketingColors.gradientCard,
          position: 'relative',
          transition: 'all 0.3s ease',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '600px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-8px)';
          e.currentTarget.style.boxShadow = `0 20px 40px ${marketingColors.shadowCardHover}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '';
        }}
      >
        <Stack gap="md" style={{ flex: 1, position: 'relative' }}>
          {plan.popular && (
            <Badge
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: marketingColors.primary,
                color: marketingColors.textOnPrimary,
                fontWeight: 700,
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                zIndex: 10,
              }}
            >
              Most Popular
            </Badge>
          )}
          <div>
            <Title order={2} size="h3" fw={700} style={{ color: marketingColors.textPrimary }}>
              {plan.name}
            </Title>
            <Group gap={4} align="baseline" mt="xs">
              <Text size="2.5rem" fw={900} style={{ color: marketingColors.primary }}>
                {plan.price}
              </Text>
              {plan.priceNote && (
                <Text size="md" style={{ color: marketingColors.textSecondary }}>
                  {plan.priceNote}
                </Text>
              )}
            </Group>
          </div>

          <Stack gap="xs" mt="md">
            <Group gap="xs">
              <Text size="sm" fw={600} style={{ color: marketingColors.textSecondary }}>
                Locations:
              </Text>
              <Text size="sm" style={{ color: marketingColors.textPrimary }}>
                {plan.locations}
              </Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" fw={600} style={{ color: marketingColors.textSecondary }}>
                Users:
              </Text>
              <Text size="sm" style={{ color: marketingColors.textPrimary }}>
                {plan.users}
              </Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" fw={600} style={{ color: marketingColors.textSecondary }}>
                Menu Items:
              </Text>
              <Text size="sm" style={{ color: marketingColors.textPrimary }}>
                {plan.menuItems}
              </Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" fw={600} style={{ color: marketingColors.textSecondary }}>
                Orders/Month:
              </Text>
              <Text size="sm" style={{ color: marketingColors.textPrimary }}>
                {plan.ordersMonth}
              </Text>
            </Group>
          </Stack>

          <List
            spacing="xs"
            size="sm"
            mt="md"
            icon={
              <ThemeIcon color={marketingColors.primary} size={20} radius="xl">
                <IconCheck size={12} />
              </ThemeIcon>
            }
          >
            {plan.features.map((feature, idx) => (
              <List.Item key={idx} style={{ color: marketingColors.textSecondary }}>
                {feature}
              </List.Item>
            ))}
          </List>

          <Button
            component={Link}
            href={plan.price === 'Custom' ? '/contact' : '/login'}
            fullWidth
            mt="auto"
            color={undefined}
            styles={{
              root: {
                backgroundColor: `${marketingColors.primary} !important`,
                color: `${marketingColors.textOnPrimary} !important`,
                fontWeight: 600,
                padding: '14px 24px',
                borderRadius: '12px',
                border: '2px solid transparent',
                transition: 'all 0.3s ease',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                minHeight: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              },
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.setProperty('background-color', marketingColors.backgroundPrimary, 'important');
              e.currentTarget.style.setProperty('color', marketingColors.textPrimary, 'important');
              e.currentTarget.style.setProperty('border', `2px solid ${marketingColors.primary}`, 'important');
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.setProperty('background-color', marketingColors.primary, 'important');
              e.currentTarget.style.setProperty('color', marketingColors.textOnPrimary, 'important');
              e.currentTarget.style.setProperty('border-color', 'transparent', 'important');
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
          </Button>
        </Stack>
      </Card>
    </motion.div>
  );
}

export default function PricingPage() {
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
                  Simple, Transparent Pricing
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
                  fz={{ base: 'var(--mantine-font-size-md)', md: 'var(--mantine-font-size-xl)' }}
                  style={{ 
                    color: marketingColors.textSecondary,
                    fontWeight: 500,
                  }}
                >
                  Choose the perfect plan for your restaurant. All plans include our core features with no hidden fees.
                </Text>
              </motion.div>
            </Stack>
          </Container>
        </Box>

        {/* Pricing Cards */}
        <Box style={{ position: 'relative', overflow: 'hidden' }}>
          <GeometricAccent position="top-left" color="primary" size="medium" />
          <GeometricAccent position="bottom-right" color="secondary" size="large" />
          
          <Container size="xl" py={{ base: 'xl', md: 80 }} style={{ position: 'relative', zIndex: 1 }}>
            <Box
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 'var(--mantine-spacing-md)',
                width: '100%',
              }}
            >
              {plans.map((plan, index) => (
                <PricingCard key={plan.name} plan={plan} index={index} />
              ))}
            </Box>
          </Container>
        </Box>

        {/* CTA Section */}
        <PageCTASection
          title="Ready to Get Started?"
          description="Sign-Up to get started right-away or contact us to discuss your restaurant's needs and find the perfect plan"
          primaryButtonText="Signup"
          primaryButtonHref="/login"
          secondaryButtonText="Contact Sales"
          secondaryButtonHref="/contact"
        />
      </main>
      <MarketingFooter />
    </>
  );
}

