import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthPublicController } from './auth-public.controller';
import { AuthService } from './auth.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { GlobalJwtModule } from '../../common/modules/jwt/global-jwt.module';
import { StudentTokenService } from '../../common/modules/student-token/student-token.service';

@Module({
  imports: [
    GlobalJwtModule,
  ],
  controllers: [AuthController, AuthPublicController],
  providers: [AuthService, SupabaseConfig, StudentTokenService],
  exports: [AuthService, GlobalJwtModule, StudentTokenService],
})
export class AuthModule {}

