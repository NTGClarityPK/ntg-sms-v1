import { IsEnum, IsOptional } from 'class-validator';
import { BillingCycle, PlanId } from '../plan-config';

export class ChangePlanDto {
  @IsEnum(PlanId)
  planId!: PlanId;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;
}
