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
import { SupabaseConfig } from '../../common/config/supabase.config';

type UploadedFileType = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/library')
export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly branchesService: BranchesService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(pdf|jpg|jpeg|png|webp|doc|docx|txt)$/i,
        })
        .addMaxSizeValidator({
          maxSize: 100 * 1024 * 1024, // 100MB
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
    const fileExtension = file.originalname.split('.').pop() || '';
    const fileName = `${timestamp}-${randomStr}-${sanitizedFileName}`;
    const filePath = `library/${branch.branchId}/${fileName}`;

    // TODO: Image compression using sharp (when installed)
    // For images (jpg, png, webp), compress to max 1920px width, 85% quality
    let processedBuffer = file.buffer;
    let finalFileSize = file.size;
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(file.originalname);
    
    if (isImage) {
      // Placeholder for compression - will be implemented when sharp is installed
      // const sharp = require('sharp');
      // processedBuffer = await sharp(file.buffer)
      //   .resize(1920, null, { withoutEnlargement: true })
      //   .jpeg({ quality: 85 })
      //   .toBuffer();
      // finalFileSize = processedBuffer.length;
    }

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('library-files')
      .upload(filePath, processedBuffer, {
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

    // Set thumbnail URL
    let thumbnailUrl: string | undefined;
    if (/\.pdf$/i.test(file.originalname)) {
      // Use default book.png thumbnail for PDFs (stored locally in public folder)
      // Frontend serves it from /book.png
      thumbnailUrl = '/book.png';
    } else if (isImage) {
      // For images, use the image itself as thumbnail
      thumbnailUrl = publicUrl;
    }

    // Update storage quota atomically
    const { error: quotaError } = await supabase
      .from('branches')
      .update({
        storage_used_bytes: branchData.storageUsedBytes + finalFileSize,
      })
      .eq('id', branch.branchId);

    if (quotaError) {
      // If quota update fails, try to delete the uploaded file
      await supabase.storage.from('library-files').remove([filePath]);
      throw new BadRequestException('Failed to update storage quota');
    }

    return {
      data: {
        fileUrl: publicUrl,
        fileName: file.originalname,
        fileSizeBytes: finalFileSize,
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
