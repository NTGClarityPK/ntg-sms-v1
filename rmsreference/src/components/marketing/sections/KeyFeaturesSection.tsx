'use client';

import { Container, Title, Text, Grid, Card, Stack, Group, Box } from '@mantine/core';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { HiOutlineGlobeAlt, HiOutlineCreditCard, HiOutlineOfficeBuilding, HiOutlineDeviceMobile } from 'react-icons/hi';
import { GeometricAccent } from '../GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';

const features = [
  {
    icon: HiOutlineGlobeAlt,
    emoji: '🌍',
    title: 'Multi-Language Support',
    items: [
      'Multiple languages with RTL support',
      'New languages added within a day',
      'Full localization for system and user data',
    ],
  },
  {
    icon: HiOutlineCreditCard,
    emoji: '💳',
    title: 'Flexible Payment Methods',
    items: [
      'Multiple payment gateway integrations',
      'Regional payment method support',
      'Cash, cards, bank transfers, and more',
    ],
  },
  {
    icon: HiOutlineOfficeBuilding,
    emoji: '🏢',
    title: 'Multi-Branch Ready',
    items: [
      'Manage unlimited locations',
      'Centralized reporting',
      'Transfer stock between branches',
    ],
  },
  {
    icon: HiOutlineDeviceMobile,
    emoji: '📱',
    title: 'Works Anywhere',
    items: [
      'Cloud-based system',
      'Access from any device',
      'No special hardware needed',
    ],
  },
];

function FeatureCard({
  icon: Icon,
  emoji,
  title,
  items,
  index,
}: {
  icon: any;
  emoji: string;
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
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card 
        shadow="xl" 
        padding="xl" 
        radius="md" 
        withBorder 
        h="100%"
        style={{
          borderWidth: '2px',
          borderColor: marketingColors.borderSecondary,
          transition: 'all 0.3s ease',
          background: marketingColors.gradientCard,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-8px)';
          e.currentTarget.style.boxShadow = `0 20px 40px ${marketingColors.shadowSecondaryHover}`;
          e.currentTarget.style.borderColor = marketingColors.borderSecondaryHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '';
          e.currentTarget.style.borderColor = marketingColors.borderSecondary;
        }}
      >
        <Stack gap="md">
          <Group gap="md">
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                borderRadius: '12px',
                backgroundColor: marketingColors.primaryBackground,
                color: marketingColors.primary,
              }}
            >
              <Icon size={32} />
            </Box>
            <Title order={3} size="h4" fw={700} style={{ color: marketingColors.textPrimary }}>
              {title}
            </Title>
          </Group>
          <Stack gap="xs">
            {items.map((item) => (
              <Group key={item} gap="xs">
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: marketingColors.primary,
                  }}
                />
                <Text size="sm" style={{ color: marketingColors.textSecondary }}>{item}</Text>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Card>
    </motion.div>
  );
}

export function KeyFeaturesSection() {
  const marketingColors = useMarketingColors();
  
  return (
    <Box style={{ position: 'relative', overflow: 'hidden' }}>
      <GeometricAccent position="bottom-left" color="secondary" size="large" />
      
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
              Built for Modern Restaurants Worldwide
            </Title>
          </motion.div>
        </Stack>

        <Grid>
          {features.map((feature, index) => (
            <Grid.Col key={feature.title} span={{ base: 12, sm: 6 }}>
              <FeatureCard {...feature} index={index} />
            </Grid.Col>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

