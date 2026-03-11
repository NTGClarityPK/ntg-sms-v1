import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { BehavioralModule } from '../behavioral/behavioral.module';
import { ReportsModule } from '../reports/reports.module';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';

@Module({
  imports: [AcademicYearsModule, BehavioralModule, ReportsModule],
  controllers: [ResultsController],
  providers: [ResultsService, SupabaseConfig],
  exports: [ResultsService],
})
export class ResultsModule {}
