import { IsIn, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateFeeTemplateAssignmentDto {
  @IsString()
  @IsIn(['Level', 'Class', 'Section'])
  scopeType!: 'Level' | 'Class' | 'Section';

  @IsUUID()
  @IsNotEmpty()
  scopeId!: string;
}

