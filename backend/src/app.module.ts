import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule as NestCronScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GlobalJwtModule } from './common/modules/jwt/global-jwt.module';
import { AuthModule } from './modules/auth/auth.module';
import { AcademicYearsModule } from './modules/academic-years/academic-years.module';
import { CoreLookupsModule } from './modules/core-lookups/core-lookups.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { GradesModule } from './modules/grades/grades.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { BranchesModule } from './modules/branches/branches.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { StudentsModule } from './modules/students/students.module';
import { ParentsModule } from './modules/parents/parents.module';
import { StaffModule } from './modules/staff/staff.module';
import { ClassSectionsModule } from './modules/class-sections/class-sections.module';
import { TeacherAssignmentsModule } from './modules/teacher-assignments/teacher-assignments.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettingsStatusModule } from './modules/settings-status/settings-status.module';
import { RegistrationModule } from './modules/registration/registration.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module';
import { EarlyDepartureModule } from './modules/early-departure/early-departure.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { SubjectTemplatesModule } from './modules/subject-templates/subject-templates.module';
import { EventsModule } from './modules/events/events.module';
import { BehavioralModule } from './modules/behavioral/behavioral.module';
import { BehavioralFrameworkModule } from './modules/behavioral-framework/behavioral-framework.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ResultsModule } from './modules/results/results.module';
import { StudentPlacementModule } from './common/modules/student-placement/student-placement.module';
import { MessagesModule } from './modules/messages/messages.module';
import { LibraryModule } from './modules/library/library.module';
import { UniformsModule } from './modules/uniforms/uniforms.module';
import { UniformRequestsModule } from './modules/uniform-requests/uniform-requests.module';
import { UniformIssuancesModule } from './modules/uniform-issuances/uniform-issuances.module';
import { StorageModule } from './modules/storage/storage.module';
import { PushModule } from './modules/push/push.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { BulkImportModule } from './modules/bulk-import/bulk-import.module';
import { StudentSelfModule } from './modules/student-self/student-self.module';
import { SettingsImportModule } from './modules/settings-import/settings-import.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { PromotionPlacementModule } from './modules/promotion-placement/promotion-placement.module';
import { SetupWizardModule } from './modules/setup-wizard/setup-wizard.module';
import { FeesModule } from './modules/fees/fees.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { IdCardsModule } from './modules/id-cards/id-cards.module';
import { DataExportModule } from './modules/data-export/data-export.module';
import { SubstitutionsModule } from './modules/substitutions/substitutions.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { RubricsModule } from './modules/rubrics/rubrics.module';
import { GoogleWorkspaceModule } from './modules/google-workspace/google-workspace.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    NestCronScheduleModule.forRoot(),
    GlobalJwtModule,
    StudentPlacementModule,
    AuthModule,
    AcademicYearsModule,
    CoreLookupsModule,
    ScheduleModule,
    AssessmentModule,
    AssessmentsModule,
    GradesModule,
    SystemSettingsModule,
    BranchesModule,
    RolesModule,
    UsersModule,
    StudentsModule,
    ParentsModule,
    StaffModule,
    ClassSectionsModule,
    TeacherAssignmentsModule,
    AttendanceModule,
    LeaveRequestsModule,
    NotificationsModule,
    SettingsStatusModule,
    RegistrationModule,
    TenantsModule,
    EarlyDepartureModule,
    TimetableModule,
    SubjectTemplatesModule,
    EventsModule,
    BehavioralModule,
    BehavioralFrameworkModule,
    ReportsModule,
    ResultsModule,
    MessagesModule,
    LibraryModule,
    UniformsModule,
    UniformRequestsModule,
    UniformIssuancesModule,
    StorageModule,
    PushModule,
    DashboardModule,
    BulkImportModule,
    SettingsImportModule,
    StudentSelfModule,
    InvitationsModule,
    PromotionPlacementModule,
    SetupWizardModule,
    FeesModule,
    SubscriptionModule,
    IdCardsModule,
    DataExportModule,
    SubstitutionsModule,
    CertificatesModule,
    RubricsModule,
    GoogleWorkspaceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}

