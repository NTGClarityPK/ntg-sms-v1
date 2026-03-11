export class ProfileResponseDto {
  id!: string;
  email!: string;
  fullName!: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<ProfileResponseDto>) {
    Object.assign(this, partial);
  }
}

