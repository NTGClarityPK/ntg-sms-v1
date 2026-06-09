import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { ParentsModule } from '../parents/parents.module';
import { CertificatesController } from './certificates.controller';
import { CertificatesPortalController } from './certificates-portal.controller';
import { CertificatesService } from './certificates.service';
import { CertificateTemplateService } from './certificate-template.service';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificateStudentDataService } from './certificate-student-data.service';

@Module({
  imports: [ParentsModule, AcademicYearsModule],
  controllers: [CertificatesController, CertificatesPortalController],
  providers: [
    CertificatesService,
    CertificateTemplateService,
    CertificatePdfService,
    CertificateStudentDataService,
    SupabaseConfig,
  ],
  exports: [CertificatesService],
})
export class CertificatesModule {}
