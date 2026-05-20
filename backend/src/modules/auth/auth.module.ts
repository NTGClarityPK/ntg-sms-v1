import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthPublicController } from './auth-public.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { MailjetService } from '../../common/services/email/mailjet.service';
import { GlobalJwtModule } from '../../common/modules/jwt/global-jwt.module';
import { StudentTokenService } from '../../common/modules/student-token/student-token.service';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    GlobalJwtModule,
    SystemSettingsModule,
  ],
  controllers: [AuthController, AuthPublicController],
  providers: [
    AuthService,
    SupabaseConfig,
    StudentTokenService,
    PasswordResetService,
    MailjetService,
  ],
  exports: [AuthService, GlobalJwtModule, StudentTokenService],
})
export class AuthModule {}

