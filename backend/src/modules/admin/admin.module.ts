import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AdminController } from './admin.controller';
import { AdminSubscriptionService } from './admin-subscription.service';
import { AdminAssessmentsLockService } from './admin-assessments-lock.service';
import { AdminTenantDeleteService } from './admin-tenant-delete.service';
import { AdminLogsService } from './admin-logs.service';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';
import { ApiHitsInterceptor } from './interceptors/api-hits.interceptor';

@Module({
  imports: [SubscriptionModule],
  controllers: [AdminController],
  providers: [
    SupabaseConfig,
    AdminSubscriptionService,
    AdminAssessmentsLockService,
    AdminTenantDeleteService,
    AdminLogsService,
    AdminApiKeyGuard,
    ApiHitsInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiHitsInterceptor,
    },
  ],
  exports: [AdminAssessmentsLockService, AdminLogsService],
})
export class AdminModule {}
