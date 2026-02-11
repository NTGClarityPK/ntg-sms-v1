import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { BehavioralService } from './behavioral.service';
import { BehavioralController } from './behavioral.controller';

@Module({
  imports: [AcademicYearsModule],
  controllers: [BehavioralController],
  providers: [BehavioralService, SupabaseConfig],
  exports: [BehavioralService],
})
export class BehavioralModule {}
