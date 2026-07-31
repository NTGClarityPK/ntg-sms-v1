import {
  Body,
  Controller,
  Get,
  HttpStatus,
  ParseFilePipeBuilder,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { TenantsService } from './tenants.service';
import { TenantDto } from './dto/tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

type UploadedLogoFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@ApiTags('Tenants & branches')
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
        defaultLocale: body.defaultLocale,
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
}
