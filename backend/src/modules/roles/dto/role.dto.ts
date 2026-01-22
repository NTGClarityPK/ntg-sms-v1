export class RoleDto {
  id!: string;
  name!: string;
  displayName!: string;
  displayNameAr?: string;
  description?: string;
  createdAt!: string;

  constructor(partial: Partial<RoleDto>) {
    Object.assign(this, partial);
  }
}

