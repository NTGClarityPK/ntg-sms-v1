import { IsIn, IsUUID } from 'class-validator';
import { CERTIFICATE_TYPES } from '../types/certificate.types';

export class QueryIssueFormDefaultsDto {
  @IsUUID()
  studentId!: string;

  @IsIn([...CERTIFICATE_TYPES])
  certificateType!: (typeof CERTIFICATE_TYPES)[number];
}
