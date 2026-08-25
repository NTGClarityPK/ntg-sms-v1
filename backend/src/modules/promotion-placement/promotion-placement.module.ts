import { forwardRef, Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { PromotionPlacementController } from './promotion-placement.controller';
import { PromotionPlacementService } from './promotion-placement.service';
import { PromotionWindowService } from './promotion-window.service';

@Module({
  imports: [forwardRef(() => AcademicYearsModule)],
  controllers: [PromotionPlacementController],
  providers: [PromotionPlacementService, PromotionWindowService, SupabaseConfig],
  exports: [PromotionPlacementService, PromotionWindowService],
})
export class PromotionPlacementModule {}

