import { IsIn, IsUUID } from 'class-validator';
import { SUPPORT_UPLOAD_TYPES, type SupportUploadType } from '../support.types';

export class UploadSupportFileDto {
  @IsUUID()
  conversationId!: string;

  @IsIn(SUPPORT_UPLOAD_TYPES)
  messageType!: SupportUploadType;
}
