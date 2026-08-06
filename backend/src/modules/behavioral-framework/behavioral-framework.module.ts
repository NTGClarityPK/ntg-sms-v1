import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { BehavioralFrameworkController } from './behavioral-framework.controller';
import { BehavioralFrameworkService } from './behavioral-framework.service';

@Module({
  imports: [AcademicYearsModule, SubscriptionModule],
  controllers: [BehavioralFrameworkController],
  providers: [BehavioralFrameworkService, SupabaseConfig],
  exports: [BehavioralFrameworkService],
})
export class BehavioralFrameworkModule {}
