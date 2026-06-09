'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Box,
  Button,
  ColorInput,
  FileButton,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  useCertificateSettings,
  useUpdateCertificateSettings,
  useUploadCertificateLogo,
} from '@/hooks/useCertificates';
import {
  CERTIFICATE_COLOR_SWATCHES,
  DEFAULT_CERTIFICATE_PRIMARY,
  getCertificateThemeShades,
  normalizeCertificatePrimary,
} from '@/lib/certificates/certificateTheme';
import { CertificateSettingsFormSkeleton } from '@/components/features/certificates/CertificateSkeletons';
import {
  CertificateSignatureSettings,
  signatureLabelsToPayload,
} from '@/components/features/certificates/CertificateSignatureSettings';
import {
  mergeSignatureLabelsByType,
  type CertificateSignatureSlotLabels,
} from '@/lib/certificates/certificateSignatureDefaults';
import type { CertificateType } from '@/types/certificates';

export function CertificateSettingsForm() {
  const t = useTranslations('certificates');
  const { data: settings, isLoading } = useCertificateSettings();
  const updateMutation = useUpdateCertificateSettings();
  const uploadLogo = useUploadCertificateLogo();
  const [draftColor, setDraftColor] = useState(DEFAULT_CERTIFICATE_PRIMARY);
  const [signatureLabels, setSignatureLabels] = useState<
    Record<CertificateType, CertificateSignatureSlotLabels>
  >(() => mergeSignatureLabelsByType(null));

  const form = useForm({
    initialValues: {
      schoolTagline: '',
      principalName: '',
      registrarName: '',
      schoolEstablished: '',
    },
  });

  const shades = useMemo(() => getCertificateThemeShades(draftColor), [draftColor]);

  useEffect(() => {
    if (!settings) return;
    setDraftColor(normalizeCertificatePrimary(settings.primaryColor));
    form.setValues({
      schoolTagline: settings.schoolTagline ?? '',
      principalName: settings.principalName ?? '',
      registrarName: settings.registrarName ?? '',
      schoolEstablished: settings.schoolEstablished ?? '',
    });
    setSignatureLabels(mergeSignatureLabelsByType(settings.signatureLabelsByType));
  }, [settings]);

  const applyColor = (hex: string | null) => {
    setDraftColor(normalizeCertificatePrimary(hex));
  };

  if (isLoading) {
    return <CertificateSettingsFormSkeleton />;
  }

  return (
    <Paper withBorder p="md" radius="md">
      <form
        onSubmit={form.onSubmit((values) => {
          updateMutation.mutate({
            primaryColor: draftColor,
            schoolTagline: values.schoolTagline || null,
            principalName: values.principalName || null,
            registrarName: values.registrarName || null,
            schoolEstablished: values.schoolEstablished || null,
            signatureLabelsByType: signatureLabelsToPayload(signatureLabels),
          });
        })}
      >
        <Stack gap="md">
          <Text fw={600}>{t('settings.customization')}</Text>
          <Group>
            <FileButton
              onChange={(file) => {
                if (file) uploadLogo.mutate(file);
              }}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
            >
              {(props) => (
                <Button id="cert-settings-logo" {...props} loading={uploadLogo.isPending}>
                  {t('settings.uploadLogo')}
                </Button>
              )}
            </FileButton>
            {settings?.schoolLogoUrl && (
              <Text size="sm" c="dimmed">
                {t('settings.logoSet')}
              </Text>
            )}
          </Group>

          <Text fw={600} size="sm">
            {t('settings.colourSectionTitle')}
          </Text>
          <Text size="sm" c="dimmed">
            {t('settings.colourSectionDescription')}
          </Text>
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="sm">
                <ColorInput
                  id="cert-settings-color"
                  label={t('settings.primaryColor')}
                  description={t('settings.primaryColorDescription')}
                  format="hex"
                  value={draftColor}
                  onChange={applyColor}
                  withPicker
                />
                <Stack gap={6}>
                  <Text size="xs" c="dimmed">
                    {t('settings.paletteLabel')}
                  </Text>
                  <SimpleGrid cols={5} spacing="xs">
                    {CERTIFICATE_COLOR_SWATCHES.map((hex) => (
                      <UnstyledButton
                        key={hex}
                        type="button"
                        aria-label={hex}
                        onClick={() => applyColor(hex)}
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: 8,
                          backgroundColor: hex,
                          border:
                            draftColor.toLowerCase() === hex.toLowerCase()
                              ? '3px solid var(--mantine-color-dark-6)'
                              : '1px solid var(--mantine-color-gray-4)',
                          boxShadow:
                            draftColor.toLowerCase() === hex.toLowerCase()
                              ? '0 0 0 2px var(--mantine-color-body)'
                              : undefined,
                        }}
                      />
                    ))}
                  </SimpleGrid>
                </Stack>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  {t('settings.colourPreviewTitle')}
                </Text>
                <Paper
                  withBorder
                  p="md"
                  radius="md"
                  style={{
                    borderColor: shades.primary,
                    background: shades.soft,
                  }}
                >
                  <Text fw={600} style={{ color: shades.deep }}>
                    {t('settings.colourPreviewSampleTitle')}
                  </Text>
                  <Text size="sm" mt={4} style={{ color: shades.primary }}>
                    {t('settings.colourPreviewSampleBody')}
                  </Text>
                  <Box
                    mt="md"
                    style={{
                      height: 4,
                      borderRadius: 4,
                      background: `linear-gradient(90deg, ${shades.deep}, ${shades.primary}, ${shades.soft})`,
                    }}
                  />
                </Paper>
                <Group gap="xs" grow>
                  <ShadeSwatch label={t('settings.shadePrimary')} color={shades.primary} />
                  <ShadeSwatch label={t('settings.shadeDeep')} color={shades.deep} />
                  <ShadeSwatch label={t('settings.shadeSoft')} color={shades.soft} />
                </Group>
              </Stack>
            </Grid.Col>
          </Grid>

          <TextInput
            id="cert-settings-tagline"
            label={t('settings.tagline')}
            description={t('settings.taglineDescription')}
            {...form.getInputProps('schoolTagline')}
          />
          <Text fw={600} size="sm">
            {t('settings.signatoryNamesTitle')}
          </Text>
          <TextInput
            id="cert-settings-principal"
            label={t('settings.principalName')}
            description={t('settings.principalNameDescription')}
            {...form.getInputProps('principalName')}
          />
          <TextInput
            id="cert-settings-registrar"
            label={t('settings.registrarName')}
            description={t('settings.registrarNameDescription')}
            {...form.getInputProps('registrarName')}
          />
          <CertificateSignatureSettings
            value={signatureLabels}
            onChange={setSignatureLabels}
          />
          <TextInput
            id="cert-settings-established"
            label={t('settings.established')}
            {...form.getInputProps('schoolEstablished')}
          />
          <Group justify="flex-end">
            <Button
              id="cert-settings-save"
              type="submit"
              loading={updateMutation.isPending}
              disabled={updateMutation.isPending}
            >
              {t('settings.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}

function ShadeSwatch({ label, color }: { label: string; color: string }) {
  return (
    <Stack gap={4} align="center">
      <Box
        w={36}
        h={36}
        style={{
          borderRadius: 8,
          backgroundColor: color,
          border: '1px solid var(--mantine-color-gray-4)',
        }}
      />
      <Text size="xs" c="dimmed" ta="center">
        {label}
      </Text>
    </Stack>
  );
}
