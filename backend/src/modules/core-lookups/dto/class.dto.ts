export class ClassDto {
  id!: string;
  name!: string;
  displayName!: string;
  sortOrder!: number;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<ClassDto>) {
    Object.assign(this, partial);
  }
}


