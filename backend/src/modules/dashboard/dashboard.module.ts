import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, SupabaseConfig],
  exports: [DashboardService],
})
export class DashboardModule {}
