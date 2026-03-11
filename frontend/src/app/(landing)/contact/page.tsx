'use client';

import { useState } from 'react';
import { MarketingHeader } from '@/components/marketing/Header';
import { MarketingFooter } from '@/components/marketing/Footer';
import { Container, Title, Text, Stack, Card, Button, Group, Box, TextInput, Textarea, Alert, Grid } from '@mantine/core';
import { motion } from 'framer-motion';
import { useForm } from '@mantine/form';
import { IconArrowRight, IconMail, IconPhone, IconMapPin, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { GeometricAccent } from '@/components/marketing/GeometricAccent';
import { useMarketingColors } from '@/lib/hooks/use-marketing-colors';
import { PageCTASection } from '@/components/marketing/sections/PageCTASection';

const contactInfo = [
  {
    icon: IconMail,
    title: 'Email',
    value: 'support@ntgschool.com',
    link: 'mailto:support@ntgschool.com',
  },
  {
    icon: IconPhone,
    title: 'Phone',
    value: '+1 (555) 123-4567',
    link: 'tel:+15551234567',
  },
  {
    icon: IconMapPin,
    title: 'Address',
    value: 'Middle East Region',
    link: null,
  },
];

export default function ContactPage() {
  const marketingColors = useMarketingColors();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      name: '',
      email: '',
      phone: '',
      company: '',
      message: '',
    },
    validate: {
      name: (value) => (value.length < 2 ? 'Name must be at least 2 characters' : null),
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      message: (value) => (value.length < 10 ? 'Message must be at least 10 characters' : null),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setSubmitting(true);
    setError(null);
    
    try {
      // TODO: Implement API call to send email via Resend/SendGrid
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSubmitted(true);
      form.reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send message. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

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
                  Get in Touch
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
                  style={{ 
                    color: marketingColors.textSecondary,
                    fontWeight: 500,
                  }}
                  fz={{ base: 'var(--mantine-font-size-md)', md: 'var(--mantine-font-size-xl)' }}
                >
                  Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as possible.
                </Text>
              </motion.div>
            </Stack>
          </Container>
        </Box>

        {/* Contact Form & Info Section */}
        <Box style={{ position: 'relative', overflow: 'hidden' }}>
          <GeometricAccent position="top-left" color="primary" size="medium" />
          <GeometricAccent position="bottom-right" color="secondary" size="large" />
          
          <Container size="xl" py={{ base: 'xl', md: 80 }} style={{ position: 'relative', zIndex: 1 }}>
            <Grid>
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Card
                  shadow="xl"
                  padding={40}
                  radius="lg"
                  style={{
                    background: marketingColors.gradientCard,
                    borderWidth: '2px',
                    borderColor: marketingColors.borderPrimary,
                  }}
                >
                  <Stack gap="lg">
                    <Title order={2} size="h2" fw={700} style={{ color: marketingColors.textPrimary }}>
                      Send us a Message
                    </Title>
                    
                    {submitted && (
                      <Alert
                        icon={<IconCheck size={16} />}
                        title="Message Sent!"
                        color="green"
                        style={{
                          backgroundColor: marketingColors.backgroundPrimary,
                          borderColor: marketingColors.primary,
                        }}
                      >
                        Thank you for your message. We&apos;ll get back to you soon!
                      </Alert>
                    )}
                    
                    {error && (
                      <Alert
                        icon={<IconAlertCircle size={16} />}
                        title="Error"
                        color="red"
                        style={{
                          backgroundColor: marketingColors.backgroundPrimary,
                          borderColor: marketingColors.primary,
                        }}
                      >
                        {error}
                      </Alert>
                    )}

                    <form onSubmit={form.onSubmit(handleSubmit)}>
                      <Stack gap="md">
                        <TextInput
                          label="Name"
                          placeholder="Your name"
                          required
                          {...form.getInputProps('name')}
                          styles={{
                            label: { color: marketingColors.textPrimary, fontWeight: 600 },
                            input: {
                              borderColor: marketingColors.borderPrimary,
                              '&:focus': { borderColor: marketingColors.primary },
                            },
                          }}
                        />
                        <TextInput
                          label="Email"
                          placeholder="your.email@example.com"
                          type="email"
                          required
                          {...form.getInputProps('email')}
                          styles={{
                            label: { color: marketingColors.textPrimary, fontWeight: 600 },
                            input: {
                              borderColor: marketingColors.borderPrimary,
                              '&:focus': { borderColor: marketingColors.primary },
                            },
                          }}
                        />
                        <TextInput
                          label="Phone"
                          placeholder="+1 (555) 123-4567"
                          {...form.getInputProps('phone')}
                          styles={{
                            label: { color: marketingColors.textPrimary, fontWeight: 600 },
                            input: {
                              borderColor: marketingColors.borderPrimary,
                              '&:focus': { borderColor: marketingColors.primary },
                            },
                          }}
                        />
                        <TextInput
                          label="Company"
                          placeholder="Your company name"
                          {...form.getInputProps('company')}
                          styles={{
                            label: { color: marketingColors.textPrimary, fontWeight: 600 },
                            input: {
                              borderColor: marketingColors.borderPrimary,
                              '&:focus': { borderColor: marketingColors.primary },
                            },
                          }}
                        />
                        <Textarea
                          label="Message"
                          placeholder="Tell us about your school or trust and how we can help..."
                          required
                          minRows={6}
                          {...form.getInputProps('message')}
                          styles={{
                            label: { color: marketingColors.textPrimary, fontWeight: 600 },
                            input: {
                              borderColor: marketingColors.borderPrimary,
                              '&:focus': { borderColor: marketingColors.primary },
                            },
                          }}
                        />
                        <Button
                          type="submit"
                          size="lg"
                          loading={submitting}
                          rightSection={<IconArrowRight size={20} />}
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
                            const icon = e.currentTarget.querySelector('svg');
                            if (icon) {
                              icon.style.setProperty('color', marketingColors.textPrimary, 'important');
                            }
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.setProperty('background-color', marketingColors.primary, 'important');
                            e.currentTarget.style.setProperty('color', marketingColors.textOnPrimary, 'important');
                            e.currentTarget.style.setProperty('border-color', 'transparent', 'important');
                            const icon = e.currentTarget.querySelector('svg');
                            if (icon) {
                              icon.style.setProperty('color', marketingColors.textOnPrimary, 'important');
                            }
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          Send Message
                        </Button>
                      </Stack>
                    </form>
                  </Stack>
                </Card>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap="lg">
                  <Title order={3} size="h3" fw={700} style={{ color: marketingColors.textPrimary }}>
                    Contact Information
                  </Title>
                  {contactInfo.map((info, index) => {
                    const Icon = info.icon;
                    return (
                      <motion.div
                        key={info.title}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      >
                        <Card
                          shadow="sm"
                          padding="lg"
                          radius="md"
                          style={{
                            background: marketingColors.gradientCard,
                            borderWidth: '2px',
                            borderColor: marketingColors.borderPrimary,
                            transition: 'all 0.3s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = `0 8px 24px ${marketingColors.shadowCardHover}`;
                            e.currentTarget.style.borderColor = marketingColors.borderHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '';
                            e.currentTarget.style.borderColor = marketingColors.borderPrimary;
                          }}
                        >
                          <Group gap="md">
                            <Box
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                backgroundColor: marketingColors.primaryBackground,
                                color: marketingColors.primary,
                                flexShrink: 0,
                              }}
                            >
                              <Icon size={24} />
                            </Box>
                            <Stack gap={4}>
                              <Text size="sm" fw={600} style={{ color: marketingColors.textSecondary }}>
                                {info.title}
                              </Text>
                              {info.link ? (
                                <Text
                                  component="a"
                                  href={info.link}
                                  size="md"
                                  style={{
                                    color: marketingColors.textPrimary,
                                    textDecoration: 'none',
                                    '&:hover': { color: marketingColors.primary },
                                  }}
                                >
                                  {info.value}
                                </Text>
                              ) : (
                                <Text size="md" style={{ color: marketingColors.textPrimary }}>
                                  {info.value}
                                </Text>
                              )}
                            </Stack>
                          </Group>
                        </Card>
                      </motion.div>
                    );
                  })}
                </Stack>
              </Grid.Col>
            </Grid>
          </Container>
        </Box>

        {/* CTA Section */}
        <PageCTASection
          title="Ready to Transform Your School?"
          description="Schedule a free demo and see how NTG Alma can streamline your operations"
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

