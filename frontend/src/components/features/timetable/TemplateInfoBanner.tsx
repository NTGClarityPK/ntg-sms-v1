'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Group, Text, Stack, Badge } from '@mantine/core';
import { IconClock, IconCalendar, IconInfoCircle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import type { TimingTemplateInfo } from '@/types/timetable';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface TemplateInfoBannerProps {
  templateInfo: TimingTemplateInfo | null;
  branchId?: string | null;
}

function dismissStorageKey(branchId: string, templateId: string): string {
  return `timetable-timing-banner-dismissed:${branchId}:${templateId}`;
}

export function TemplateInfoBanner({ templateInfo, branchId }: TemplateInfoBannerProps) {
  const colors = useThemeColors();
  const t = useTranslations('timetable');

  const templateId = templateInfo?.templateId;
  const storageKey = useMemo(() => {
    if (!branchId || !templateId) return null;
    return dismissStorageKey(branchId, templateId);
  }, [branchId, templateId]);

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      setDismissed(false);
      return;
    }
    setDismissed(window.localStorage.getItem(storageKey) === '1');
  }, [storageKey]);

  const handleDismiss = () => {
    if (storageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, '1');
    }
    setDismissed(true);
  };

  if (dismissed) {
    return null;
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours || '0', 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes || '00'} ${ampm}`;
  };

  if (!templateInfo) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} color={colors.warning} title={t('timingTemplateNoTemplateTitle')}>
        <Text size="sm">{t('timingTemplateNoTemplateMessage')}</Text>
      </Alert>
    );
  }

  return (
    <Alert
      icon={<IconCalendar size={16} />}
      color={colors.info}
      title={t('timingTemplateBannerTitle', { name: templateInfo.templateName })}
      withCloseButton
      onClose={handleDismiss}
      closeButtonLabel={t('timingTemplateDismiss')}
    >
      <Stack gap="xs" mt="xs">
        <Group gap={4}>
          <IconClock size={14} />
          <Text size="sm" fw={500}>
            {t('timingTemplateSchoolHours')}
          </Text>
          <Text size="sm">
            {formatTime(templateInfo.startTime)} – {formatTime(templateInfo.endTime)}
          </Text>
        </Group>

        {templateInfo.slots.length > 0 && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {t('timingTemplateFixedBlocks')}
            </Text>
            <Text size="xs" c="dimmed">
              {t('timingTemplateFixedBlocksHint')}
            </Text>
            <Group gap="xs">
              {templateInfo.slots.map((slot, index) => (
                <Badge key={`${slot.name}-${index}`} variant="light" size="sm">
                  {slot.startTime && slot.endTime
                    ? t('timingTemplateFixedBlockBadge', {
                        name: slot.name,
                        start: formatTime(slot.startTime),
                        end: formatTime(slot.endTime),
                      })
                    : slot.name}
                </Badge>
              ))}
            </Group>
          </Stack>
        )}

        <Text size="xs" c="dimmed">
          {t('timingTemplateWithinHours', {
            start: formatTime(templateInfo.startTime),
            end: formatTime(templateInfo.endTime),
          })}
        </Text>
      </Stack>
    </Alert>
  );
}
