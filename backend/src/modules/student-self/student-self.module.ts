import { Module } from '@nestjs/common';
import { StudentSelfController } from './student-self.controller';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AssessmentsModule } from '../assessments/assessments.module';
import { ChallanService } from '../fees/challan.service';
import { PaymentService } from '../fees/payment.service';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { FeeCalculationService } from '../fees/fee-calculation.service';
import { FeePdfService } from '../fees/fee-pdf.service';
import { StudentFeesController } from './student-fees.controller';

@Module({
  imports: [AssessmentsModule],
  controllers: [StudentSelfController, StudentFeesController],
  providers: [
    SupabaseConfig,
    AcademicYearsService,
    FeeCalculationService,
    FeePdfService,
    ChallanService,
    PaymentService,
  ],
})
export class StudentSelfModule {}

