'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { useTranslations } from 'next-intl';
<<<<<<< HEAD
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useCreateFeeTemplate, useDeleteFeeTemplate, useFeeChallanSettings, useFeeTemplates, useUpsertFeeChallanSettings } from '@/hooks/api/useFees';
import type { FeeTemplate } from '@/types/fees';
import { notifications } from '@mantine/notifications';
import { useSubscriptionFeatures } from '@/hooks/api/useSubscription';

type MetricForm = {
  name: string;
  amountType: 'Absolute' | 'Percentage';
  amount: number;
};

function FeeSettingsContent() {
=======

/**
 * Legacy route — canonical Fee settings lives under Settings → Fee settings.
 * Keep this path so old bookmarks still work.
 */
export default function LegacyFeeSettingsRedirectPage() {
  const router = useRouter();
>>>>>>> feature/fee
  const t = useTranslations('fees');

  useEffect(() => {
    router.replace('/settings?section=fees');
  }, [router]);

  return (
    <Center mih={240} p="md">
      <Stack align="center" gap="sm">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          {t('settings.redirecting')}
        </Text>
      </Stack>
    </Center>
  );
}
<<<<<<< HEAD

export default function FeeSettingsPage() {
  const t = useTranslations('fees');
  const router = useRouter();
  const { data: features, isLoading: featuresLoading } = useSubscriptionFeatures();

  useEffect(() => {
    if (features && !features.hasFeeManagement) {
      router.replace('/settings');
    }
  }, [features, router]);

  if (featuresLoading || !features) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('settings.title')}</Title>
        </div>
        <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
          <Stack gap="md">
            <Skeleton height={120} radius="md" />
            <Skeleton height={80} radius="md" />
            <Skeleton height={200} radius="md" />
          </Stack>
        </div>
      </>
    );
  }

  if (!features.hasFeeManagement) {
    return null;
  }

  return <FeeSettingsContent />;
}

=======
>>>>>>> feature/fee
