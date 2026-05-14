import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { PdfLogoCacheService } from '../../common/pdf/pdf-logo-cache.service';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { BehavioralModule } from '../behavioral/behavioral.module';
import { ReportsModule } from '../reports/reports.module';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { ResultReportSettingsService } from './result-report-settings.service';
import { ResultReportSettingsController } from './result-report-settings.controller';

@Module({
  imports: [AcademicYearsModule, BehavioralModule, ReportsModule],
  controllers: [ResultsController, ResultReportSettingsController],
  providers: [ResultsService, ResultReportSettingsService, SupabaseConfig, PdfLogoCacheService],
  exports: [ResultsService, ResultReportSettingsService],
})
export class ResultsModule {}
