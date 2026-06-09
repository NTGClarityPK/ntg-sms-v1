import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseFilePipeBuilder,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import type { CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { CertificatesService } from './certificates.service';
import { GeneratePreviewDto, IssueCertificateDto } from './dto/issue-certificate.dto';
import { QueryCertificateHistoryDto } from './dto/query-certificate-history.dto';
import { QueryIssueFormDefaultsDto } from './dto/query-issue-form-defaults.dto';
import { UpdateCertificateSettingsDto } from './dto/update-certificate-settings.dto';

const FEATURE_CODE = 'certificates';

type UploadedLogoFile = {
  mimetype: string;
  buffer: Buffer;
};

@ApiTags('Certificates')
@Controller('api/v1/certificates')
@UseGuards(JwtAuthGuard, BranchGuard)
export class CertificatesController {
  constructor(
    private readonly certificatesService: CertificatesService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureFeatureEditAccess(
    user: CurrentUserPayload,
    branchId: string,
  ): Promise<void> {
    const roleNames = user.roles || [];
    if (roleNames.includes('school_admin')) return;
    if (roleNames.length === 0) {
      throw new ForbiddenException('No role assigned for this user');
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .in('name', roleNames);
    if (rolesError) {
      throw new ForbiddenException('Unable to verify role permissions');
    }
    const roleIds = (rolesData || []).map((r: { id: string }) => r.id);
    if (roleIds.length === 0) {
      throw new ForbiddenException('No valid role found for this user');
    }

    const { data: featureData, error: featureError } = await supabase
      .from('features')
      .select('id')
      .eq('code', FEATURE_CODE)
      .maybeSingle();
    if (featureError || !featureData) {
      throw new ForbiddenException(`${FEATURE_CODE} permission feature not configured`);
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);
    if (permissionError) {
      throw new ForbiddenException(`Unable to verify ${FEATURE_CODE} edit permissions`);
    }

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );
    if (!canEdit) {
      throw new ForbiddenException(`You do not have edit access to ${FEATURE_CODE}`);
    }
  }

  private async ensureFeatureViewAccess(
    user: CurrentUserPayload,
    branchId: string,
  ): Promise<void> {
    const roleNames = user.roles || [];
    if (roleNames.includes('school_admin')) return;
    if (roleNames.length === 0) {
      throw new ForbiddenException('No role assigned for this user');
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .in('name', roleNames);
    if (rolesError) {
      throw new ForbiddenException('Unable to verify role permissions');
    }
    const roleIds = (rolesData || []).map((r: { id: string }) => r.id);
    if (roleIds.length === 0) {
      throw new ForbiddenException('No valid role found for this user');
    }

    const { data: featureData, error: featureError } = await supabase
      .from('features')
      .select('id')
      .eq('code', FEATURE_CODE)
      .maybeSingle();
    if (featureError || !featureData) {
      throw new ForbiddenException(`${FEATURE_CODE} permission feature not configured`);
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);
    if (permissionError) {
      throw new ForbiddenException(`Unable to verify ${FEATURE_CODE} view permissions`);
    }

    const canView = (permissionRows || []).some(
      (row: { permission: string }) =>
        row.permission === 'view' || row.permission === 'edit',
    );
    if (!canView) {
      throw new ForbiddenException(`You do not have access to ${FEATURE_CODE}`);
    }
  }

  @Get('designs')
  async listDesigns(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureViewAccess(user, branch.branchId);
    return this.certificatesService.listDesigns();
  }

  @Get('settings')
  async getSettings(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.certificatesService.getSettings(branch.branchId);
  }

  @Put('settings')
  async updateSettings(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: UpdateCertificateSettingsDto,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.certificatesService.updateSettings(branch.branchId, body);
  }

  @Post('settings/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(image\/jpeg|image\/png|image\/webp|image\/svg\+xml)/,
        })
        .addMaxSizeValidator({ maxSize: 2 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: UploadedLogoFile,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.certificatesService.uploadLogo(
      branch.branchId,
      file.buffer,
      file.mimetype,
    );
  }

  @Get('issue-form-defaults')
  async issueFormDefaults(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryIssueFormDefaultsDto,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.certificatesService.getIssueFormDefaults(
      branch.branchId,
      query.studentId,
      query.certificateType,
    );
  }

  @Post('generate-preview')
  async generatePreview(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: GeneratePreviewDto,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.certificatesService.generatePreview(branch.branchId, body);
  }

  @Post('issue')
  async issue(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: IssueCertificateDto,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.certificatesService.issue(branch.branchId, user.id, body);
  }

  @Get('history')
  async history(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryCertificateHistoryDto,
  ) {
    await this.ensureFeatureViewAccess(user, branch.branchId);
    return this.certificatesService.findHistory(branch.branchId, query);
  }

  @Get('history/export')
  async exportHistory(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryCertificateHistoryDto,
    @Res() res: Response,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    const csv = await this.certificatesService.exportHistoryCsv(
      branch.branchId,
      query,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="certificate-history.csv"',
    );
    res.send(csv);
  }

  @Put(':id/revoke')
  async revoke(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.certificatesService.revoke(branch.branchId, id);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    await this.ensureFeatureViewAccess(user, branch.branchId);
    const buffer = await this.certificatesService.getPdfBuffer(
      branch.branchId,
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${id}.pdf"`);
    res.send(buffer);
  }
}
