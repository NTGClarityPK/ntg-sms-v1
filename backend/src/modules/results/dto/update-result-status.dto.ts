import { IsIn } from 'class-validator';

export class UpdateResultStatusDto {
  @IsIn(['draft', 'approved', 'published'])
  status!: string;
}
