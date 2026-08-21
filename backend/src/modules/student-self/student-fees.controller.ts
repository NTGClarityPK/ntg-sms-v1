import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentJwtGuard } from '../../common/guards/student-jwt.guard';
import { CurrentStudent, type CurrentStudentPayload } from '../../common/decorators/current-student.decorator';
import { ChallanService } from '../fees/challan.service';
import { PaymentService } from '../fees/payment.service';
import { CreateFeePaymentDto } from '../fees/dto/create-fee-payment.dto';

type UploadedFileType = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5MB

@ApiTags('Student self-service')
@Controller('api/v1/student/fees')
@UseGuards(StudentJwtGuard)
export class StudentFeesController {
  constructor(
    private readonly challanService: ChallanService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get('challans')
  async myChallans(@CurrentStudent() student: CurrentStudentPayload) {
    return this.challanService.listStudentPending(student.id, student.branchId);
  }

  @Get('challans/:id/pdf')
  async ensureChallanPdf(
    @Param('id') id: string,
    @CurrentStudent() student: CurrentStudentPayload,
  ): Promise<{ data: { pdfUrl: string } }> {
    return this.challanService.ensureChallanPdfForStudent(id, student.id, student.branchId);
  }

  @Get('payments')
  async myPayments(@CurrentStudent() student: CurrentStudentPayload) {
    return this.paymentService.listStudentPayments(student.id, student.branchId);
  }

  @Post('payments')
  @UseInterceptors(
    FileInterceptor('proof_document', { limits: { fileSize: MAX_PROOF_BYTES } }),
  )
  async submitPayment(
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
    @CurrentStudent() student: CurrentStudentPayload,
  ): Promise<{ data: { id: string } }> {
    return this.paymentService.createPaymentWithProofForStudent({
      challanId: body.challanId,
      amountPaid: body.amountPaid,
      paymentDate: body.paymentDate,
      paymentMethod: body.paymentMethod,
      transactionReference: body.transactionReference,
      bankName: body.bankName,
      proof,
      studentId: student.id,
      branchId: student.branchId,
    });
  }
}
