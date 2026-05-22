import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { ParentsModule } from '../parents/parents.module';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { IdCardsController } from './id-cards.controller';
import { IdCardsService } from './id-cards.service';
import { CardDataService } from './card-data.service';
import { IdCardPdfService } from './id-card-pdf.service';
import { IdCardPhotoService } from './id-card-photo.service';
import { TemplatesService } from './templates.service';
import { IdCardJobWorkerService } from './id-card-job-worker.service';
import { IdCardDesignService } from './id-card-design.service';

@Module({
  imports: [ParentsModule, AcademicYearsModule],
  controllers: [IdCardsController],
  providers: [
    IdCardsService,
    CardDataService,
    IdCardPdfService,
    IdCardPhotoService,
    TemplatesService,
    IdCardDesignService,
    IdCardJobWorkerService,
    SupabaseConfig,
  ],
  exports: [IdCardsService],
})
export class IdCardsModule {}
