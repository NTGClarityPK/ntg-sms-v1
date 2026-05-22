import {
  Body,
  Controller,
  BadRequestException,
  ForbiddenException,
  Get,
  Param,
  ParseFilePipeBuilder,
  Post,
  Patch,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { IdCardsService } from './id-cards.service';
import { TemplatesService } from './templates.service';
import { IdCardPhotoService } from './id-card-photo.service';
import { QueryIdCardsDto } from './dto/query-id-cards.dto';
import { GenerateIdCardsDto } from './dto/generate-id-cards.dto';
import { UpdateIdCardStatusDto } from './dto/update-id-card-status.dto';
import { UploadIdCardPhotoDto } from './dto/upload-id-card-photo.dto';
import { ReprintIdCardDto } from './dto/reprint-id-card.dto';
import { BulkIdCardsPdfDto, EnqueueIdCardGenerationJobDto } from './dto/bulk-id-cards.dto';
import type { IdCardPersonType } from './types/id-card-person-type';
import { IdCardDesignService } from './id-card-design.service';

type UploadedPhotoFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@ApiTags('ID Cards')
@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/id-cards')
export class IdCardsController {
  constructor(
    private readonly idCardsService: IdCardsService,
    private readonly templatesService: TemplatesService,
    private readonly idCardPhotoService: IdCardPhotoService,
    private readonly idCardDesignService: IdCardDesignService,
  ) {}

  private ensureAdminAccess(user: CurrentUserPayload, branchId: string): void {
    const roles = (user.roles || []).map((r) => r.toLowerCase());
    if (
      roles.includes('school_admin') ||
      roles.includes('super_admin') ||
      roles.includes('principal')
    ) {
      return;
    }
    throw new ForbiddenException('Insufficient permissions for ID card management');
  }

  @Get('stats')
  async stats(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    return this.idCardsService.getStats(branch.branchId);
  }

  @Get('analytics')
  async analytics(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    return this.idCardsService.getAnalytics(branch.branchId);
  }

  @Get('templates')
  async listTemplates(
    @Query('roleType') roleType: string | undefined,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    return this.templatesService.listTemplates(
      branch.branchId,
      roleType as IdCardPersonType | undefined,
    );
  }

  @Get('design-preview')
  async designPreview(
    @Query('variant') variant: string | undefined,
    @Query('personType') personType: IdCardPersonType | undefined,
    @Query('personId') personId: string | undefined,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    const parsed = this.idCardDesignService.parseVariant(variant);
    return this.idCardsService.getDesignPreviewHtml(
      branch.branchId,
      parsed,
      personType ?? 'student',
      personId,
    );
  }

  @Get('class-section/:classSectionId/student-recipients')
  async classSectionStudentRecipients(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    return this.idCardsService.getClassSectionStudentRecipients(
      branch.branchId,
      classSectionId,
    );
  }

  @Get('card-data/:personType/:personId')
  async cardData(
    @Param('personType') personType: IdCardPersonType,
    @Param('personId') personId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    return this.idCardsService.getCardData(personType, personId, branch.branchId);
  }

  @Get('verify/:cardNumber')
  async verify(
    @Param('cardNumber') cardNumber: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    return this.idCardsService.verifyCard(cardNumber, branch.branchId);
  }

  @Post('photos')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @Body() body: UploadIdCardPhotoDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: UploadedPhotoFile,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    let personId = body.personId;
    if (file.originalname) {
      const matched = await this.idCardPhotoService.matchPersonByFilename(
        branch.branchId,
        body.personType,
        file.originalname,
      );
      if (matched) personId = matched;
    }
    if (!personId) {
      throw new BadRequestException('Could not match photo to a person. Name files by roll or employee ID.');
    }
    return this.idCardPhotoService.processAndUpload(branch.branchId, body.personType, personId, file);
  }

  @Post('generate')
  async generate(
    @Body() body: GenerateIdCardsDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    return this.idCardsService.generate(body, branch.branchId, user.id);
  }

  @Post('generation-jobs')
  async enqueueJob(
    @Body() body: EnqueueIdCardGenerationJobDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    return this.idCardsService.enqueueGenerationJob(body, branch.branchId, user.id);
  }

  @Get('generation-jobs/:jobId')
  async getJob(
    @Param('jobId') jobId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    return this.idCardsService.getGenerationJob(jobId, branch.branchId);
  }

  @Post('bulk-pdf')
  async bulkPdf(
    @Body() body: BulkIdCardsPdfDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    const archive = await this.idCardsService.getBulkPdfArchive(
      body.cardIds,
      branch.branchId,
      body.layout ?? 'single',
      body.designVariant,
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="id-cards.zip"');
    archive.pipe(res);
  }

  @Patch('status')
  async updateStatus(
    @Body() body: UpdateIdCardStatusDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    if (!body.cardIds?.length) throw new ForbiddenException('cardIds required');
    return this.idCardsService.updateStatus(branch.branchId, body.status, body.cardIds);
  }

  @Get()
  async list(
    @Query() query: QueryIdCardsDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    return this.idCardsService.list(branch.branchId, query);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @Query('side') side: 'front' | 'back' | 'both' | undefined,
    @Query('designVariant') designVariant: string | undefined,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    const buffer = await this.idCardsService.getCardPdfBuffer(
      id,
      branch.branchId,
      side ?? 'both',
      designVariant,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="id-card-${id}.pdf"`);
    res.send(buffer);
  }

  @Post(':id/reprint')
  async reprint(
    @Param('id') id: string,
    @Body() body: ReprintIdCardDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    return this.idCardsService.requestReprint(
      id,
      branch.branchId,
      user.id,
      body.reason,
      body.feeCharged,
    );
  }

  @Get(':id')
  async getOne(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureAdminAccess(user, branch.branchId);
    return this.idCardsService.getById(id, branch.branchId);
  }
}
