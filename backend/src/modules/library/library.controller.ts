import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  HttpStatus,
  ParseFilePipeBuilder,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
import { LibraryService } from './library.service';
import { LibraryItemDto } from './dto/library-item.dto';
import { QueryLibraryItemsDto } from './dto/query-library-items.dto';
import { CreateLibraryItemDto } from './dto/create-library-item.dto';
import { UpdateLibraryItemDto } from './dto/update-library-item.dto';
import { BranchesService } from '../branches/branches.service';
import { StorageService } from '../storage/storage.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { FeatureAccessGuard, RequiresFeature } from '../subscription/guards/feature-access.guard';

type UploadedFileType = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

// Enforce a hard limit to prevent timeouts on large uploads.
const MAX_LIBRARY_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

@ApiTags('Library')
@UseGuards(JwtAuthGuard, BranchGuard, FeatureAccessGuard)
@RequiresFeature('hasLibraryManagement')
@Controller('api/v1/library')
export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly branchesService: BranchesService,
    private readonly storageService: StorageService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_LIBRARY_UPLOAD_BYTES },
    }),
  )
  async uploadFile(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(pdf|doc|docx|txt)$/i,
        })
        .addMaxSizeValidator({
          maxSize: MAX_LIBRARY_UPLOAD_BYTES,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    file: UploadedFileType,
  ): Promise<{
    data: {
      fileUrl: string;
      fileName: string;
      fileSizeBytes: number;
      mimeType: string;
      thumbnailUrl?: string;
    };
  }> {
    const supabase = this.supabaseConfig.getClient();

    // Check storage quota BEFORE upload
    const branchData = await this.branchesService.getById(branch.branchId);
    const quotaBytes = branchData.storageQuotaGb * 1024 * 1024 * 1024;
    if (branchData.storageUsedBytes + file.size > quotaBytes) {
      throw new BadRequestException('Storage quota exceeded');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${randomStr}-${sanitizedFileName}`;
    const filePath = `library/${branch.branchId}/${fileName}`;

    // Upload to Supabase Storage (library: PDFs and documents only, no image compression)
    const { error: uploadError } = await supabase.storage
      .from('library-files')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('library-files').getPublicUrl(filePath);

    // Default thumbnail for PDFs (frontend serves /book.png)
    const thumbnailUrl = /\.pdf$/i.test(file.originalname) ? '/book.png' : undefined;

    // Update storage quota atomically
    const { error: quotaError } = await supabase
      .from('branches')
      .update({
        storage_used_bytes: branchData.storageUsedBytes + file.size,
      })
      .eq('id', branch.branchId);

    if (quotaError) {
      // If quota update fails, try to delete the uploaded file
      await supabase.storage.from('library-files').remove([filePath]);
      throw new BadRequestException('Failed to update storage quota');
    }

    this.storageService.ensureStorageAlerts(branch.branchId).catch(() => {});

    return {
      data: {
        fileUrl: publicUrl,
        fileName: file.originalname,
        fileSizeBytes: file.size,
        mimeType: file.mimetype,
        thumbnailUrl,
      },
    };
  }

  @Get('categories')
  async getCategories(): Promise<{ data: string[] }> {
    return this.libraryService.getCategories();
  }

  @Get('search')
  async search(
    @Query() query: QueryLibraryItemsDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: LibraryItemDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    return this.libraryService.search(query, branch.branchId);
  }

  @Get()
  async list(
    @Query() query: QueryLibraryItemsDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: LibraryItemDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    return this.libraryService.list(query, branch.branchId);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: LibraryItemDto }> {
    const item = await this.libraryService.getById(id, branch.branchId);
    return { data: item };
  }

  @Post()
  async create(
    @Body() input: CreateLibraryItemDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: LibraryItemDto }> {
    const item = await this.libraryService.create(
      input,
      branch.branchId,
      user.id,
      user.email,
      input.fileSizeBytes,
      input.mimeType,
    );
    return { data: item };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateLibraryItemDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: LibraryItemDto }> {
    const item = await this.libraryService.update(
      id,
      input,
      branch.branchId,
      user.email,
    );
    return { data: item };
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.libraryService.delete(id, branch.branchId, user.email);
  }

  @Post(':id/view')
  async incrementViewCount(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<void> {
    await this.libraryService.incrementViewCount(id, branch.branchId);
  }

  @Post(':id/download')
  async incrementDownloadCount(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: { url: string } }> {
    const item = await this.libraryService.getById(id, branch.branchId);
    await this.libraryService.incrementDownloadCount(id, branch.branchId);
    return { data: { url: item.fileUrl } };
  }
}
