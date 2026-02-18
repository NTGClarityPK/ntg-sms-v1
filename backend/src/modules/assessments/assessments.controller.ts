import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
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
import { AssessmentsService } from './assessments.service';
import { AssessmentDto } from './dto/assessment.dto';
import { QueryAssessmentsDto } from './dto/query-assessments.dto';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { AssessmentStatisticsDto } from './dto/assessment-statistics.dto';
import { ClassStatisticsDto } from './dto/class-statistics.dto';
import { SubjectStatisticsDto } from './dto/subject-statistics.dto';
import { StudentPerformanceDto } from './dto/student-performance.dto';
import { AssessmentAttachmentDto } from './dto/assessment-attachment.dto';
import { CreateAssessmentAttachmentDto } from './dto/create-assessment-attachment.dto';
import { StudentAssessmentStatusDto } from './dto/student-assessment-status.dto';
import { AssessmentStudentStatusDto } from './dto/assessment-student-status.dto';
import { UpdateStudentAssessmentStatusDto } from './dto/update-student-assessment-status.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BranchesService } from '../branches/branches.service';

type UploadedFileType = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/assessments')
export class AssessmentsController {
  constructor(
    private readonly assessmentsService: AssessmentsService,
    private readonly supabaseConfig: SupabaseConfig,
    private readonly branchesService: BranchesService,
  ) {}

  private async ensureAssessmentEditAccess(
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
      .eq('code', 'assessment')
      .maybeSingle();
    if (featureError || !featureData) {
      throw new ForbiddenException('Assessment permission feature not configured');
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);

    if (permissionError) {
      throw new ForbiddenException('Unable to verify assessment edit permissions');
    }

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );

    if (!canEdit) {
      throw new ForbiddenException('You do not have edit access to Assessment');
    }
  }

  @Get()
  async listAssessments(
    @Query() query: QueryAssessmentsDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{
    data: AssessmentDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.assessmentsService.listAssessments(
      query,
      branch.branchId,
      undefined,
      user.id,
    );
  }

  @Post()
  async createAssessment(
    @Body() body: CreateAssessmentDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: AssessmentDto }> {
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    const created = await this.assessmentsService.createAssessment(
      body,
      branch.branchId,
      branch.tenantId,
      user.id,
      user.email,
    );
    return { data: created };
  }

  /**
   * Upload a file to a draft (create-assessment flow). Compresses images and videos, stores under draft. Total checked on Create.
   */
  @Post('draft/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDraftFile(
    @Body('draftId') draftId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|webp|txt|mp4|webm|mov|avi|mkv)$/i,
        })
        .addMaxSizeValidator({ maxSize: 50 * 1024 * 1024 }) // allow larger input; compression may reduce
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
      draftFileId: string;
      totalSizeBytes: number;
    };
  }> {
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    if (!draftId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(draftId)) {
      throw new BadRequestException('Valid draftId is required');
    }
    const result = await this.assessmentsService.uploadDraftFile(
      draftId,
      branch.branchId,
      user.id,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
    );
    return { data: result };
  }

  /**
   * Remove a file from a draft
   */
  @Delete('draft/:draftId/files/:fileId')
  async deleteDraftFile(
    @Param('draftId') draftId: string,
    @Param('fileId') fileId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { ok: boolean } }> {
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    await this.assessmentsService.deleteDraftFile(draftId, fileId, branch.branchId, user.id);
    return { data: { ok: true } };
  }

  /**
   * Compress one draft file (image/video). Used when teacher presses Create Assessment to compress all materials with progress.
   */
  @Post('draft/:draftId/files/:fileId/compress')
  async compressDraftFile(
    @Param('draftId') draftId: string,
    @Param('fileId') fileId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { fileSizeBytes: number } }> {
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    const result = await this.assessmentsService.compressDraftFile(
      draftId,
      fileId,
      branch.branchId,
      user.id,
    );
    return { data: result };
  }

  @Put(':id')
  async updateAssessment(
    @Param('id') id: string,
    @Body() body: UpdateAssessmentDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: AssessmentDto }> {
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    const updated = await this.assessmentsService.updateAssessment(
      id,
      body,
      branch.branchId,
      user.id,
      user.email,
    );
    return { data: updated };
  }

  @Delete(':id')
  async deleteAssessment(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { id: string } }> {
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    const result = await this.assessmentsService.deleteAssessment(
      id,
      branch.branchId,
      user.email,
    );
    return { data: result };
  }

  @Post(':id/publish')
  async publishAssessment(
    @Param('id') id: string,
    @Body() body: { publishDate?: string },
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: AssessmentDto }> {
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    const result = await this.assessmentsService.publishAssessment(
      id,
      branch.branchId,
      body.publishDate,
    );
    return { data: result };
  }

  /**
   * Get assessments for the current student (My Assessments)
   */
  @Get('my')
  async getMyAssessments(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    data: Array<{
      assessment: AssessmentDto;
      status?: StudentAssessmentStatusDto;
      attachments: AssessmentAttachmentDto[];
    }>;
  }> {
    const result = await this.assessmentsService.getMyAssessmentsForCurrentStudent(
      user.id,
      branch.branchId,
    );

    // Map attachments to DTOs for consistent typing
    const mapped = result.map((item) => ({
      assessment: item.assessment,
      status: item.status,
      attachments: item.attachments.map(
        (att) =>
          new AssessmentAttachmentDto({
            id: att.id,
            assessmentId: item.assessment.id,
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            mimeType: att.mimeType,
            createdAt: att.createdAt,
          } as any),
      ),
    }));

    return { data: mapped };
  }

  /**
   * Update current student's status for an assessment
   */
  @Post(':id/my-status')
  async updateMyAssessmentStatus(
    @Param('id') id: string,
    @Body() body: UpdateStudentAssessmentStatusDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: StudentAssessmentStatusDto }> {
    const status = await this.assessmentsService.updateMyAssessmentStatus(
      id,
      user.id,
      branch.branchId,
      body,
    );
    return { data: status };
  }

  /**
   * Get statistics for a specific assessment
   */
  @Get(':id/statistics')
  async getAssessmentStatistics(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AssessmentStatisticsDto }> {
    const stats = await this.assessmentsService.getAssessmentStatistics(id, branch.branchId);
    return { data: stats };
  }

  /**
   * Get per-student assessment status for statistics view
   */
  @Get(':id/student-status')
  async getAssessmentStudentStatus(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AssessmentStudentStatusDto[] }> {
    const statuses = await this.assessmentsService.getAssessmentStudentStatuses(
      id,
      branch.branchId,
    );
    return { data: statuses };
  }

  /**
   * Get statistics for a class section
   */
  @Get('class/:classSectionId/statistics')
  async getClassStatistics(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: ClassStatisticsDto }> {
    const stats = await this.assessmentsService.getClassStatistics(classSectionId, branch.branchId);
    return { data: stats };
  }

  /**
   * Get statistics for a subject
   */
  @Get('subject/:subjectId/statistics')
  async getSubjectStatistics(
    @Param('subjectId') subjectId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: SubjectStatisticsDto }> {
    const stats = await this.assessmentsService.getSubjectStatistics(subjectId, branch.branchId);
    return { data: stats };
  }

  /**
   * Get performance summary for a specific student
   */
  @Get('student/:studentId/performance')
  async getStudentPerformance(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: StudentPerformanceDto }> {
    const performance = await this.assessmentsService.getStudentPerformance(studentId, branch.branchId);
    return { data: performance };
  }

  /**
   * Get attachments for an assessment
   */
  @Get(':id/attachments')
  async getAssessmentAttachments(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AssessmentAttachmentDto[] }> {
    const attachments = await this.assessmentsService.getAssessmentAttachments(id, branch.branchId);
    return { data: attachments };
  }

  /**
   * Create an attachment for an assessment
   */
  @Post(':id/attachments')
  async createAssessmentAttachment(
    @Param('id') id: string,
    @Body() body: Omit<CreateAssessmentAttachmentDto, 'assessmentId'>,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: AssessmentAttachmentDto }> {
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    const dto: CreateAssessmentAttachmentDto = {
      ...body,
      assessmentId: id,
    };
    const attachment = await this.assessmentsService.createAssessmentAttachment(
      dto,
      branch.branchId,
      user.email,
    );
    return { data: attachment };
  }

  /**
   * Upload a file for an assessment (images/videos compressed). Total materials limit 10MB (post-compression).
   */
  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAssessmentFile(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|webp|txt|mp4|webm|mov|avi|mkv)$/i,
        })
        .addMaxSizeValidator({ maxSize: 50 * 1024 * 1024 }) // allow larger input; compression may reduce
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    file: UploadedFileType,
  ): Promise<{
    data: { fileUrl: string; fileName: string; fileSizeBytes: number; mimeType: string };
  }> {
    await this.ensureAssessmentEditAccess(user, branch.branchId);

    const MATERIALS_LIMIT_BYTES = 10 * 1024 * 1024;
    const existingTotal = await this.assessmentsService.getAssessmentAttachmentsTotalSizeBytes(
      id,
      branch.branchId,
    );

    const supabase = this.supabaseConfig.getClient();
    const branchData = await this.branchesService.getById(branch.branchId);
    const quotaBytes = branchData.storageQuotaGb * 1024 * 1024 * 1024;

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${randomStr}-${sanitized}`;
    const filePath = `assessments/${id}/${fileName}`;

    let processedBuffer = file.buffer;
    let finalSize = file.size;
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname);
    const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(file.originalname);

    if (isImage) {
      try {
        const sharp = await import('sharp');
        const pipeline = sharp.default(file.buffer).resize(1920, null, {
          withoutEnlargement: true,
        });
        const ext = (file.originalname.split('.').pop() || '').toLowerCase();
        if (ext === 'png') {
          processedBuffer = await pipeline.png({ compressionLevel: 6 }).toBuffer();
        } else if (ext === 'webp') {
          processedBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
        } else if (ext === 'gif') {
          processedBuffer = await pipeline.gif().toBuffer();
        } else {
          processedBuffer = await pipeline.jpeg({ quality: 85 }).toBuffer();
        }
        finalSize = processedBuffer.length;
      } catch {
        // fallback to original
      }
    } else if (isVideo) {
      const { compressVideo } = await import('./video-compression.util');
      processedBuffer = await compressVideo(file.buffer, file.mimetype, file.originalname);
      finalSize = processedBuffer.length;
    }

    if (existingTotal + finalSize > MATERIALS_LIMIT_BYTES) {
      throw new BadRequestException(
        'Total size of materials would exceed 10MB limit. Please remove some files or use smaller files.',
      );
    }
    if (branchData.storageUsedBytes + finalSize > quotaBytes) {
      throw new BadRequestException('Storage quota exceeded');
    }

    const { error: uploadError } = await supabase.storage
      .from('assessment-files')
      .upload(filePath, processedBuffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('assessment-files')
      .getPublicUrl(filePath);

    const { error: quotaError } = await supabase
      .from('branches')
      .update({
        storage_used_bytes: branchData.storageUsedBytes + finalSize,
      })
      .eq('id', branch.branchId);

    if (quotaError) {
      await supabase.storage.from('assessment-files').remove([filePath]);
      throw new BadRequestException('Failed to update storage quota');
    }

    return {
      data: {
        fileUrl: publicUrl,
        fileName: file.originalname,
        fileSizeBytes: finalSize,
        mimeType: file.mimetype,
      },
    };
  }

  /**
   * Delete an attachment
   */
  @Delete('attachments/:attachmentId')
  async deleteAssessmentAttachment(
    @Param('attachmentId') attachmentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { id: string } }> {
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    const result = await this.assessmentsService.deleteAssessmentAttachment(
      attachmentId,
      branch.branchId,
      user.email,
    );
    return { data: result };
  }

  /**
   * Get a single assessment by ID
   * NOTE: This must come AFTER all other GET routes with specific paths
   * to avoid route conflicts in NestJS
   */
  @Get(':id')
  async getAssessmentById(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AssessmentDto }> {
    const assessment = await this.assessmentsService.getAssessmentById(id, branch.branchId);
    return { data: assessment };
  }
}


