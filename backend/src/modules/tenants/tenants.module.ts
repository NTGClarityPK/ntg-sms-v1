import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantDeletionScheduler } from './tenant-deletion.scheduler';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, TenantDeletionScheduler, SupabaseConfig],
  exports: [TenantsService],
})
export class TenantsModule {}


