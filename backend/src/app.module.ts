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
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';

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
    SystemSettingsModule,
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

