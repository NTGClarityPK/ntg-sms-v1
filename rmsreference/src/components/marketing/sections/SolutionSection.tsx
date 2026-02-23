'use client';

import { Container, Title, Text, Grid, Card, Stack, Group, Button, Box } from '@mantine/core';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import Link from 'next/link';
import {
  IconShoppingCart,
  IconDeviceDesktop,
  IconPackage,
  IconUsers,
  IconUser,
  IconChartBar,
  IconArrowRight,
} from '@tabler/icons-react';
import { GradientBackground } from '../GradientBackground';
import { GeometricAccent } from '../GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';

const solutions = [
  {
    icon: IconShoppingCart,
    title: 'Point of Sale',
    description: 'Fast order taking with images, variations, and instant payment',
  },
  {
    icon: IconDeviceDesktop,
    title: 'Kitchen Display',
    description: 'Orders appear instantly on kitchen screens with audio alerts',
  },
  {
    icon: IconPackage,
    title: 'Inventory Control',
    description: 'Track stock, get low-stock alerts, prevent waste',
  },
  {
    icon: IconUsers,
    title: 'Staff Management',
    description: 'Role-based access, performance tracking, secure logins',
  },
  {
    icon: IconUser,
    title: 'Customer Database',
    description: 'Save customer details, order history, loyalty tiers',
  },
  {
    icon: IconChartBar,
    title: 'Real-Time Reports',
    description: 'Sales, profits, trends - see everything live',
  },
];

function SolutionCard({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: any;
  title: string;
  description: string;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const marketingColors = useMarketingColors();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card 
        shadow="xl" 
        padding="lg" 
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
          <Group>
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: marketingColors.primaryBackground,
                color: marketingColors.primary,
                boxShadow: `0 4px 12px ${marketingColors.shadowPrimary}`,
              }}
            >
              <Icon size={24} />
            </div>
          </Group>
          <Title order={3} size="h4" fw={700} style={{ color: marketingColors.textPrimary }}>
            {title}
          </Title>
          <Text size="sm" style={{ color: marketingColors.textSecondary, fontWeight: 500 }}>
            {description}
          </Text>
        </Stack>
      </Card>
    </motion.div>
  );
}

export function SolutionSection() {
  const marketingColors = useMarketingColors();
  
  return (
    <Box style={{ position: 'relative', overflow: 'hidden' }}>
      <GradientBackground variant="secondary" intensity="light" />
      <GeometricAccent position="bottom-right" color="secondary" size="large" />
      
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
              Everything Your Restaurant Needs in One System
            </Title>
          </motion.div>
        </Stack>

        <Grid>
          {solutions.map((solution, index) => (
            <Grid.Col key={solution.title} span={{ base: 12, sm: 6, md: 4 }}>
              <SolutionCard {...solution} index={index} />
            </Grid.Col>
          ))}
        </Grid>

        <Group justify="center" mt="xl">
          <Button
            component={Link}
            href="/features"
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
            Explore All Features
          </Button>
        </Group>
      </Container>
    </Box>
  );
}

