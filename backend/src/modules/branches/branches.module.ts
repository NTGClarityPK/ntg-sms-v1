import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [AuthModule, SubscriptionModule],
  controllers: [BranchesController],
  providers: [BranchesService, SupabaseConfig],
  exports: [BranchesService],
})
export class BranchesModule {}




