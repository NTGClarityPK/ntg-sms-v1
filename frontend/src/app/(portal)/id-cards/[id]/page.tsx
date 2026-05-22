'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  NumberInput,
  Select,
  Skeleton,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { IconDownload, IconUpload } from '@tabler/icons-react';
import {
  useIdCard,
  useIdCardPreviewData,
  useReprintIdCard,
  useUpdateIdCardStatus,
  useUploadIdCardPhoto,
  downloadIdCardPdf,
} from '@/hooks/useIdCards';
import { IdCardPreview } from '@/components/features/id-cards/IdCardPreview';
import type { IdCardDesignVariant, IdCardStatus } from '@/types/id-cards';
import { notifications } from '@mantine/notifications';
import { displayIdCardRoll } from '@/lib/id-cards/display-roll';

export default function IdCardDetailPage() {
  const t = useTranslations('idCards');
  const params = useParams();
  const router = useRouter();
  const id = params && typeof params.id === 'string' ? params.id : '';

  const { data: card, isLoading, error, refetch } = useIdCard(id);
  const { data: preview, isLoading: previewLoading, refetch: refetchPreview } = useIdCardPreviewData(
    card?.personType,
    card?.personId,
  );
  const updateStatus = useUpdateIdCardStatus();
  const reprint = useReprintIdCard();
  const uploadPhoto = useUploadIdCardPhoto();
  const [reprintReason, setReprintReason] = useState('');
  const [reprintFee, setReprintFee] = useState<number | string>('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  if (isLoading) {
    return (
      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        <Skeleton height={200} />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        <Alert color="red">{error?.message ?? t('notFound')}</Alert>
      </div>
    );
  }

  const displayPhotoUrl = card.photoUrl ?? preview?.photoUrl;
  const displayRoll = displayIdCardRoll(card);
  const rollLabel =
    card.personType === 'student' ? t('rollLabel', { roll: displayRoll }) : displayRoll;
  const downloadDesignVariant: IdCardDesignVariant =
    card.designVariant === 'minimal' ? 'minimal' : 'classic';

  const statusOptions = (['draft', 'approved', 'printed', 'issued', 'revoked'] as IdCardStatus[]).map(
    (s) => ({ value: s, label: t(`status.${s}`) }),
  );

  const handleUploadPhoto = async () => {
    if (!photoFile || !card.personType) return;
    await uploadPhoto.mutateAsync({
      personType: card.personType,
      personId: card.personId,
      file: photoFile,
    });
    setPhotoFile(null);
    notifications.show({
      title: t('photoUploadSuccess'),
      message: t('photoUploadSuccess'),
      color: 'green',
    });
    await refetch();
    await refetchPreview();
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="nowrap" align="center" gap="sm">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={1}>
            {card.personName ?? card.cardNumber}
          </Title>
          <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
            <Button id="id-card-detail-back" variant="subtle" onClick={() => router.push('/id-cards')}>
              {t('back')}
            </Button>
            <Button
              id="id-card-detail-download-pdf"
              leftSection={<IconDownload size={18} />}
              onClick={() =>
                void downloadIdCardPdf(card.id, {
                  designVariant: downloadDesignVariant,
                  messages: {
                    preparing: t('downloadPdfPreparing'),
                    failed: t('downloadPdfFailed'),
                  },
                })
              }
            >
              {t('downloadPdf')}
            </Button>
          </Group>
        </Group>
      </div>
      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        <Stack gap="md">
          <Group>
            <Badge>{t(`status.${card.status}`)}</Badge>
            <Text size="sm" fw={500}>
              {rollLabel}
            </Text>
            {card.isReissued && <Badge color="orange">{t('reissued')}</Badge>}
          </Group>

          <Stack gap="xs">
            <Text fw={600}>{t('photoSection')}</Text>
            <Text size="sm" c="dimmed">
              {t('uploadPhotoHint')}
            </Text>
            {displayPhotoUrl && (
              <img
                src={displayPhotoUrl}
                alt=""
                style={{ width: 120, height: 150, objectFit: 'cover', borderRadius: 8 }}
              />
            )}
            <FileInput
              id="id-card-detail-photo-upload"
              label={t('uploadPhoto')}
              placeholder={t('uploadPhotoPlaceholder')}
              accept="image/png,image/jpeg,image/webp"
              value={photoFile}
              onChange={setPhotoFile}
              clearable
              leftSection={<IconUpload size={18} />}
              styles={{
                input: {
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  minHeight: 48,
                },
              }}
            />
            <Button
              id="id-card-detail-photo-submit"
              variant="light"
              disabled={!photoFile || uploadPhoto.isPending}
              loading={uploadPhoto.isPending}
              onClick={() => void handleUploadPhoto()}
            >
              {t('uploadPhoto')}
            </Button>
          </Stack>

          <IdCardPreview data={preview} isLoading={previewLoading} />

          <Select
            id="id-card-detail-status"
            label={t('statusLabel')}
            data={statusOptions}
            value={card.status}
            onChange={(v) => {
              if (v) updateStatus.mutate({ status: v as IdCardStatus, cardIds: [card.id] });
            }}
          />

          <Stack gap="xs">
            <Text fw={600}>{t('reprintSection')}</Text>
            <Textarea
              id="id-card-reprint-reason"
              label={t('reprintReason')}
              value={reprintReason}
              onChange={(e) => setReprintReason(e.currentTarget.value)}
            />
            <NumberInput
              id="id-card-reprint-fee"
              label={t('reprintFee')}
              value={reprintFee}
              onChange={setReprintFee}
              min={0}
            />
            <Button
              id="id-card-reprint-submit"
              variant="light"
              color="orange"
              disabled={!reprintReason.trim() || reprint.isPending}
              loading={reprint.isPending}
              onClick={() =>
                reprint.mutate({
                  cardId: card.id,
                  reason: reprintReason,
                  feeCharged: typeof reprintFee === 'number' ? reprintFee : undefined,
                })
              }
            >
              {t('requestReprint')}
            </Button>
          </Stack>
        </Stack>
      </div>
    </>
  );
}
