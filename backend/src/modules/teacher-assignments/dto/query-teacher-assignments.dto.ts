import { IsOptional, IsUUID } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/base-pagination.dto';

export class QueryTeacherAssignmentsDto extends BasePaginationDto {
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

