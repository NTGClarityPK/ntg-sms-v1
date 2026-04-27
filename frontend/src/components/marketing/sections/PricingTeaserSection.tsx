'use client';

import { Container, Title, Text, Stack, Card, Button, Group, Box, Badge } from '@mantine/core';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { IconArrowRight, IconCircleCheckFilled, IconCircleXFilled } from '@tabler/icons-react';
import { GeometricAccent } from '../GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';
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
          <div style={{ marginTop: plan.popular ? '0' : '0' }}>
            <Text
              size="sm"
              fw={600}
              style={{
                color: marketingColors.primary,
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              {plan.name} Plan
            </Text>
            {'summary' in plan && (
              <Text size="sm" mt="xs" style={{ color: marketingColors.textSecondary, lineHeight: 1.45 }}>
                {plan.summary}
              </Text>
            )}
            <Group align="baseline" gap={4} mt="xs">
              <Text
                size="2.5rem"
                fw={700}
                style={{
                  fontFamily: 'var(--font-audiowide)',
                  color: marketingColors.textPrimary,
                }}
              >
                {plan.price}
              </Text>
              {plan.priceNote && (
                <Text size="sm" style={{ color: marketingColors.textSecondary }}>
                  {plan.priceNote}
                </Text>
              )}
            </Group>
          </div>

          <Stack gap="xs" mt="md">
            {'highlights' in plan &&
              plan.highlights.map((item) => (
                <Group key={item.label} align="flex-start" gap="xs" wrap="nowrap">
                  {item.included ? (
                    <IconCircleCheckFilled size={16} style={{ marginTop: 2, flexShrink: 0 }} color={marketingColors.textPrimary} />
                  ) : (
                    <IconCircleXFilled size={16} style={{ marginTop: 2, flexShrink: 0 }} color="#ef4444" />
                  )}
                  <Text size="sm" style={{ color: marketingColors.textPrimary, lineHeight: 1.4 }}>
                    {item.label}
                  </Text>
                </Group>
              ))}
          </Stack>


          <Button
            component={Link}
            href={plan.price === 'Contact sales' ? '/contact' : '/login'}
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
            {plan.price === 'Contact sales' ? 'Contact Sales' : 'Get Started'}
          </Button>
        </Stack>
      </Card>
    </motion.div>
  );
}

export function PricingTeaserSection() {
  const marketingColors = useMarketingColors();
  
  return (
    <Box style={{ position: 'relative', overflow: 'hidden' }}>
      <GeometricAccent position="bottom-right" color="primary" size="large" />
      
      <Container size="xl" py={{ base: 'xl', md: 80 }} style={{ position: 'relative', zIndex: 1 }}>
        <Stack gap="xl" mb="xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Title
              order={2}
              ta="center"
              fw={900}
              style={{ 
                fontFamily: 'var(--font-audiowide)',
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                color: marketingColors.textPrimary,
                textShadow: `0 2px 10px ${marketingColors.shadowCard}`,
                letterSpacing: '-0.02em',
              }}
            >
              Simple, Transparent Pricing
            </Title>
          </motion.div>
        </Stack>

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

        <Group justify="center" mt="xl">
          <Button
            component={Link}
            href="/pricing"
            size="lg"
            rightSection={<IconArrowRight size={20} />}
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
            View Full Pricing Details
          </Button>
        </Group>
      </Container>
    </Box>
  );
}

