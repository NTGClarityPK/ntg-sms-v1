export class SectionDto {
  id!: string;
  name!: string;
  isActive!: boolean;
  sortOrder!: number;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<SectionDto>) {
    Object.assign(this, partial);
  }
}


