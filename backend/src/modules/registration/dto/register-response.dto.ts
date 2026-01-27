export class RegisterResponseDto {
  user!: {
    id: string;
    email: string;
    fullName: string;
    tenantId: string;
    branchId: string;
  };
  accessToken!: string;
  refreshToken!: string;
}


