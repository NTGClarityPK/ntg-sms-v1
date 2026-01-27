import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BranchesController],
  providers: [BranchesService, SupabaseConfig],
})
export class BranchesModule {}




