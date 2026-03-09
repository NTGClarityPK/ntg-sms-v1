import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateResultCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  classTeacherComment?: string;
}
