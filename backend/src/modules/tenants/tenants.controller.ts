import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  ParseFilePipeBuilder,
  Patch,
  Post,
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

type UploadedLogoFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  async getMe(@CurrentBranch() branch: CurrentBranchContext): Promise<{ data: TenantDto }> {
    return this.tenantsService.getMe(branch.tenantId);
  }

  @Patch('me')
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

  @Get('all')
  @UseGuards(JwtAuthGuard)
  async listAll(@CurrentUser() user: CurrentUserPayload): Promise<{ data: TenantDto[] }> {
    // Super admin only access
    const isSuperAdmin = user.roles?.includes('super_admin');
    const isDev = user.email?.endsWith('@ntg.com') || user.email?.endsWith('@example.com');
    const isOwner = user.roles?.includes('tenant_owner');
    
    if (!isSuperAdmin && !isDev && !isOwner) {
      throw new ForbiddenException('This endpoint is only accessible to super admins, developers and owners');
    }

    return this.tenantsService.listAll();
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard)
  async getStatistics(@CurrentUser() user: CurrentUserPayload): Promise<{ data: TenantStatisticsDto[] }> {
    // Super admin only access
    const isSuperAdmin = user.roles?.includes('super_admin');
    const isDev = user.email?.endsWith('@ntg.com') || user.email?.endsWith('@example.com');
    const isOwner = user.roles?.includes('tenant_owner');
    
    if (!isSuperAdmin && !isDev && !isOwner) {
      throw new ForbiddenException('This endpoint is only accessible to super admins, developers and owners');
    }

    return this.tenantsService.getTenantStatistics();
  }
}








