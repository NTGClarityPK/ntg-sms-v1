'use client';

import { MarketingHeader } from '@/components/marketing/Header';
import { MarketingFooter } from '@/components/marketing/Footer';
import { Container, Title, Text, Grid, Card, Stack, Group, Box, Image, Button } from '@mantine/core';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, type ComponentType } from 'react';
import Link from 'next/link';
import {
  IconSchool,
  IconCalendarEvent,
  IconBook,
  IconUsers,
  IconChartBar,
  IconBell,
  IconArrowRight,
} from '@tabler/icons-react';
import { HiOutlineGlobeAlt, HiOutlineOfficeBuilding, HiOutlineDeviceMobile } from 'react-icons/hi';
import { GeometricAccent } from '@/components/marketing/GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';
import { ImageLightbox } from '@/components/shared/ImageLightbox';

const allFeatures = [
  {
    icon: IconSchool,
    title: 'Student & class records',
    description:
      'Central pupil profiles, class sections, and academic structure. Keep enrolment and placement accurate without duplicate spreadsheets.',
    screenshot: '/features/staff-management-screenshot.png',
    category: 'Core',
  },
  {
    icon: IconCalendarEvent,
    title: 'Timetables & scheduling',
    description:
      'Timetables, exams, and room usage in one place. Staff see what matters; conflicts surface before they hit the classroom.',
    screenshot: '/features/kitchen-display-screenshot.png',
    category: 'Core',
  },
  {
    icon: IconBook,
    title: 'Assessments & grades',
    description:
      'Continuous assessment, grade books, and reporting. Share progress with parents through the portal when you choose.',
    screenshot: '/features/reports-screenshot.png',
    category: 'Core',
  },
  {
    icon: IconUsers,
    title: 'Staff & permissions',
    description:
      'Role-based access and secure logins. Delegate safely so teachers and admin see only what they need.',
    screenshot: '/features/staff-management-screenshot.png',
    category: 'Management',
  },
  {
    icon: IconBell,
    title: 'Parent communication',
    description:
      'Announcements, notifications, and portal access. Reduce back-and-forth email and give guardians a single place to look.',
    screenshot: '/features/customers-screenshot.png',
    category: 'Management',
  },
  {
    icon: IconChartBar,
    title: 'Reports & analytics',
    description:
      'Attendance, performance, and branch-level dashboards. Export and share with leadership without manual merges.',
    screenshot: '/features/reports-screenshot.png',
    category: 'Analytics',
  },
  {
    icon: HiOutlineGlobeAlt,
    title: 'Multi-language & RTL',
    description:
      'Arabic, English, and more with full RTL where needed. Localise the interface and key data for your community.',
    screenshot: '/features/multilanguage-screenshot.png',
    category: 'Regional',
  },
  {
    icon: HiOutlineOfficeBuilding,
    title: 'Multi-branch & trusts',
    description:
      'Run multiple campuses with centralised reporting. Align policy once and roll out everywhere.',
    screenshot: '/features/multibranch-screenshot.png',
    category: 'Regional',
  },
  {
    icon: HiOutlineDeviceMobile,
    title: 'Works anywhere',
    description:
      'Cloud-based — staff and parents on laptop, tablet, or phone. No special hardware; focus on teaching, not servers.',
    screenshot: '/features/mobile-screenshot.png',
    category: 'Accessibility',
  },
];

function FeatureCard({
  icon: Icon,
  title,
  description,
  screenshot,
  index,
}: {
  icon: ComponentType<{ size?: number | string }>;
  title: string;
  description: string;
  screenshot?: string;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const isEven = index % 2 === 0;
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
        padding={0}
        radius="md" 
        withBorder 
        style={{
          borderWidth: '2px',
          borderColor: marketingColors.borderPrimary,
          transition: 'all 0.3s ease',
          background: marketingColors.gradientCard,
          overflow: 'hidden',
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
        <Group 
          gap="xl" 
          align="stretch" 
          style={{ 
            flexWrap: 'nowrap',
            flexDirection: isEven ? 'row' : 'row-reverse',
          }}
          visibleFrom="md"
        >
          {/* Content Section */}
          <Stack gap="md" p="xl" style={{ flex: '0 0 40%', minWidth: 0, justifyContent: 'center' }}>
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
                  flexShrink: 0,
                }}
              >
                <Icon size={32} />
              </Box>
              <Title order={2} size="h3" fw={700} style={{ color: marketingColors.textPrimary }}>
                {title}
              </Title>
            </Group>
            <Text size="md" style={{ color: marketingColors.textSecondary, fontWeight: 500, lineHeight: 1.7 }}>
              {description}
            </Text>
          </Stack>

          {/* Screenshot Image - Separate container like hero section */}
          {screenshot && (
            <ImageLightbox src={screenshot} alt={title}>
              <Box
                style={{
                  flex: '1 1 auto',
                  width: '100%',
                  maxWidth: '800px',
                  aspectRatio: '1920 / 1080',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  backgroundColor: marketingColors.primaryBackground,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 10px 30px ${marketingColors.shadowCard}`,
                  border: `2px solid ${marketingColors.borderPrimary}`,
                }}
              >
                <Image
                  src={screenshot}
                  alt={title}
                  fit="contain"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
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
                    backgroundColor: marketingColors.primaryBackground,
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <Text size="sm" c="dimmed" style={{ fontWeight: 500 }}>
                    {title} Screenshot
                  </Text>
                  <Text size="xs" c="dimmed" style={{ opacity: 0.7 }}>
                    1920 x 1080 placeholder
                  </Text>
                </Box>
              </Box>
            </ImageLightbox>
          )}
        </Group>
        
        {/* Mobile Layout - Stacked */}
        <Stack gap={0} hiddenFrom="md">
          {/* Screenshot Image */}
          {screenshot && (
            <ImageLightbox src={screenshot} alt={title}>
              <Box
                style={{
                  aspectRatio: '1920 / 1080',
                  overflow: 'hidden',
                  borderRadius: '12px',
                  boxShadow: `0 10px 30px ${marketingColors.shadowCard}`,
                  border: `2px solid ${marketingColors.borderPrimary}`,
                  backgroundColor: marketingColors.primaryBackground,
                  position: 'relative',
                  margin: '12px',
                  width: 'calc(100% - 24px)',
                }}
              >
                <Image
                  src={screenshot}
                  alt={title}
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
                    backgroundColor: marketingColors.primaryBackground,
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <Text size="sm" c="dimmed" style={{ fontWeight: 500 }}>
                    {title} Screenshot
                  </Text>
                  <Text size="xs" c="dimmed" style={{ opacity: 0.7 }}>
                    1920 x 1080 placeholder
                  </Text>
                </Box>
              </Box>
            </ImageLightbox>
          )}
          
          {/* Content Section */}
          <Stack gap="md" p="xl">
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
                  flexShrink: 0,
                }}
              >
                <Icon size={32} />
              </Box>
              <Title order={2} size="h3" fw={700} style={{ color: marketingColors.textPrimary }}>
                {title}
              </Title>
            </Group>
            <Text size="md" style={{ color: marketingColors.textSecondary, fontWeight: 500, lineHeight: 1.7 }}>
              {description}
            </Text>
          </Stack>
        </Stack>
      </Card>
    </motion.div>
  );
}

export default function FeaturesPage() {
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
                  All Features
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
                  Everything your school needs to run smoothly, all in one powerful system
                </Text>
              </motion.div>
            </Stack>
          </Container>
        </Box>

        {/* Features Grid */}
        <Box style={{ position: 'relative', overflow: 'hidden' }}>
          <GeometricAccent position="top-left" color="primary" size="medium" />
          <GeometricAccent position="bottom-right" color="secondary" size="large" />
          <GeometricAccent position="top-right" color="primary" size="small" />
          <GeometricAccent position="bottom-left" color="secondary" size="small" />
          
          <Container size="xl" py={{ base: 'xl', md: 40 }} style={{ position: 'relative', zIndex: 1 }}>
            <Stack gap="xl">
              {allFeatures.map((feature, index) => (
                <FeatureCard key={feature.title} {...feature} index={index} />
              ))}
            </Stack>
          </Container>
        </Box>

        {/* CTA Section */}
        <Box style={{ position: 'relative', overflow: 'hidden' }}>
          <GeometricAccent position="top-right" color="primary" size="medium" />
          
          <Container size="xl" py={{ base: 'xl', md: 80 }} style={{ position: 'relative', zIndex: 1 }}>
            <Card
              padding={60}
              radius="lg"
              style={{
                background: marketingColors.ctaBackground,
                textAlign: 'center',
                boxShadow: `0 20px 60px ${marketingColors.ctaShadow}`,
                border: 'none',
              }}
            >
              <Stack gap="xl" align="center">
                <Box className="cta-white-text">
                  <Title
                    order={2}
                    style={{
                      fontFamily: 'var(--font-audiowide)',
                      color: '#ffffff !important',
                      textShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                      fontSize: 'clamp(2rem, 4vw, 3rem)',
                    }}
                  >
                    Ready to Get Started?
                  </Title>
                  <Text 
                    size="md"
                    fz={{ base: 'var(--mantine-font-size-md)', md: 'var(--mantine-font-size-lg)' }}
                    maw={600} 
                    style={{ color: '#ffffff !important' }}
                  >
                    See how NTG Alma can transform your school operations
                  </Text>
                </Box>
                <Group gap="md" justify="center">
                  <Button
                    component={Link}
                    href="/login"
                    size="lg"
                    rightSection={<IconArrowRight size={20} />}
                    color={undefined}
                    styles={{
                      root: {
                        backgroundColor: '#ffffff !important',
                        color: `${marketingColors.textPrimary} !important`,
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
                      e.currentTarget.style.setProperty('background-color', marketingColors.primary, 'important');
                      e.currentTarget.style.setProperty('color', '#ffffff', 'important');
                      e.currentTarget.style.setProperty('border', '2px solid #ffffff', 'important'); // Same as default bg
                      const icon = e.currentTarget.querySelector('svg');
                      if (icon) {
                        icon.style.setProperty('color', '#ffffff', 'important');
                      }
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.setProperty('background-color', '#ffffff', 'important');
                      e.currentTarget.style.setProperty('color', marketingColors.textPrimary, 'important');
                      e.currentTarget.style.setProperty('border-color', 'transparent', 'important');
                      const icon = e.currentTarget.querySelector('svg');
                      if (icon) {
                        icon.style.setProperty('color', marketingColors.textPrimary, 'important');
                      }
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    Signup
                  </Button>
                  <Button
                    component={Link}
                    href="/pricing"
                    size="lg"
                    color={undefined}
                    styles={{
                      root: {
                        backgroundColor: '#ffffff !important',
                        color: `${marketingColors.textPrimary} !important`,
                        fontWeight: 600,
                        padding: '16px 32px',
                        borderRadius: '12px',
                        border: '2px solid transparent',
                        transition: 'all 0.3s ease',
                      },
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.setProperty('background-color', marketingColors.primary, 'important');
                      e.currentTarget.style.setProperty('color', '#ffffff', 'important');
                      e.currentTarget.style.setProperty('border-color', '#ffffff', 'important');
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.setProperty('background-color', '#ffffff', 'important');
                      e.currentTarget.style.setProperty('color', marketingColors.textPrimary, 'important');
                      e.currentTarget.style.setProperty('border-color', 'transparent', 'important');
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    View Pricing
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Container>
        </Box>
      </main>
      <MarketingFooter />
    </>
  );
}

