import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Module({
  controllers: [BranchesController],
  providers: [BranchesService, SupabaseConfig],
})
export class BranchesModule {}


