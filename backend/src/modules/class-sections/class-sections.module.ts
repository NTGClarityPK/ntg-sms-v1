import { Module } from '@nestjs/common';
import { ClassSectionsController } from './class-sections.controller';
import { ClassSectionsService } from './class-sections.service';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [AcademicYearsModule, SubscriptionModule],
  controllers: [ClassSectionsController],
  providers: [ClassSectionsService, SupabaseConfig],
  exports: [ClassSectionsService],
})
export class ClassSectionsModule {}

