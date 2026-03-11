'use client';

import { Container, Title, Text, Grid, Card, Stack, List, ThemeIcon, Box } from '@mantine/core';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { IconX } from '@tabler/icons-react';
import { GeometricAccent } from '../GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';

const problems = [
  {
    title: 'Fragmented Data',
    issues: [
      'Spreadsheets and paper registers',
      'Attendance tracked in silos',
      'Parents call for basic updates',
    ],
    result: 'Staff waste hours every week',
  },
  {
    title: 'No Single View',
    issues: [
      "Can't see whole-school trends",
      'Reports pulled manually',
      'Branch data inconsistent',
    ],
    result: 'Decisions without evidence',
  },
  {
    title: 'Complex Tools',
    issues: [
      'Multiple disconnected systems',
      'High licence overlap',
      'Steep training for new staff',
    ],
    result: 'Adoption stalls',
  },
];

function ProblemCard({
  title,
  issues,
  result,
  index,
}: {
  title: string;
  issues: string[];
  result: string;
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
          <Title order={3} size="h4" fw={700} style={{ color: marketingColors.textPrimary }}>
            {title}
          </Title>
          <List
            spacing="sm"
            icon={
              <ThemeIcon color="red" size={20} radius="xl">
                <IconX size={12} />
              </ThemeIcon>
            }
          >
            {issues.map((issue) => (
              <List.Item key={issue}>
                <Text size="sm" style={{ color: marketingColors.textSecondary }}>{issue}</Text>
              </List.Item>
            ))}
          </List>
          <Card
            padding="md"
            radius="md"
            style={{
              backgroundColor: marketingColors.primaryBackground,
              border: `1px solid ${marketingColors.borderPrimary}`,
            }}
          >
            <Text size="sm" fw={600} style={{ color: marketingColors.primary }}>
              Result: {result}
            </Text>
          </Card>
        </Stack>
      </Card>
    </motion.div>
  );
}

export function ProblemSection() {
  const marketingColors = useMarketingColors();
  
  return (
    <Box style={{ position: 'relative', overflow: 'hidden' }}>
      <GeometricAccent position="top-left" color="primary" size="medium" />
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
              Stop Losing Time on Manual School Operations
            </Title>
          </motion.div>
        </Stack>

        <Grid>
          {problems.map((problem, index) => (
            <Grid.Col key={problem.title} span={{ base: 12, md: 4 }}>
              <ProblemCard {...problem} index={index} />
            </Grid.Col>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

