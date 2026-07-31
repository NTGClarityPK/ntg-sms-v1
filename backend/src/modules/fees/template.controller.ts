import {
  Body,
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
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { TemplateService } from './template.service';
import { CreateFeeTemplateDto } from './dto/create-fee-template.dto';
import { UpdateFeeTemplateDto } from './dto/update-fee-template.dto';
import { CreateFeeTemplateAssignmentDto } from './dto/create-fee-template-assignment.dto';
import { FeeTemplateDto } from './dto/fee-template.dto';
import { FeatureAccessGuard, RequiresFeature } from '../subscription/guards/feature-access.guard';

@ApiTags('Fees')
@Controller('api/v1/fees/templates')
@UseGuards(JwtAuthGuard, BranchGuard, FeatureAccessGuard)
@RequiresFeature('hasFeeManagement')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  private ensureFeesAdmin(user: CurrentUserPayload): void {
    const roles = user.roles ?? [];
    if (roles.includes('school_admin') || roles.includes('principal')) return;
    throw new ForbiddenException('Only school admin can manage fee templates');
  }

  @Post()
  async create(
    @Body() dto: CreateFeeTemplateDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: FeeTemplateDto }> {
    this.ensureFeesAdmin(user);
    return this.templateService.create(dto, branch.branchId);
  }

  @Get()
  async list(
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('scope') scope?: string,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
  ): Promise<{ data: FeeTemplateDto[] }> {
    return this.templateService.list(branch.branchId, { scope, type, isActive });
  }

  @Get(':id')
  async getOne(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: FeeTemplateDto }> {
    return this.templateService.getById(id, branch.branchId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFeeTemplateDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: FeeTemplateDto }> {
    this.ensureFeesAdmin(user);
    return this.templateService.update(id, dto, branch.branchId);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { success: boolean } }> {
    this.ensureFeesAdmin(user);
    return this.templateService.remove(id, branch.branchId);
  }

  @Post(':templateId/assignments')
  async createAssignment(
    @Param('templateId') templateId: string,
    @Body() dto: CreateFeeTemplateAssignmentDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { id: string } }> {
    this.ensureFeesAdmin(user);
    return this.templateService.createAssignment(templateId, dto, branch.branchId);
  }
}

