import { IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { CertificateSignatureLabelsByType } from '../utils/certificate-signature-labels.util';

export class UpdateCertificateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  schoolLogoUrl?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolTagline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  principalName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  registrarName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  schoolEstablished?: string | null;

  @IsOptional()
  @IsObject()
  signatureLabelsByType?: CertificateSignatureLabelsByType;
}
