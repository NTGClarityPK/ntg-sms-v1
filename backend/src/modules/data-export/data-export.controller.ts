import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SchoolAdminGuard } from '../subscription/guards/school-admin.guard';
import { DataExportService } from './data-export.service';
import { CreateDataExportDto } from './dto/create-data-export.dto';

@ApiTags('Data Export')
@Controller('api/v1/data-export')
@UseGuards(JwtAuthGuard, BranchGuard, SchoolAdminGuard)
export class DataExportController {
  constructor(private readonly dataExportService: DataExportService) {}

  @Get('status')
  async getStatus(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.dataExportService.getStatus(branch, user);
  }

  @Post()
  async createExport(
    @Body() body: CreateDataExportDto,
    @Res() res: Response,
    @Req() req: Request,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    const { buffer, filename } = await this.dataExportService.createExport(
      body,
      branch,
      user,
      req,
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
