import { IsIn, IsOptional } from 'class-validator';

export class UpdateResultStatusDto {
  @IsIn(['draft', 'approved', 'published'])
  status!: string;

  /** Locked onto the card when publishing so parents download this layout. */
  @IsOptional()
  @IsIn(['minimal', 'modern'])
  pdfVariant?: 'minimal' | 'modern';
}
