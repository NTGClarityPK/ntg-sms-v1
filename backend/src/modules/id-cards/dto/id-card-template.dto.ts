import type { IdCardCardSide, IdCardRoleType } from '../types/id-card-person-type';

export class IdCardTemplateDto {
  id!: string;
  branchId!: string;
  name!: string;
  roleType!: IdCardRoleType;
  cardSide!: IdCardCardSide;
  htmlTemplateKey!: string;
  isDefault!: boolean;
  isActive!: boolean;

  constructor(partial: Partial<IdCardTemplateDto>) {
    Object.assign(this, partial);
  }
}
