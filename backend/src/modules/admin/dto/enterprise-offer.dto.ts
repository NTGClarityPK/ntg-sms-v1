import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Full-replace PUT body for Ops Alma enterprise offer.
 * Every key is required by contract; validators allow null where specified.
 */
export class PutEnterpriseOfferDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  price!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  durationMonths!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  setupFee!: number;

  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  branches!: number | null;

  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  students!: number | null;

  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  storageGb!: number | null;

  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  fees!: boolean | null;

  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  library!: boolean | null;

  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  behavioural!: boolean | null;

  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  uniformInventory!: boolean | null;

  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  whiteLabel!: boolean | null;

  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  googleClassroom!: boolean | null;

  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feesMonthly!: number | null;

  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  libraryMonthly!: number | null;

  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  behaviouralMonthly!: number | null;

  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  uniformInventoryMonthly!: number | null;

  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  whiteLabelMonthly!: number | null;

  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  googleClassroomMonthly!: number | null;

  @IsBoolean()
  paidTrial!: boolean;

  /**
   * Reach Ops often sends `null` for Trial and encodes length via
   * trialStartsAt → accessStartsAt (planned convert). Accept null;
   * service derives days when needed.
   */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  paidTrialDays!: number | null;

  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  preTrialSetupFee!: number | null;

  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  postTrialSetupFee!: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  accessStartsAt!: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  trialStartsAt!: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsBoolean()
  prorateBackdatedAccess!: boolean | null;

  @IsBoolean()
  enterpriseEnabled!: boolean;
}

export class AssessmentsLockDto {
  @IsBoolean()
  locked!: boolean;

  @IsOptional()
  reason?: string;
}

export class DeleteTenantConfirmDto {
  @IsBoolean()
  confirm!: boolean;

  /** Must equal path tenantId */
  @IsUUID()
  confirmTenantId!: string;
}
