'use client';

import { useTranslations } from 'next-intl';
import {
  Badge,
  Card,
  Grid,
  Group,
  Skeleton,
  Stack,
  Text,
  Button,
  Checkbox,
} from '@mantine/core';
import { IconAlertTriangle, IconDownload, IconUser } from '@tabler/icons-react';
import Link from 'next/link';
import type { IdCard, IdCardDesignVariant, IdCardPersonType } from '@/types/id-cards';
import { downloadIdCardPdf } from '@/hooks/useIdCards';
import { displayIdCardRoll } from '@/lib/id-cards/display-roll';
import { ID_CARD_STATUS_COLOUR } from '@/lib/id-cards/status-colour';

function formatClassSection(card: IdCard): string | null {
  const label = [card.className, card.sectionName].filter(Boolean).join(' · ');
  return label || null;
}

type Props = {
  cards: IdCard[];
  personType: IdCardPersonType;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  downloadDesignVariant: IdCardDesignVariant;
  pdfMessages: { preparing: string; failed: string };
};

export function IdCardGrid({
  cards,
  personType,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  downloadDesignVariant,
  pdfMessages,
}: Props) {
  const t = useTranslations('idCards');
  const selectableCards = cards.filter((c) => c.hasCard !== false && c.id);
  const allIds = selectableCards.map((c) => c.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  return (
    <Stack gap="md">
      {selectableCards.length > 1 && (
        <Checkbox
          id="id-cards-select-all"
          label={t('selectAll')}
          checked={allSelected}
          indeterminate={selectedIds.length > 0 && !allSelected}
          onChange={() => onToggleSelectAll(allSelected ? [] : allIds)}
        />
      )}
      <Grid>
        {cards.map((card) => {
          const rowKey = card.id || card.personId;
          const hasCard = card.hasCard !== false && !!card.id;
          const classSection = personType === 'student' ? formatClassSection(card) : null;
          const roll = displayIdCardRoll(card);

          return (
            <Grid.Col key={rowKey} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
              <Card withBorder padding="md" radius="md">
                <Group justify="space-between" mb="xs">
                  {hasCard ? (
                    <Checkbox
                      id={`id-card-select-${card.id}`}
                      checked={selectedIds.includes(card.id)}
                      onChange={() => onToggleSelect(card.id)}
                      aria-label={t('selectCard')}
                    />
                  ) : (
                    <span />
                  )}
                  {hasCard ? (
                    <Badge color={ID_CARD_STATUS_COLOUR[card.status]} variant="light">
                      {t(`status.${card.status}`)}
                    </Badge>
                  ) : (
                    <Badge color="gray" variant="light">
                      {t('status.notGenerated')}
                    </Badge>
                  )}
                </Group>
                <Stack align="center" gap="xs">
                  {card.photoUrl ? (
                    <img
                      src={card.photoUrl}
                      alt=""
                      style={{ width: 72, height: 88, objectFit: 'cover', borderRadius: 8 }}
                    />
                  ) : (
                    <Stack align="center" gap={4} c="dimmed">
                      <IconUser size={40} />
                      <Group gap={4}>
                        <IconAlertTriangle size={14} color="var(--mantine-color-yellow-6)" />
                        <Text size="xs">{t('missingPhoto')}</Text>
                      </Group>
                    </Stack>
                  )}
                  <Text fw={600} size="sm" ta="center" lineClamp={2}>
                    {card.personName ?? roll}
                  </Text>
                  {personType === 'student' && classSection && (
                    <Text size="xs" c="dimmed" ta="center">
                      {classSection}
                    </Text>
                  )}
                  <Text size="xs" fw={500}>
                    {personType === 'student' ? t('rollLabel', { roll }) : roll}
                  </Text>
                </Stack>
                <Group justify="center" mt="md" gap="xs" wrap="wrap">
                  {hasCard ? (
                    <>
                      <Button
                        id={`id-card-download-pdf-${card.id}`}
                        variant="light"
                        size="xs"
                        leftSection={<IconDownload size={16} />}
                        onClick={() =>
                          void downloadIdCardPdf(card.id, {
                            designVariant: downloadDesignVariant,
                            messages: pdfMessages,
                          })
                        }
                      >
                        {t('downloadPdf')}
                      </Button>
                      <Button
                        id={`id-card-edit-${card.id}`}
                        component={Link}
                        href={`/id-cards/${card.id}`}
                        variant="subtle"
                        size="xs"
                      >
                        {t('edit')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      id={`id-card-generate-${card.personId}`}
                      component={Link}
                      href="/id-cards/generate"
                      variant="light"
                      size="xs"
                    >
                      {t('generateCards')}
                    </Button>
                  )}
                </Group>
              </Card>
            </Grid.Col>
          );
        })}
      </Grid>
    </Stack>
  );
}

export function IdCardGridSkeleton() {
  return (
    <Grid>
      {Array.from({ length: 8 }).map((_, i) => (
        <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
          <Skeleton height={200} radius="md" />
        </Grid.Col>
      ))}
    </Grid>
  );
}
