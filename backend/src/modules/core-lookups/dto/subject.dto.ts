export class SubjectDto {
  id!: string;
  name!: string;
  nameAr?: string;
  code?: string;
  isActive!: boolean;
  sortOrder!: number;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<SubjectDto>) {
    Object.assign(this, partial);
  }
}


