'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Paper, Select, Stack, Text, TextInput } from '@mantine/core';
import {
  CERTIFICATE_TYPES_FOR_SIGNATURES,
  DEFAULT_CERTIFICATE_SIGNATURE_LABELS,
  type CertificateSignatureLabelsByType,
  type CertificateSignatureSlotLabels,
} from '@/lib/certificates/certificateSignatureDefaults';
import type { CertificateType } from '@/types/certificates';

type Props = {
  value: Record<CertificateType, CertificateSignatureSlotLabels>;
  onChange: (next: Record<CertificateType, CertificateSignatureSlotLabels>) => void;
};

export function CertificateSignatureSettings({ value, onChange }: Props) {
  const t = useTranslations('certificates');
  const [selectedType, setSelectedType] = useState<CertificateType>('sports');

  const typeOptions = useMemo(
    () =>
      CERTIFICATE_TYPES_FOR_SIGNATURES.map((type) => ({
        value: type,
        label: t(`types.${type}`),
      })),
    [t],
  );

  const current = value[selectedType] ?? DEFAULT_CERTIFICATE_SIGNATURE_LABELS[selectedType];

  const patchType = (patch: Partial<CertificateSignatureSlotLabels>) => {
    onChange({
      ...value,
      [selectedType]: {
        ...current,
        ...patch,
      },
    });
  };

  return (
    <Paper withBorder p="md" radius="md" id="cert-settings-signatures">
      <Stack gap="md">
        <div>
          <Text fw={600}>{t('settings.signatureSectionTitle')}</Text>
          <Text size="sm" c="dimmed" mt={4}>
            {t('settings.signatureSectionDescription')}
          </Text>
        </div>
        <Select
          id="cert-settings-signature-type"
          label={t('settings.signatureTypeLabel')}
          data={typeOptions}
          value={selectedType}
          onChange={(v) => {
            if (v) setSelectedType(v as CertificateType);
          }}
        />
        <TextInput
          id="cert-settings-signature-1"
          label={t('settings.signature1Label')}
          placeholder={t('settings.signature1Placeholder')}
          value={current.signature1}
          onChange={(e) => patchType({ signature1: e.currentTarget.value })}
        />
        <TextInput
          id="cert-settings-signature-2"
          label={t('settings.signature2Label')}
          placeholder={t('settings.signature2Placeholder')}
          value={current.signature2}
          onChange={(e) => patchType({ signature2: e.currentTarget.value })}
        />
      </Stack>
    </Paper>
  );
}

export function signatureLabelsToPayload(
  value: Record<CertificateType, CertificateSignatureSlotLabels>,
): CertificateSignatureLabelsByType {
  const out: CertificateSignatureLabelsByType = {};
  for (const type of CERTIFICATE_TYPES_FOR_SIGNATURES) {
    const row = value[type];
    if (!row) continue;
    out[type] = {
      signature1: row.signature1.trim(),
      signature2: row.signature2.trim(),
    };
  }
  return out;
}
