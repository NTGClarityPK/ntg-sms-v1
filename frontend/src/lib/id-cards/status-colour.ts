import type { IdCardStatus } from '@/types/id-cards';

export const ID_CARD_STATUS_COLOUR: Record<IdCardStatus, string> = {
  draft: 'yellow',
  approved: 'blue',
  printed: 'grape',
  issued: 'green',
  revoked: 'red',
};
