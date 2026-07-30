'use client';

import { Badge, Tooltip } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { useAssessmentSyncStatus } from '@/hooks/api/useGoogleWorkspace';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface SyncStatusBadgeProps {
  assessmentId: string;
}

function formatRelative(when: string | null | undefined, neverLabel: string, lastSynced: (when: string) => string) {
  if (!when) return neverLabel;
  try {
    const date = new Date(when);
    return lastSynced(date.toLocaleString());
  } catch {
    return neverLabel;
  }
}

export function SyncStatusBadge({ assessmentId }: SyncStatusBadgeProps) {
  const t = useTranslations('googleClassroom');
  const colors = useThemeColors();
  const { data: status, isLoading } = useAssessmentSyncStatus(assessmentId);

  if (isLoading || !status) {
    return null;
  }

  if (status.gradingSource !== 'google_classroom') {
    return null;
  }

  const label = formatRelative(
    status.googleLastSyncedAt,
    t('neverSynced'),
    (when) => t('lastSynced', { when }),
  );

  const auditStatus = status.lastAudit?.syncStatus;
  const color =
    auditStatus === 'success' || auditStatus === 'completed'
      ? colors.success
      : auditStatus === 'partial'
        ? 'yellow'
        : auditStatus === 'failed' || auditStatus === 'error'
          ? 'red'
          : colors.info;

  return (
    <Tooltip label={label}>
      <Badge id={`google-sync-status-${assessmentId}`} variant="light" color={color}>
        {label}
      </Badge>
    </Tooltip>
  );
}
