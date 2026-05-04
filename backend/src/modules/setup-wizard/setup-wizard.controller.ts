import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CommitSetupWizardDto } from './dto/commit-setup-wizard.dto';
import { SetupWizardService } from './setup-wizard.service';

@ApiTags('Setup wizard')
@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1')
export class SetupWizardController {
  constructor(private readonly setupWizardService: SetupWizardService) {}

  @Post('setup-wizard/commit')
  async commit(
    @Body() body: CommitSetupWizardDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { success: boolean; academicYearId?: string | null } }> {
    return this.setupWizardService.commitSetupWizard({
      payload: body,
      branchId: branch.branchId,
      tenantId: branch.tenantId,
      userEmail: user.email,
    });
  }
}

