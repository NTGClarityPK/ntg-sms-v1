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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BulkImportService } from './bulk-import.service';
import { BulkStudentRowDto } from './dto/bulk-student-row.dto';
import { BulkUserRowDto } from './dto/bulk-user-row.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { STUDENT_BULK_COLUMN_DEFS } from './student-bulk-columns';

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

@ApiTags('Bulk import')
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
    @CurrentBranch() branch: CurrentBranchContext,
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
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
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
      user,
    );
  }

  @Post('students/validate')
  @ApiOperation({ summary: 'Validate edited students rows before import' })
  async validateStudents(
    @Body() body: { rows: BulkStudentRowDto[] },
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    if (!body.rows || body.rows.length === 0) {
      throw new BadRequestException('No rows to validate');
    }
    return this.bulkImportService.validateStudentsRows(body.rows, branch.branchId);
  }

  @Post('students/template')
  @ApiOperation({ summary: 'Get students import template metadata' })
  downloadTemplate() {
    return {
      data: {
        columns: STUDENT_BULK_COLUMN_DEFS.map((c) => ({
          key: c.key,
          label: c.label,
          example: c.example,
        })),
      },
    };
  }

  @Post('students/export')
  @ApiOperation({
    summary: 'Export branch students as an import-shaped Excel workbook',
  })
  async exportStudents(
    @Body() body: { academicYearId?: string },
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    return this.bulkImportService.exportStudentsForImport(
      branch.branchId,
      body?.academicYearId,
    );
  }

  @Post('students/subject-template-help')
  @ApiOperation({ summary: 'Get subject templates and linked classes (help)' })
  async subjectTemplateHelp(
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    return this.bulkImportService.getSubjectTemplateHelp(branch.branchId);
  }

  @Post('users/preview')
  @ApiOperation({ summary: 'Preview users bulk import' })
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
  async previewUsersImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentBranch() branch: CurrentBranchContext,
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
    return this.bulkImportService.parseUsersFile(file, branch.branchId);
  }

  @Post('users/validate')
  @ApiOperation({ summary: 'Validate edited users rows before import' })
  async validateUsers(
    @Body() body: { rows: BulkUserRowDto[] },
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    if (!body.rows || body.rows.length === 0) {
      throw new BadRequestException('No rows to validate');
    }
    return this.bulkImportService.validateUsersRows(body.rows, branch.branchId);
  }

  @Post('users/import')
  @ApiOperation({ summary: 'Execute users bulk import' })
  async importUsers(
    @Body() body: { rows: BulkUserRowDto[] },
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!body.rows || body.rows.length === 0) {
      throw new BadRequestException('No rows to import');
    }
    return this.bulkImportService.importUsers(
      body.rows,
      branch.branchId,
      user,
      branch.tenantId,
    );
  }

  @Post('users/template')
  @ApiOperation({ summary: 'Get users import template metadata' })
  downloadUsersTemplate() {
    return {
      data: {
        columns: [
          {
            key: 'full_name',
            label: 'Full Name',
            example: 'Sara Ahmed',
          },
          {
            key: 'roles',
            label: 'Roles',
            example: 'Subject Teacher',
          },
          {
            key: 'username',
            label: 'Username (staff)',
            example: 'sara.ahmed',
          },
          {
            key: 'invitation_email',
            label: 'Invitation Email (staff, optional)',
            example: 'sara.personal@example.com',
          },
          {
            key: 'email',
            label: 'Email (parent)',
            example: 'parent@example.com',
          },
          {
            key: 'phone',
            label: 'Phone (optional)',
            example: '+9647701234567',
          },
          {
            key: 'gender',
            label: 'Gender (optional)',
            example: 'female',
          },
          {
            key: 'date_of_birth',
            label: 'Date of Birth (optional)',
            example: '1990-05-15',
          },
          {
            key: 'address',
            label: 'Address (optional)',
            example: 'Baghdad',
          },
        ],
      },
    };
  }
}
