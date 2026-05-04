import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { InvitationsService } from './invitations.service';
import { ResendInvitationDto } from './dto/resend-invitation.dto';
import { ResendInvitationForUserDto } from './dto/resend-invitation-for-user.dto';

@ApiTags('Invitations')
@Controller('api/v1/invitations')
@UseGuards(JwtAuthGuard, BranchGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('resend')
  async resend(
    @Body() body: ResendInvitationDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const data = await this.invitationsService.resendInvitation({
      invitationId: body.invitationId,
      token: body.token,
      recipientEmailOverride: body.recipientEmail,
      createdByUserId: user.id,
      userEmailForAudit: user.email,
      branchId: branch.branchId,
    });
    return { data };
  }

  @Post('resend-for-user')
  async resendForUser(
    @Body() body: ResendInvitationForUserDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const data = await this.invitationsService.resendLatestInvitationForUser({
      userId: body.userId,
      invitationType: body.invitationType,
      recipientEmailOverride: body.recipientEmail,
      createdByUserId: user.id,
      userEmailForAudit: user.email,
      branchId: branch.branchId,
    });
    return { data };
  }
}

