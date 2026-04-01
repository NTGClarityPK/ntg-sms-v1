import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Param,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { TenantsService } from './tenants.service';
import { TenantDto } from './dto/tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantStatisticsDto } from './dto/tenant-statistics.dto';
import { SetTenantActivationDto } from './dto/set-tenant-activation.dto';

type UploadedLogoFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@UseGuards(JwtAuthGuard)
@Controller('api/v1/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  @UseGuards(BranchGuard)
  async getMe(@CurrentBranch() branch: CurrentBranchContext): Promise<{ data: TenantDto }> {
    return this.tenantsService.getMe(branch.tenantId);
  }

  @Patch('me')
  @UseGuards(BranchGuard)
  async updateMe(
    @CurrentBranch() branch: CurrentBranchContext,
    @Body() body: UpdateTenantDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: TenantDto }> {
    const updated = await this.tenantsService.updateMe(
      branch.tenantId,
      {
        name: body.name,
        domain: body.domain,
        email: body.email,
        phone: body.phone,
        timezone: body.timezone,
        fiscalYearStart: body.fiscalYearStart,
        vatNumber: body.vatNumber,
        primaryColor: body.primaryColor,
      },
      user.email,
    );
    return { data: updated.data };
  }

  @Post('logo')
  @UseGuards(BranchGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/,
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: UploadedLogoFile,
  ): Promise<{ data: TenantDto }> {
    return this.tenantsService.uploadLogo(branch.tenantId, file, user.email);
  }

  private assertAdminTenantManagementAccess(
    user: CurrentUserPayload,
    opts?: { allowOwner?: boolean },
  ): void {
    const isSuperAdmin = user.roles?.includes('super_admin');
    const isDev =
      user.email?.endsWith('@ntg.com') ||
      user.email?.endsWith('@example.com') ||
      user.email?.endsWith('@ntgclarity.com') ||
      user.email?.endsWith('@superuser.com');
    const isOwner = user.roles?.includes('tenant_owner');

    const allowOwner = opts?.allowOwner ?? false;
    if (!isSuperAdmin && !isDev && !(allowOwner && isOwner)) {
      throw new ForbiddenException(
        allowOwner
          ? 'This endpoint is only accessible to super admins, developers and owners'
          : 'This endpoint is only accessible to super admins and developers',
      );
    }
  }

  @Get('all')
  async listAll(@CurrentUser() user: CurrentUserPayload): Promise<{ data: TenantDto[] }> {
    this.assertAdminTenantManagementAccess(user, { allowOwner: true });
    return this.tenantsService.listAll();
  }

  @Get('statistics')
  async getStatistics(@CurrentUser() user: CurrentUserPayload): Promise<{ data: TenantStatisticsDto[] }> {
    this.assertAdminTenantManagementAccess(user, { allowOwner: true });
    return this.tenantsService.getTenantStatistics();
  }

  @Patch(':tenantId/activation')
  async setTenantActivation(
    @Param('tenantId') tenantId: string,
    @Body() body: SetTenantActivationDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: TenantDto }> {
    this.assertAdminTenantManagementAccess(user, { allowOwner: false });
    return this.tenantsService.setTenantActivation(tenantId, body.isActive, user.email);
  }

  @Post(':tenantId/deletion-request')
  async requestTenantDeletion(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: TenantDto }> {
    this.assertAdminTenantManagementAccess(user, { allowOwner: false });
    return this.tenantsService.requestTenantDeletion(tenantId, user.email);
  }

  @Post(':tenantId/deletion-cancel')
  async cancelTenantDeletion(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: TenantDto }> {
    this.assertAdminTenantManagementAccess(user, { allowOwner: false });
    return this.tenantsService.cancelTenantDeletion(tenantId, user.email);
  }
}








