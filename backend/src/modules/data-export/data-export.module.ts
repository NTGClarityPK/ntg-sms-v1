import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SchoolAdminGuard } from '../subscription/guards/school-admin.guard';
import { DataExportController } from './data-export.controller';
import { DataExportService } from './data-export.service';
import { DataExportReauthService } from './data-export-reauth.service';
import { SchoolDataCollectorService } from './school-data-collector.service';

@Module({
  controllers: [DataExportController],
  providers: [
    DataExportService,
    DataExportReauthService,
    SchoolDataCollectorService,
    SupabaseConfig,
    SchoolAdminGuard,
  ],
})
export class DataExportModule {}
