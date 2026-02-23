'use client';

import { Container, Title, Text, Stack, Grid, Card, Group, Button, Box } from '@mantine/core';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import Link from 'next/link';
import { IconCheck, IconArrowRight } from '@tabler/icons-react';
import { GeometricAccent } from '../GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';

const steps = [
  {
    number: '1',
    title: 'Quick Setup (1 Hour)',
    items: ['Create account', 'Add your menu items', 'Configure payment methods'],
  },
  {
    number: '2',
    title: 'Train Your Team (1 Hour)',
    items: [
      'Watch training videos',
      'Practice with test orders',
      'Get familiar with interface',
    ],
  },
  {
    number: '3',
    title: 'Go Live (Same Day)',
    items: [
      'Start taking real orders',
      'Kitchen sees orders instantly',
      'Track everything automatically',
    ],
  },
];

function StepCard({
  number,
  title,
  items,
  index,
}: {
  number: string;
  title: string;
  items: string[];
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const marketingColors = useMarketingColors();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
      transition={{ duration: 0.5, delay: index * 0.2 }}
    >
      <Card 
        shadow="xl" 
        padding="xl" 
        radius="md" 
        withBorder 
        h="100%"
        style={{
          borderWidth: '2px',
          borderColor: marketingColors.borderPrimary,
          transition: 'all 0.3s ease',
          background: marketingColors.gradientCard,
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
        <Stack gap="md">
          <Group gap="md">
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: marketingColors.primary,
                color: marketingColors.textOnPrimary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 700,
                fontFamily: 'var(--font-audiowide)',
                boxShadow: `0 8px 20px ${marketingColors.shadowPrimary}`,
              }}
            >
              {number}
            </div>
            <Title order={3} size="h4" fw={700} style={{ color: marketingColors.textPrimary }}>
              {title}
            </Title>
          </Group>
          <Stack gap="xs" mt="md">
            {items.map((item) => (
              <Group key={item} gap="xs">
                <IconCheck size={16} color={marketingColors.primary} />
                <Text size="sm" style={{ color: marketingColors.textSecondary }}>{item}</Text>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Card>
    </motion.div>
  );
}

export function HowItWorksSection() {
  const marketingColors = useMarketingColors();
  
  return (
    <Box style={{ position: 'relative', overflow: 'hidden' }}>
      <GeometricAccent position="top-right" color="primary" size="medium" />
      
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
              Start Serving Customers in 3 Simple Steps
            </Title>
          </motion.div>
        </Stack>

        <Grid>
          {steps.map((step, index) => (
            <Grid.Col key={step.number} span={{ base: 12, md: 4 }}>
              <StepCard {...step} index={index} />
            </Grid.Col>
          ))}
        </Grid>

        <Group justify="center" mt="xl">
          <Button
            component={Link}
            href="/contact"
            size="lg"
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
            Schedule Free Setup Call
          </Button>
        </Group>
      </Container>
    </Box>
  );
}

