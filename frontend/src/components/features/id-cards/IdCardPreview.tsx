'use client';

import { useTranslations } from 'next-intl';
import { Card, Group, Image, Skeleton, Stack, Text } from '@mantine/core';
import type { IdCardRenderData } from '@/types/id-cards';

type Props = {
  data: IdCardRenderData | undefined;
  isLoading: boolean;
};

export function IdCardPreview({ data, isLoading }: Props) {
  const t = useTranslations('idCards');

  if (isLoading || !data) {
    return <Skeleton height={220} radius="md" />;
  }

  return (
    <Card withBorder padding="md" radius="md">
      <Text size="sm" fw={600} mb="sm">
        {t('preview')}
      </Text>
      <Group align="flex-start" gap="md" wrap="nowrap">
        {data.photoUrl ? (
          <Image src={data.photoUrl} alt="" w={80} h={96} radius="sm" fit="cover" />
        ) : (
          <Stack
            w={80}
            h={96}
            align="center"
            justify="center"
            style={{ background: 'var(--mantine-color-gray-1)', borderRadius: 8 }}
          >
            <Text size="xs" c="dimmed">
              {t('noPhoto')}
            </Text>
          </Stack>
        )}
        <Stack gap={4} style={{ flex: 1 }}>
          <Text fw={700}>{data.fullName}</Text>
          <Text size="sm">
            {data.roleLabel} · {data.classSection}
          </Text>
          <Text size="sm" c="dimmed">
            {data.rollOrEmployeeId}
          </Text>
          {(data.academicYearLabel || data.validFrom) && (
            <Text size="xs" c="dimmed">
              {data.academicYearLabel
                ? t('academicYearSession', { year: data.academicYearLabel })
                : t('validityPeriod', { from: data.validFrom, to: data.validUntil })}
            </Text>
          )}
        </Stack>
        {data.qrCodeDataUrl ? (
          <Image src={data.qrCodeDataUrl} alt="QR" w={64} h={64} />
        ) : null}
      </Group>
    </Card>
  );
}
