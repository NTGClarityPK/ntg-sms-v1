import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BulkImportService } from './bulk-import.service';
import { BulkImportController } from './bulk-import.controller';

@Module({
  controllers: [BulkImportController],
  providers: [BulkImportService, SupabaseConfig],
})
export class BulkImportModule {}
