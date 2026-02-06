import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GlobalJwtModule,
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

