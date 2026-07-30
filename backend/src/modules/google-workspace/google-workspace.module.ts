import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { RubricsModule } from '../rubrics/rubrics.module';
import { GoogleWorkspaceController } from './google-workspace.controller';
import { GoogleWorkspaceOAuthController } from './google-workspace-oauth.controller';
import { GoogleWorkspaceService } from './google-workspace.service';
import { GoogleClassroomApiService } from './services/google-classroom-api.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { GradePullService } from './services/grade-pull.service';
import { TokenEncryptionService } from './services/token-encryption.service';

@Module({
  imports: [ConfigModule, RubricsModule],
  controllers: [GoogleWorkspaceController, GoogleWorkspaceOAuthController],
  providers: [
    GoogleWorkspaceService,
    GradePullService,
    GoogleOAuthService,
    GoogleClassroomApiService,
    TokenEncryptionService,
    SupabaseConfig,
  ],
  exports: [GoogleWorkspaceService],
})
export class GoogleWorkspaceModule {}
