'use client';

import { Badge, Tooltip } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { DefaultMantineColor } from '@mantine/core';

type RosterConfig = {
  color: DefaultMantineColor;
  labelKey:
    | 'challans.rosterTable.statusBadge.none'
    | 'challans.rosterTable.statusBadge.pendingPayment'
    | 'challans.rosterTable.statusBadge.underReview'
    | 'challans.rosterTable.statusBadge.verified'
    | 'challans.rosterTable.statusBadge.rejected'
    | 'challans.rosterTable.statusBadge.cancelled'
    | 'challans.rosterTable.statusBadge.unknown';
  tooltipKey:
    | 'challans.rosterTable.statusBadge.noneTooltip'
    | 'challans.rosterTable.statusBadge.pendingPaymentTooltip'
    | 'challans.rosterTable.statusBadge.underReviewTooltip'
    | 'challans.rosterTable.statusBadge.verifiedTooltip'
    | 'challans.rosterTable.statusBadge.rejectedTooltip'
    | 'challans.rosterTable.statusBadge.cancelledTooltip'
    | 'challans.rosterTable.statusBadge.unknownTooltip';
};

function configForStatus(raw: string | null | undefined): RosterConfig {
  const s = (raw ?? '').trim();
  if (!s) {
    return {
      color: 'gray',
      labelKey: 'challans.rosterTable.statusBadge.none',
      tooltipKey: 'challans.rosterTable.statusBadge.noneTooltip',
    };
  }
  switch (s) {
    case 'Pending_Payment':
      return {
        color: 'orange',
        labelKey: 'challans.rosterTable.statusBadge.pendingPayment',
        tooltipKey: 'challans.rosterTable.statusBadge.pendingPaymentTooltip',
      };
    case 'Under_Review':
      return {
        color: 'blue',
        labelKey: 'challans.rosterTable.statusBadge.underReview',
        tooltipKey: 'challans.rosterTable.statusBadge.underReviewTooltip',
      };
    case 'Verified':
      return {
        color: 'green',
        labelKey: 'challans.rosterTable.statusBadge.verified',
        tooltipKey: 'challans.rosterTable.statusBadge.verifiedTooltip',
      };
    case 'Rejected':
      return {
        color: 'red',
        labelKey: 'challans.rosterTable.statusBadge.rejected',
        tooltipKey: 'challans.rosterTable.statusBadge.rejectedTooltip',
      };
    case 'Cancelled':
      return {
        color: 'gray',
        labelKey: 'challans.rosterTable.statusBadge.cancelled',
        tooltipKey: 'challans.rosterTable.statusBadge.cancelledTooltip',
      };
    default:
      return {
        color: 'violet',
        labelKey: 'challans.rosterTable.statusBadge.unknown',
        tooltipKey: 'challans.rosterTable.statusBadge.unknownTooltip',
      };
  }
}

export function ChallanRosterStatusBadge(props: { status: string | null | undefined }) {
  const t = useTranslations('fees');
  const cfg = configForStatus(props.status);

  return (
    <Tooltip label={t(cfg.tooltipKey)} withArrow position="top-start" multiline maw={260}>
      <span style={{ display: 'inline-flex' }}>
        <Badge
          variant="light"
          color={cfg.color}
          size="sm"
          fw={600}
          tt="uppercase"
          style={{ letterSpacing: '0.05em', cursor: 'default' }}
          aria-label={t(cfg.tooltipKey)}
        >
          {t(cfg.labelKey)}
        </Badge>
      </span>
    </Tooltip>
  );
}
