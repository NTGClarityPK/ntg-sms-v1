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
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { TenantsService } from './tenants.service';
import { TenantDto } from './dto/tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

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
  ): Promise<{ data: TenantDto }> {
    const updated = await this.tenantsService.updateMe(branch.tenantId, {
      name: body.name,
      primaryColor: body.primaryColor,
    });
    return { data: updated.data };
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @CurrentBranch() branch: CurrentBranchContext,
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
    return this.tenantsService.uploadLogo(branch.tenantId, file);
  }
}








