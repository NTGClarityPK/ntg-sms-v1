export class UserResponseDto {
  id!: string;
  email!: string;
  fullName!: string;
  avatarUrl?: string;
  roles?: string[];

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

