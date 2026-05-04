import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StorageService } from './storage.service';
import { QueryStorageFilesDto } from './dto/query-storage-files.dto';
import { QueryStorageAlertsDto } from './dto/query-storage-alerts.dto';

@ApiTags('Storage')
@Controller('api/v1/storage')
@UseGuards(JwtAuthGuard, BranchGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  private ensureStorageAdmin(user: { roles?: string[] }): void {
    const roles = user.roles ?? [];
    const allowed =
      roles.includes('school_admin') ||
      roles.includes('principal') ||
      roles.includes('super_admin');
    if (!allowed) {
      throw new ForbiddenException('Only school admin or principal can manage storage');
    }
  }

  @Get()
  async getOverview(
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: { quotaGb: number; usedBytes: number; usedPercentage: number } }> {
    const data = await this.storageService.getOverview(branch.branchId);
    return { data };
  }

  @Get('breakdown')
  async getBreakdown(
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    data: { categories: { category: string; bytesUsed: number; fileCount: number }[]; totalBytes: number; totalFiles: number };
  }> {
    const data = await this.storageService.getBreakdown(branch.branchId);
    return { data };
  }

  @Post('breakdown/refresh')
  async refreshBreakdown(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { roles?: string[] },
  ): Promise<{
    data: { categories: { category: string; bytesUsed: number; fileCount: number }[]; totalBytes: number; totalFiles: number };
  }> {
    this.ensureStorageAdmin(user);
    const data = await this.storageService.refreshBreakdown(branch.branchId);
    return { data };
  }

  @Get('files')
  async getFiles(
    @CurrentBranch() branch: CurrentBranchContext,
    @Query() query: QueryStorageFilesDto,
  ): Promise<{ data: { id: string; source: string; fileName: string; fileUrl: string | null; fileSizeBytes: number; mimeType?: string | null; createdAt?: string | null }[] }> {
    const data = await this.storageService.getFiles(branch.branchId, query);
    return { data };
  }

  @Delete('files/:id')
  async deleteFile(
    @Param('id') id: string,
    @Query('source') source: 'library' | 'assessment' | 'uniform',
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; email?: string; roles?: string[] },
  ): Promise<{ data: { success: boolean } }> {
    this.ensureStorageAdmin(user);
    if (!source || !['library', 'assessment', 'uniform'].includes(source)) {
      throw new ForbiddenException('Query param source is required and must be library, assessment, or uniform');
    }
    await this.storageService.deleteFile(branch.branchId, source, id, user.email ?? '');
    return { data: { success: true } };
  }

  @Get('alerts')
  async getAlerts(
    @CurrentBranch() branch: CurrentBranchContext,
    @Query() query: QueryStorageAlertsDto,
  ): Promise<{ data: { id: string; branchId: string; alertType: string; percentageUsed: number; acknowledged: boolean; acknowledgedBy?: string | null; acknowledgedAt?: string | null; createdAt: string }[] }> {
    const data = await this.storageService.getAlerts(branch.branchId, query);
    return { data };
  }

  @Put('alerts/:id/acknowledge')
  async acknowledgeAlert(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
  ): Promise<{ data: { id: string; branchId: string; alertType: string; percentageUsed: number; acknowledged: boolean; acknowledgedBy?: string | null; acknowledgedAt?: string | null; createdAt: string } }> {
    this.ensureStorageAdmin(user);
    const data = await this.storageService.acknowledgeAlert(branch.branchId, id, user.id);
    return { data };
  }
}
