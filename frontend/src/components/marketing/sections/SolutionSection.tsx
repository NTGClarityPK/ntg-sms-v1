'use client';

import { Container, Title, Text, Grid, Card, Stack, Group, Button, Box } from '@mantine/core';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, type ComponentType } from 'react';
import Link from 'next/link';
import {
  IconSchool,
  IconCalendarEvent,
  IconUsers,
  IconChartBar,
  IconBook,
  IconBell,
  IconArrowRight,
} from '@tabler/icons-react';
import { GradientBackground } from '../GradientBackground';
import { GeometricAccent } from '../GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';

const solutions = [
  {
    icon: IconSchool,
    title: 'Student & class records',
    description: 'Central pupil profiles, class sections, and academic structure in one place',
  },
  {
    icon: IconCalendarEvent,
    title: 'Timetables & events',
    description: 'Schedules, exams, and school events visible to staff and parents',
  },
  {
    icon: IconBook,
    title: 'Assessments & grades',
    description: 'Continuous assessment, grade books, and progress reporting',
  },
  {
    icon: IconUsers,
    title: 'Staff & roles',
    description: 'Role-based access, secure logins, and delegated permissions',
  },
  {
    icon: IconBell,
    title: 'Parent communication',
    description: 'Announcements, notifications, and portal access for guardians',
  },
  {
    icon: IconChartBar,
    title: 'Reports & analytics',
    description: 'Attendance, performance, and branch-level dashboards',
  },
];

function SolutionCard({
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
              Everything Your School Needs in One System
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

