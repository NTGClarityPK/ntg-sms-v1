import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { BulkImportService } from './bulk-import.service';
import { BulkStudentRowDto } from './dto/bulk-student-row.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Controller('api/v1/bulk-import')
@UseGuards(JwtAuthGuard, BranchGuard)
@ApiBearerAuth()
export class BulkImportController {
  constructor(private readonly bulkImportService: BulkImportService) {}

  @Post('students/preview')
  @ApiOperation({ summary: 'Preview students bulk import' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async previewStudentsImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentBranch() branch: { branchId: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only Excel (.xlsx, .xls) and CSV files are allowed',
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }
    return this.bulkImportService.parseStudentsFile(file, branch.branchId);
  }

  @Post('students/import')
  @ApiOperation({ summary: 'Execute students bulk import' })
  async importStudents(
    @Body() body: { rows: BulkStudentRowDto[]; academicYearId: string },
    @CurrentBranch() branch: { branchId: string },
  ) {
    if (!body.rows || body.rows.length === 0) {
      throw new BadRequestException('No rows to import');
    }
    if (!body.academicYearId) {
      throw new BadRequestException('Academic year is required');
    }
    return this.bulkImportService.importStudents(
      body.rows,
      branch.branchId,
      body.academicYearId,
    );
  }

  @Post('students/template')
  @ApiOperation({ summary: 'Get students import template metadata' })
  downloadTemplate() {
    return {
      data: {
        columns: [
          { key: 'first_name', label: 'First Name', example: 'Ahmed' },
          { key: 'last_name', label: 'Last Name', example: 'Ali' },
          { key: 'email', label: 'Email', example: 'ahmed.ali@example.com' },
          { key: 'phone', label: 'Phone (optional)', example: '+9647701234567' },
          { key: 'date_of_birth', label: 'Date of Birth (optional)', example: '2010-05-15' },
          { key: 'gender', label: 'Gender', example: 'male' },
          {
            key: 'student_id',
            label: 'Student ID (optional, leave blank for auto e.g. 0001)',
            example: '0001',
          },
          {
            key: 'class_name_or_id',
            label: 'Class name or ID (optional)',
            example: 'Grade 1',
          },
          {
            key: 'section_name_or_id',
            label: 'Section name or ID (optional)',
            example: 'A',
          },
          {
            key: 'subject_template_name_or_id',
            label: 'Subject Template name or ID (optional)',
            example: 'Primary Curriculum',
          },
          {
            key: 'parent_name',
            label: 'Parent Name (optional)',
            example: 'Ali Ahmed',
          },
          {
            key: 'parent_email',
            label: 'Parent Email (optional)',
            example: 'parent@example.com',
          },
          {
            key: 'parent_phone',
            label: 'Parent Phone (optional)',
            example: '+9647709876543',
          },
        ],
      },
    };
  }
}
