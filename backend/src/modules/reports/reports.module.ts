import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { PdfLogoCacheService } from '../../common/pdf/pdf-logo-cache.service';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { GradesModule } from '../grades/grades.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { BehavioralModule } from '../behavioral/behavioral.module';
import { StudentsModule } from '../students/students.module';
import { BranchesModule } from '../branches/branches.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PublicStatisticsController } from './public-statistics.controller';
import { RevenueReportsService } from './revenue/revenue-reports.service';
import { FeeManagementRevenueProvider } from './revenue/fee-management-revenue.provider';
import { IdCardReprintRevenueProvider } from './revenue/id-card-reprint-revenue.provider';
import { REVENUE_SOURCE_PROVIDERS } from './revenue/revenue-source.types';

@Module({
  imports: [
    AcademicYearsModule,
    GradesModule,
    AttendanceModule,
    BehavioralModule,
    StudentsModule,
    BranchesModule,
    SubscriptionModule,
  ],
  controllers: [ReportsController, PublicStatisticsController],
  providers: [
    ReportsService,
    RevenueReportsService,
    FeeManagementRevenueProvider,
    IdCardReprintRevenueProvider,
    {
      provide: REVENUE_SOURCE_PROVIDERS,
      useFactory: (
        fee: FeeManagementRevenueProvider,
        idCard: IdCardReprintRevenueProvider,
      ) => [fee, idCard],
      inject: [FeeManagementRevenueProvider, IdCardReprintRevenueProvider],
    },
    SupabaseConfig,
    PdfLogoCacheService,
  ],
  exports: [ReportsService, RevenueReportsService],
})
export class ReportsModule {}
