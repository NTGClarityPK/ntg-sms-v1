import { IsNotEmpty, IsString } from 'class-validator';
import { CreateBranchDto } from './create-branch.dto';

export class AssignBranchToTenantDto extends CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}
