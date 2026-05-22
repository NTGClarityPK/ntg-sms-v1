import type { IdCardPersonType, IdCardStatus } from '../types/id-card-person-type';
import type { IdCardDesignVariant } from '../types/id-card-design-variant';

export class IdCardDto {
  id!: string;
  branchId!: string;
  personId!: string;
  personType!: IdCardPersonType;
  cardNumber!: string;
  templateId?: string;
  photoUrl?: string;
  status!: IdCardStatus;
  validFrom?: string;
  validUntil?: string;
  printCount!: number;
  lastPrintedAt?: string;
  isReissued!: boolean;
  designVariant?: IdCardDesignVariant;
  createdAt!: string;
  updatedAt!: string;
  personName?: string;
  className?: string;
  sectionName?: string;
  /** Student roll or staff employee id for display (not full card number). */
  rollNumber?: string;
  /** False when listing students who do not yet have an id_cards row. */
  hasCard?: boolean;
  hasPhoto!: boolean;

  constructor(partial: Partial<IdCardDto>) {
    Object.assign(this, partial);
  }
}
