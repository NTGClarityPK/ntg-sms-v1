import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

const DELIVERY_METHODS = ['email', 'sms', 'portal_download', 'printed'] as const;

export class RecordResultCardDeliveryDto {
  @IsString()
  @IsIn([...DELIVERY_METHODS])
  deliveryMethod!: (typeof DELIVERY_METHODS)[number];

  @IsOptional()
  @IsString()
  recipientContact?: string;

  @IsOptional()
  @IsString()
  deliveryStatus?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
