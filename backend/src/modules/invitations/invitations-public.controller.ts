import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import { SetupInvitationDto } from './dto/setup-invitation.dto';

@ApiTags('Invitations')
@Controller('api/v1/invitations')
export class InvitationsPublicController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get('setup/:token')
  async getSetupInfo(@Param('token') token: string) {
    const data = await this.invitationsService.validateSetupToken(token);
    return { data };
  }

  @Post('setup/:token')
  async setupPassword(
    @Param('token') token: string,
    @Body() body: SetupInvitationDto,
  ) {
    const data = await this.invitationsService.setupPassword(token, body.password);
    return { data };
  }
}

