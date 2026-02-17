import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, SupabaseConfig],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
