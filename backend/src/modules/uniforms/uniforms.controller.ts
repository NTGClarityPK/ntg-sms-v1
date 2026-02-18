import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  ParseFilePipeBuilder,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import {
  CurrentBranch,
  type CurrentBranchContext,
} from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { UniformsService } from './uniforms.service';
import { UniformItemDto, StockEntryDto } from './dto/uniform-item.dto';
import { CreateUniformItemDto } from './dto/create-uniform-item.dto';
import { UpdateUniformItemDto } from './dto/update-uniform-item.dto';
import { QueryUniformsDto } from './dto/query-uniforms.dto';
import { AddOrUpdateStockDto } from './dto/add-or-update-stock.dto';
import { UpdateStockQuantityDto } from './dto/update-stock-quantity.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BranchesService } from '../branches/branches.service';

type UploadedImageFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/uniforms')
export class UniformsController {
  constructor(
    private readonly uniformsService: UniformsService,
    private readonly supabaseConfig: SupabaseConfig,
    private readonly branchesService: BranchesService,
  ) {}

  private async ensureFeatureEditAccess(
    user: CurrentUserPayload,
    branchId: string,
    featureCode: string,
  ): Promise<void> {
    const roleNames = user.roles || [];
    if (roleNames.includes('school_admin')) return;
    if (roleNames.length === 0)
      throw new ForbiddenException('No role assigned for this user');

    const supabase = this.supabaseConfig.getClient();
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .in('name', roleNames);
    if (rolesError)
      throw new ForbiddenException('Unable to verify role permissions');
    const roleIds = (rolesData || []).map((r: { id: string }) => r.id);
    if (roleIds.length === 0)
      throw new ForbiddenException('No valid role found for this user');

    const { data: featureData, error: featureError } = await supabase
      .from('features')
      .select('id')
      .eq('code', featureCode)
      .maybeSingle();
    if (featureError || !featureData) {
      throw new ForbiddenException(
        `${featureCode} permission feature not configured`,
      );
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);
    if (permissionError) {
      throw new ForbiddenException(
        `Unable to verify ${featureCode} edit permissions`,
      );
    }

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );
    if (!canEdit)
      throw new ForbiddenException(
        `You do not have edit access to ${featureCode}`,
      );
  }

  @Get('low-stock')
  async getLowStock(
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: UniformItemDto[] }> {
    const items = await this.uniformsService.getLowStock(branch.branchId);
    return { data: items };
  }

  @Get()
  async list(
    @Query() query: QueryUniformsDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    data: UniformItemDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.uniformsService.list(query, branch.branchId);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: UniformItemDto }> {
    const item = await this.uniformsService.getById(id, branch.branchId);
    return { data: item };
  }

  @Post()
  async create(
    @Body() input: CreateUniformItemDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: UniformItemDto }> {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'inventory');
    const item = await this.uniformsService.create(
      input,
      branch.branchId,
    );
    return { data: item };
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/i,
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    file: UploadedImageFile,
  ): Promise<{ data: { imageUrl: string } }> {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'inventory');

    const supabase = this.supabaseConfig.getClient();

    // Check storage quota BEFORE upload
    const branchData = await this.branchesService.getById(branch.branchId);
    const quotaBytes = branchData.storageQuotaGb * 1024 * 1024 * 1024;
    if (branchData.storageUsedBytes + file.size > quotaBytes) {
      throw new BadRequestException('Storage quota exceeded');
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const sanitizedFileName = file.originalname.replace(
      /[^a-zA-Z0-9.-]/g,
      '_',
    );
    const fileName = `${timestamp}-${randomStr}-${sanitizedFileName}`;
    const filePath = `inventory/${branch.branchId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('inventory-images')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('inventory-images').getPublicUrl(filePath);

    const { error: quotaError } = await supabase
      .from('branches')
      .update({
        storage_used_bytes: branchData.storageUsedBytes + file.size,
      })
      .eq('id', branch.branchId);

    if (quotaError) {
      await supabase.storage.from('inventory-images').remove([filePath]);
      throw new BadRequestException('Failed to update storage quota');
    }

    return { data: { imageUrl: publicUrl } };
  }

  @Put('stock/:stockId')
  async updateStockQuantity(
    @Param('stockId') stockId: string,
    @Body() body: UpdateStockQuantityDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: StockEntryDto }> {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'inventory');
    const stock = await this.uniformsService.updateStockQuantity(
      stockId,
      body.quantity,
      branch.branchId,
    );
    return { data: stock };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateUniformItemDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: UniformItemDto }> {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'inventory');
    const item = await this.uniformsService.update(
      id,
      input,
      branch.branchId,
    );
    return { data: item };
  }

  @Post(':id/stock')
  async addOrUpdateStock(
    @Param('id') itemId: string,
    @Body() input: AddOrUpdateStockDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: StockEntryDto }> {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'inventory');
    const stock = await this.uniformsService.addOrUpdateStock(
      itemId,
      input,
      branch.branchId,
    );
    return { data: stock };
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'inventory');
    await this.uniformsService.delete(id, branch.branchId);
  }
}
