import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { FeeStudentsController } from './fee-students.controller';
import { FeeCalculationService } from './fee-calculation.service';
import { FeeStudentConfigController } from './fee-student-config.controller';
import { FeeStudentConfigService } from './fee-student-config.service';
import { ChallanController } from './challan.controller';
import { ChallanService } from './challan.service';
import { ChallanJobWorkerService } from './challan-job-worker.service';
import { FeePdfService } from './fee-pdf.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { LateFeeService } from './late-fee.service';
import { LateFeeController } from './late-fee.controller';
import { FeeReportsService } from './fee-reports.service';
import { FeeReportsController } from './fee-reports.controller';
import { FeeChallanSettingsController } from './fee-challan-settings.controller';
import { FeeChallanSettingsService } from './fee-challan-settings.service';

@Module({
  imports: [AcademicYearsModule, SubscriptionModule],
  controllers: [
    TemplateController,
    FeeStudentsController,
    FeeStudentConfigController,
    ChallanController,
    PaymentController,
    LateFeeController,
    FeeReportsController,
    FeeChallanSettingsController,
  ],
  providers: [
    TemplateService,
    FeeCalculationService,
    FeeStudentConfigService,
    ChallanService,
    ChallanJobWorkerService,
    FeePdfService,
    PaymentService,
    LateFeeService,
    FeeReportsService,
    FeeChallanSettingsService,
    SupabaseConfig,
  ],
  exports: [TemplateService, FeeCalculationService],
})
export class FeesModule {}

