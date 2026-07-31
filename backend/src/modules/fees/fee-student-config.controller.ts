import { Body, Controller, Delete, ForbiddenException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CreateFeeStudentTemplateLinkDto, UpdateFeeStudentTemplateLinkDto } from './dto/create-student-template-link.dto';
import { CreateFeeMetricExclusionDto } from './dto/create-metric-exclusion.dto';
import { FeeStudentConfigService } from './fee-student-config.service';
import { FeatureAccessGuard, RequiresFeature } from '../subscription/guards/feature-access.guard';

@ApiTags('Fees')
@Controller('api/v1/fees')
@UseGuards(JwtAuthGuard, BranchGuard, FeatureAccessGuard)
@RequiresFeature('hasFeeManagement')
export class FeeStudentConfigController {
  constructor(private readonly feeStudentConfigService: FeeStudentConfigService) {}

  private ensureFeesAdmin(user: CurrentUserPayload): void {
    const roles = user.roles ?? [];
    if (roles.includes('school_admin') || roles.includes('principal')) return;
    throw new ForbiddenException('Only school admin can manage student fee configuration');
  }

  @Post('student-template-links')
  async createStudentTemplateLink(
    @Body() body: CreateFeeStudentTemplateLinkDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { id: string } }> {
    // Admin-only
    this.ensureFeesAdmin(user);
    return this.feeStudentConfigService.createStudentTemplateLink(body, branch.branchId);
  }

  @Put('student-template-links/:id')
  async updateStudentTemplateLink(
    @Param('id') id: string,
    @Body() body: UpdateFeeStudentTemplateLinkDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { id: string; isActive: boolean } }> {
    this.ensureFeesAdmin(user);
    return this.feeStudentConfigService.updateStudentTemplateLink(id, body, branch.branchId);
  }

  @Post('metric-exclusions')
  async createMetricExclusion(
    @Body() body: CreateFeeMetricExclusionDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { id: string } }> {
    this.ensureFeesAdmin(user);
    return this.feeStudentConfigService.createMetricExclusion(body, user.id, branch.branchId);
  }

  @Delete('metric-exclusions/:id')
  async deleteMetricExclusion(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { success: boolean } }> {
    this.ensureFeesAdmin(user);
    return this.feeStudentConfigService.deleteMetricExclusion(id, branch.branchId);
  }
}

