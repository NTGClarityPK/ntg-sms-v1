import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Post,
  Put,
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
import {
  CurrentBranch,
  type CurrentBranchContext,
} from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { PaymentService } from './payment.service';
import { CreateFeePaymentDto } from './dto/create-fee-payment.dto';
import {
  RejectFeePaymentDto,
  VerifyFeePaymentDto,
} from './dto/verify-reject-payment.dto';

type UploadedFileType = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5MB

@ApiTags('Fees')
@Controller('api/v1/fees/payments')
@UseGuards(JwtAuthGuard, BranchGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  private ensureFeesAdmin(user: CurrentUserPayload): void {
    const roles = user.roles ?? [];
    if (
      roles.includes('school_admin') ||
      roles.includes('super_admin') ||
      roles.includes('principal')
    ) {
      return;
    }
    throw new ForbiddenException('Only school admin can verify payments');
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('proof_document', { limits: { fileSize: MAX_PROOF_BYTES } }),
  )
  async create(
    @Body() body: CreateFeePaymentDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(pdf|jpg|jpeg|png)$/i })
        .addMaxSizeValidator({ maxSize: MAX_PROOF_BYTES })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    proof: UploadedFileType,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { id: string } }> {
    return this.paymentService.createPaymentWithProof({
      challanId: body.challanId,
      amountPaid: body.amountPaid,
      paymentDate: body.paymentDate,
      paymentMethod: body.paymentMethod,
      transactionReference: body.transactionReference,
      bankName: body.bankName,
      proof,
      parentUserId: user.id,
      branchId: branch.branchId,
    });
  }

  @Get('pending-verifications')
  async pending(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureFeesAdmin(user);
    return this.paymentService.listPendingVerifications(branch.branchId);
  }

  @Get('history')
  async history(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.ensureFeesAdmin(user);
    return this.paymentService.listHistory(
      {
        classId,
        sectionId,
        status,
        startDate,
        endDate,
        search,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      },
      branch.branchId,
    );
  }

  @Get('export')
  async exportHistory(
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ): Promise<void> {
    this.ensureFeesAdmin(user);
    const buffer = await this.paymentService.exportHistoryExcel(
      {
        classId,
        sectionId,
        status,
        startDate,
        endDate,
        search,
      },
      branch.branchId,
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="fee-payments-history.xlsx"`);
    res.send(buffer);
  }

  @Get('my-students')
  async myStudents(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.paymentService.listMyStudentsPayments(user.id, branch.branchId);
  }

  @Post(':id/regenerate-receipt')
  async regenerateReceipt(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureFeesAdmin(user);
    return this.paymentService.regenerateReceipt({
      paymentId: id,
      branchId: branch.branchId,
    });
  }

  @Get(':id')
  async getOne(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureFeesAdmin(user);
    return this.paymentService.getPaymentForReview(id, branch.branchId);
  }

  @Put(':id/verify')
  async verify(
    @Param('id') id: string,
    @Body() body: VerifyFeePaymentDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureFeesAdmin(user);
    return this.paymentService.verifyPayment({
      paymentId: id,
      adminUserId: user.id,
      adminNotes: body.adminNotes,
      branchId: branch.branchId,
    });
  }

  @Put(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: RejectFeePaymentDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureFeesAdmin(user);
    return this.paymentService.rejectPayment({
      paymentId: id,
      reason: body.reason,
      branchId: branch.branchId,
    });
  }
}

