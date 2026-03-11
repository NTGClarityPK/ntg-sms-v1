'use client';

import { Container, Title, Text, Stack, Card, Avatar, Group, Box } from '@mantine/core';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { GeometricAccent } from '../GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';

const testimonials = [
  {
    quote: 'Cut admin time dramatically',
    content:
      'Before NTG Alma, attendance and reports lived in spreadsheets. Now everything is in one place.',
    name: 'Ahmed',
    role: 'Principal',
    context: 'of a multi-branch school group',
  },
  {
    quote: 'Parents finally see the full picture',
    content:
      'Announcements and timetables are visible on the portal — fewer phone calls and clearer expectations.',
    name: 'Sara',
    role: 'Head of Administration',
    context: 'of an international curriculum school',
  },
  {
    quote: 'One system across all campuses',
    content:
      'We roll out updates once and every branch benefits. Reporting at trust level is finally practical.',
    name: 'Omar',
    role: 'IT Lead',
    context: 'of a trust with 8 schools',
  },
];

function TestimonialCard({
  quote,
  content,
  name,
  role,
  context,
  index,
}: {
  quote: string;
  content: string;
  name: string;
  role: string;
  context: string;
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
          <Text
            size="lg"
            fw={700}
            style={{
              color: marketingColors.primary,
              fontFamily: 'var(--font-audiowide)',
              textShadow: `0 2px 8px ${marketingColors.shadowPrimary}`,
            }}
          >
            &ldquo;{quote}&rdquo;
          </Text>
          <Text size="md" style={{ color: marketingColors.textSecondary, fontStyle: 'italic' }}>
            {content}
          </Text>
          <Group gap="md" mt="auto">
            <Avatar
              radius="xl"
              color="primary"
              styles={{
                root: {
                  backgroundColor: `${marketingColors.primary} !important`,
                  color: `${marketingColors.textOnPrimary} !important`,
                },
              }}
            >
              {name.charAt(0)}
            </Avatar>
            <div>
              <Text fw={600} style={{ color: marketingColors.textPrimary }}>{name}</Text>
              <Text size="sm" style={{ color: marketingColors.textSecondary }}>
                {role}, {context}
              </Text>
            </div>
          </Group>
        </Stack>
      </Card>
    </motion.div>
  );
}

export function TestimonialsSection() {
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
              Trusted by Schools Worldwide
            </Title>
          </motion.div>
        </Stack>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
          }}
        >
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={testimonial.name} {...testimonial} index={index} />
          ))}
        </div>
      </Container>
    </Box>
  );
}
