import { GradeRangeDto } from './grade-range.dto';

export class GradeTemplateDto {
  id!: string;
  name!: string;
  createdAt!: string;
  updatedAt!: string;
  ranges: GradeRangeDto[] = [];

  constructor(partial: Partial<GradeTemplateDto>) {
    Object.assign(this, partial);
  }
}


