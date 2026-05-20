import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { FeeCalculationService } from './fee-calculation.service';
import { FeeStudentTemplatesResponseDto } from './dto/fee-student-templates.dto';
import { FeeChallanPreviewDto } from './dto/fee-challan-preview.dto';
import { FeatureAccessGuard, RequiresFeature } from '../subscription/guards/feature-access.guard';

@ApiTags('Fees')
@Controller('api/v1/fees/students')
@UseGuards(JwtAuthGuard, BranchGuard, FeatureAccessGuard)
@RequiresFeature('hasFeeManagement')
export class FeeStudentsController {
  constructor(private readonly feeCalculationService: FeeCalculationService) {}

  @Get(':studentId/templates')
  async getStudentTemplates(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('month') month?: string,
  ): Promise<{ data: FeeStudentTemplatesResponseDto }> {
    return this.feeCalculationService.getStudentTemplates(studentId, branch.branchId, month);
  }

  @Post(':studentId/challan-preview')
  async getStudentChallanPreview(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @Body() body: FeeChallanPreviewDto,
  ) {
    return this.feeCalculationService.getChallanPreview(studentId, branch.branchId, body);
  }
}

