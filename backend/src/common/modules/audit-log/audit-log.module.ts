import { Global, Module } from '@nestjs/common';
import { AuditLogService } from '../../services/audit-log.service';
import { SupabaseConfig } from '../../config/supabase.config';

@Global()
@Module({
  providers: [AuditLogService, SupabaseConfig],
  exports: [AuditLogService],
})
export class AuditLogModule {}
