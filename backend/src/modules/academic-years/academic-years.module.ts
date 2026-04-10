import { forwardRef, Module } from '@nestjs/common';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { PromotionPlacementModule } from '../promotion-placement/promotion-placement.module';

@Module({
  imports: [forwardRef(() => PromotionPlacementModule)],
  controllers: [AcademicYearsController],
  providers: [AcademicYearsService, SupabaseConfig],
  exports: [AcademicYearsService],
})
export class AcademicYearsModule {}


