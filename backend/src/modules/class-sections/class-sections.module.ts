import { Module } from '@nestjs/common';
import { ClassSectionsController } from './class-sections.controller';
import { ClassSectionsService } from './class-sections.service';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Module({
  imports: [AcademicYearsModule],
  controllers: [ClassSectionsController],
  providers: [ClassSectionsService, SupabaseConfig],
  exports: [ClassSectionsService],
})
export class ClassSectionsModule {}

