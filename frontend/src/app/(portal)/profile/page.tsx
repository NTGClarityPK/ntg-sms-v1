'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
  Button,
  Divider,
  Container,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck, IconMail, IconUser } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import ParentPinSection from '@/components/profile/ParentPinSection';

export default function ProfilePage() {
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('profile');
  const colors = useThemeColors();

  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();

  const form = useForm<{ fullName: string; email: string }>({
    initialValues: {
      fullName: '',
      email: '',
    },
  });

  const isLoading = profileQuery.isLoading || !profileQuery.data;

  useEffect(() => {
    if (profileQuery.data) {
      const nextValues = {
        fullName: profileQuery.data.fullName ?? '',
        email: profileQuery.data.email ?? '',
      };

      const currentValues = form.values;
      if (
        currentValues.fullName !== nextValues.fullName ||
        currentValues.email !== nextValues.email
      ) {
        form.setValues(nextValues);
      }
    }
  }, [profileQuery.data, form]);

  const handleSubmit = async (values: typeof form.values) => {
    const trimmedName = values.fullName.trim();
    if (!trimmedName) {
      notifications.show({
        title: tCommon('error'),
        message: tProfile('nameRequired'),
        color: colors.error,
      });
      return;
    }

    try {
      await updateProfile.mutateAsync({ fullName: trimmedName });
      notifications.show({
        title: tCommon('success'),
        message: tProfile('updated'),
        color: colors.success,
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({
        title: tCommon('error'),
        message,
        color: colors.error,
      });
    }
  };

  return (
    <>
      <div className="page-title-bar"></div>

      <div
        style={{
          marginTop: '24px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Container size="md">
          <Group justify="space-between" w="100%" mb="md">
            <Title order={1}>{tProfile('title')}</Title>
          </Group>

          {profileQuery.error && (
            <Alert
              color={colors.error}
              title={tCommon('error')}
              mb="md"
              withCloseButton={false}
            >
              <Text size="sm">{tCommon('errors.generic')}</Text>
            </Alert>
          )}

          {isLoading ? (
            <Stack gap="md">
              <Skeleton height={40} width="30%" />
              <Skeleton height={200} />
            </Stack>
          ) : (
            <Stack gap="lg">
              <Paper withBorder p="md">
                <Stack gap="md">
                  <Group>
                    <IconUser size={24} />
                    <Title order={3}>{tProfile('personalInformation')}</Title>
                  </Group>

                  <Divider />

                  <form onSubmit={form.onSubmit(handleSubmit)}>
                    <Stack gap="md">
                      <TextInput
                        id="profile-full-name"
                        label={tProfile('name')}
                        placeholder={tProfile('namePlaceholder')}
                        leftSection={<IconUser size={16} />}
                        {...form.getInputProps('fullName')}
                      />

                      <TextInput
                        id="profile-email"
                        label={tProfile('email')}
                        placeholder={tProfile('emailPlaceholder')}
                        leftSection={<IconMail size={16} />}
                        disabled
                        {...form.getInputProps('email')}
                      />

                      <Group justify="flex-end" mt="md">
                        <Button
                          id="profile-save"
                          type="submit"
                          leftSection={<IconCheck size={16} />}
                          loading={updateProfile.isPending}
                        >
                          {tCommon('save')}
                        </Button>
                      </Group>
                    </Stack>
                  </form>
                </Stack>
              </Paper>

              {/* Temporarily hidden: PIN setup is only enabled for student PIN via parent flow */}
              {false && <ParentPinSection />}
            </Stack>
          )}
        </Container>
      </div>
    </>
  );
}

