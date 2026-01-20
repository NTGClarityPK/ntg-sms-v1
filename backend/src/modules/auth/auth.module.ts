import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { GlobalJwtModule } from '../../common/modules/jwt/global-jwt.module';

@Module({
  imports: [
    GlobalJwtModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SupabaseConfig],
  exports: [AuthService, GlobalJwtModule],
})
export class AuthModule {}

