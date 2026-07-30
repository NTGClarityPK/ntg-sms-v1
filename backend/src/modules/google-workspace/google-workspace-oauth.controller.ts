import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { GoogleWorkspaceService } from './google-workspace.service';

/**
 * Unguarded OAuth callback — Google redirects here without a JWT.
 */
@ApiTags('Google Workspace OAuth')
@Controller('api/v1/google-workspace')
export class GoogleWorkspaceOAuthController {
  constructor(
    private readonly googleWorkspaceService: GoogleWorkspaceService,
  ) {}

  @Get('oauth-callback')
  async oauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (error) {
      const message =
        errorDescription || error || 'Google authorisation was cancelled';
      res.redirect(this.googleWorkspaceService.getOAuthErrorRedirect(message));
      return;
    }

    if (!code || !state) {
      res.redirect(
        this.googleWorkspaceService.getOAuthErrorRedirect(
          'Missing authorisation code or state',
        ),
      );
      return;
    }

    try {
      const result = await this.googleWorkspaceService.handleOAuthCallback(
        code,
        state,
      );
      res.redirect(result.frontendRedirect);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to complete Google Classroom connection';
      res.redirect(this.googleWorkspaceService.getOAuthErrorRedirect(message));
    }
  }
}
