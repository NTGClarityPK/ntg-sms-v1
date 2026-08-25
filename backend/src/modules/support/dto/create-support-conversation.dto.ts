import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSupportConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;
}
