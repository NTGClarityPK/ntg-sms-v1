'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  ColorInput,
  FileButton,
  Grid,
  Group,
  Image,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconCheck, IconSchool, IconUpload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useThemeStore } from '@/lib/store/theme-store';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { useTenantMe, useUpdateTenantMe, useUploadTenantLogo } from '@/hooks/useTenant';
import { useTenantBrandingStore } from '@/lib/store/tenant-branding-store';
import { useTranslations } from 'next-intl';

const COLOR_SWATCHES = [
  DEFAULT_THEME_COLOR,
  '#4caf50',
  '#ff9800',
  '#f44336',
  '#9c27b0',
  '#00bcd4',
  '#ffeb3b',
  '#795548',
];

type ThemeSettingsPanelProps = {
  showTitle?: boolean;
};

export function ThemeSettingsPanel({ showTitle = true }: ThemeSettingsPanelProps) {
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { primaryColor, setPrimaryColor } = useThemeStore();
  const { setBranding } = useTenantBrandingStore();
  const tenantQuery = useTenantMe();
  const updateTenantMutation = useUpdateTenantMe();
  const uploadLogoMutation = useUploadTenantLogo();
  const [draftColor, setDraftColor] = useState<string>(primaryColor || DEFAULT_THEME_COLOR);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftColor(primaryColor || DEFAULT_THEME_COLOR);
  }, [primaryColor]);

  useEffect(() => {
    const data = tenantQuery.data?.data;
    if (!data) return;
    const effectiveColor = data.primaryColor || DEFAULT_THEME_COLOR;
    setPrimaryColor(effectiveColor);
    setDraftColor(effectiveColor);
    setLogoPreview(data.logoUrl || null);
    const currentLogoUrl = useTenantBrandingStore.getState().logoUrl;
    setBranding({
      name: data.name || 'School',
      logoUrl: typeof data.logoUrl === 'string' && data.logoUrl.length > 0
        ? data.logoUrl
        : currentLogoUrl ?? null,
    });
  }, [tenantQuery.data?.data, setBranding, setPrimaryColor]);

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    try {
      const response = await uploadLogoMutation.mutateAsync(file);
      const tenant = response?.data ?? response;
      const newLogoUrl = tenant?.logoUrl ?? null;
      setBranding({
        name: tenant?.name || 'School',
        logoUrl: newLogoUrl,
      });
      setLogoPreview(newLogoUrl);
      notifications.show({
        title: tCommon('success'),
        message: tSettings('themeLogoSaved'),
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : tSettings('themeLogoUploadError');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await updateTenantMutation.mutateAsync({ primaryColor: draftColor });
      setPrimaryColor(response.data?.primaryColor || draftColor);
      await tenantQuery.refetch();
      notifications.show({
        title: tCommon('success'),
        message: tSettings('themeSettingsSaved'),
        color: notifyColors.success,
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : tSettings('themeSettingsSaveError');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="lg">
      <Paper withBorder p="md">
        <Stack gap="md">
          {showTitle && <Title order={3}>{tSettings('themeLogoTitle')}</Title>}
          <Box
            style={{
              width: '150px',
              height: '150px',
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--mantine-color-gray-0)',
              overflow: 'hidden',
            }}
          >
            {logoPreview ? (
              <Image
                src={logoPreview}
                alt={tSettings('themeLogoTitle')}
                width="100%"
                height="100%"
                fit="contain"
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <IconSchool size={64} stroke={1.5} color={draftColor} />
            )}
          </Box>
          <FileButton onChange={handleLogoUpload} accept="image/png,image/jpeg,image/jpg,image/webp">
            {(props) => (
              <Button
                leftSection={<IconUpload size={16} />}
                {...props}
                style={{ width: 'fit-content' }}
                loading={uploadLogoMutation.isPending}
              >
                {tSettings('themeUploadButton')}
              </Button>
            )}
          </FileButton>
          <Text c="dimmed" size="sm">
            {tSettings('themeLogoDescription')}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap="md">
          <Title order={3}>{tSettings('themeColourTitle')}</Title>
          <Text c="dimmed" size="sm">
            {tSettings('themeColourDescription')}
          </Text>
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <ColorInput
                label={tSettings('themePrimaryColourLabel')}
                description={tSettings('themePrimaryColourDescription')}
                format="hex"
                swatches={COLOR_SWATCHES}
                value={draftColor}
                onChange={setDraftColor}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper
                p="md"
                withBorder
                style={{
                  backgroundColor: draftColor,
                  color: 'white',
                  textAlign: 'center',
                }}
              >
                <Text fw={500} size="lg">{tSettings('themePreviewTitle')}</Text>
                <Text size="sm" opacity={0.9}>{tSettings('themePreviewDescription')}</Text>
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>
      </Paper>

      <Group justify="flex-end">
        <Button onClick={handleSave} loading={saving}>
          {tSettings('themeSaveButton')}
        </Button>
      </Group>
    </Stack>
  );
}
