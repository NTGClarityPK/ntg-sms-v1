import { ClassDto } from './class.dto';

export class LevelDto {
  id!: string;
  name!: string;
  nameAr?: string;
  sortOrder!: number;
  createdAt!: string;
  updatedAt!: string;
  classes: ClassDto[] = [];

  constructor(partial: Partial<LevelDto>) {
    Object.assign(this, partial);
  }
}


