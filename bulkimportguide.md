# Bulk Import Implementation Guide (SMS2)

**Feature:** Upload Excel/CSV file with student data → Preview → Import all records  
**Stack:** NestJS backend + Next.js frontend + Supabase  
**Use Cases:** Import students, staff, subjects, class sections, etc.

---

## Architecture Overview

```
User uploads Excel
     ↓
Frontend sends file to backend
     ↓
Backend parses Excel → validates rows → returns preview
     ↓
Frontend shows preview table with errors highlighted
     ↓
User clicks "Confirm Import"
     ↓
Backend batch inserts valid rows → returns results
     ↓
Frontend shows success/error summary
```

**Key Features:**
- ✅ Preview before import (user sees what will happen)
- ✅ Column mapping (flexible column names)
- ✅ Validation per row (shows which rows have errors)
- ✅ Batch insert (fast for 100-1000+ records)
- ✅ Detailed error reporting (row number + field + error message)
- ✅ Progress indicator (for large files)

---

## Database schema (this project)

Align implementation with the actual schema:

- **students**: `id`, `user_id`, `branch_id`, `student_id`, `class_id`, `section_id`, `first_name`, `last_name`, `blood_group`, `medical_notes`, `admission_date`, `academic_year_id`, `is_active`, `created_at`, `updated_at`, `created_by`, `updated_by`. Email comes from auth; phone, date_of_birth, gender live on **profiles** (profiles.id = user_id).
- **profiles**: `id`, `full_name`, `avatar_url`, `phone`, `address`, `date_of_birth`, `gender`, `is_active`, ...
- **class_sections**: `id`, `class_id`, `section_id`, `branch_id`, `academic_year_id`, ... — Students store `class_id` and `section_id` (not a single class_section_id). For bulk import you can accept `class_section_id` (UUID) and resolve it to `class_id` + `section_id` via the `class_sections` table when inserting into `students`.
- **parent_students**: `parent_user_id`, `student_id`, `relationship` ('father' | 'mother' | 'guardian'), `is_primary`, `can_approve`, ... Parents are **users** (auth + profile); linking is via this table. There is no `student_parents` table with name/email/phone — parent linking is either creating parent auth users and inserting into `parent_students`, or done later via the parent-associations flow.

---

## Phase 1: Backend (NestJS)

### 1.1 Install Dependencies

```bash
cd backend
npm install xlsx class-transformer class-validator multer @nestjs/platform-express
npm install -D @types/multer
```

**Libraries:**
- `xlsx` - Parse Excel/CSV files
- `class-transformer` - Transform plain objects to class instances
- `class-validator` - Validate DTOs
- `multer` - Handle file uploads

---

### 1.2 Create Bulk Import Module

```bash
nest g module bulk-import
nest g service bulk-import
nest g controller bulk-import
```

---

### 1.3 DTO for Bulk Import Student

**File: `backend/src/modules/bulk-import/dto/bulk-student-row.dto.ts`**

```typescript
import { IsString, IsEmail, IsOptional, IsDateString, IsEnum, IsUUID } from 'class-validator';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

export class BulkStudentRowDto {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsDateString()
  date_of_birth: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsString()
  @IsOptional()
  student_id?: string; // Optional custom ID

  /** UUID from class_sections; backend resolves to class_id + section_id for students table */
  @IsUUID()
  class_section_id: string;

  @IsOptional()
  @IsString()
  parent_email?: string;

  @IsOptional()
  @IsString()
  parent_name?: string;

  @IsOptional()
  @IsString()
  parent_phone?: string;

  // Add more fields as needed
}
```

---

### 1.4 Bulk Import Service

**File: `backend/src/modules/bulk-import/bulk-import.service.ts`**

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as XLSX from 'xlsx';
import { BulkStudentRowDto } from './dto/bulk-student-row.dto';

interface ParsedRow {
  rowNumber: number;
  data: BulkStudentRowDto;
  errors: string[];
  isValid: boolean;
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ParsedRow[];
}

interface ImportResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ row: number; message: string }>;
}

@Injectable()
export class BulkImportService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  private getClient() {
    return this.supabaseConfig.getClient();
  }

  /**
   * Parse Excel/CSV file and return preview with validation
   */
  async parseStudentsFile(file: Express.Multer.File, branchId: string): Promise<{ data: ImportPreview }> {
    const supabase = this.getClient();
    // Read file
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON (array of objects)
    const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rawData.length === 0) {
      throw new BadRequestException('File is empty');
    }

    if (rawData.length > 5000) {
      throw new BadRequestException('File exceeds maximum 5000 rows');
    }

    // Parse and validate each row
    const parsedRows: ParsedRow[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const rowNumber = i + 2; // Excel rows start at 1, +1 for header
      const rawRow = rawData[i];

      // Map column names (flexible - handles different naming)
      const mappedRow = this.mapColumnNames(rawRow);

      // Transform to DTO
      const dto = plainToInstance(BulkStudentRowDto, mappedRow);

      // Validate
      const errors = await validate(dto);

      parsedRows.push({
        rowNumber,
        data: dto,
        errors: errors.map(err => Object.values(err.constraints || {}).join(', ')),
        isValid: errors.length === 0,
      });
    }

    const validRows = parsedRows.filter(r => r.isValid).length;

    return {
      data: {
        totalRows: rawData.length,
        validRows,
        invalidRows: rawData.length - validRows,
        rows: parsedRows,
      },
    };
  }

  /**
   * Map column names from Excel to DTO field names
   * Handles variations like "First Name", "first_name", "FirstName"
   */
  private mapColumnNames(row: any): any {
    const mapped: any = {};

    // Define flexible column mappings
    const columnMap = {
      first_name: ['first_name', 'First Name', 'FirstName', 'first name', 'fname'],
      last_name: ['last_name', 'Last Name', 'LastName', 'last name', 'lname'],
      email: ['email', 'Email', 'Email Address', 'email_address'],
      phone: ['phone', 'Phone', 'Phone Number', 'phone_number', 'mobile'],
      date_of_birth: ['date_of_birth', 'Date of Birth', 'DOB', 'dob', 'birth_date'],
      gender: ['gender', 'Gender', 'sex', 'Sex'],
      student_id: ['student_id', 'Student ID', 'StudentID', 'student_number', 'id'],
      class_section_id: ['class_section_id', 'Class Section', 'Class', 'Section', 'class'],
      parent_email: ['parent_email', 'Parent Email', 'Guardian Email', 'parent email'],
      parent_name: ['parent_name', 'Parent Name', 'Guardian Name', 'parent name'],
      parent_phone: ['parent_phone', 'Parent Phone', 'Guardian Phone', 'parent phone'],
    };

    for (const [targetField, possibleNames] of Object.entries(columnMap)) {
      for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== '') {
          mapped[targetField] = row[name];
          break;
        }
      }
    }

    return mapped;
  }

  /**
   * Perform bulk insert of students
   */
  async importStudents(
    rows: BulkStudentRowDto[],
    branchId: string,
    academicYearId: string,
  ): Promise<{ data: ImportResult }> {
    const supabase = this.getClient();
    const results: ImportResult = {
      totalProcessed: rows.length,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    // Filter only valid rows (should already be filtered, but double-check)
    const validRows = rows.filter(row => row.first_name && row.last_name && row.email);

    if (validRows.length === 0) {
      throw new BadRequestException('No valid rows to import');
    }

    // Resolve class_section_id → class_id, section_id for all rows (batch lookup)
    const classSectionIds = [...new Set(validRows.map(r => r.class_section_id))];
    const { data: classSections } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id')
      .in('id', classSectionIds)
      .eq('branch_id', branchId);
    const csMap = new Map((classSections || []).map((cs: { id: string; class_id: string; section_id: string }) => [cs.id, cs]));

    // Batch insert in chunks (Supabase handles ~1000 rows well per request)
    const BATCH_SIZE = 500;

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);

      try {
        // Create auth users + profiles (like StudentsService.createStudent)
        const authResults = await this.createAuthUsersAndProfiles(supabase, batch, branchId);

        // Resolve class_id, section_id per row
        const studentRecords = batch.map((row, index) => {
          const cs = csMap.get(row.class_section_id);
          if (!cs) {
            throw new BadRequestException(`Invalid class_section_id for row: ${row.class_section_id}`);
          }
          return {
            user_id: authResults[index]?.userId,
            branch_id: branchId,
            student_id: row.student_id || this.generateStudentId(),
            first_name: row.first_name,
            last_name: row.last_name,
            class_id: cs.class_id,
            section_id: cs.section_id,
            blood_group: null,
            medical_notes: null,
            admission_date: row.date_of_birth || new Date().toISOString().slice(0, 10),
            academic_year_id: academicYearId,
            is_active: true,
            created_by: 'bulk-import',
            updated_by: 'bulk-import',
          };
        });

        // Batch insert students (no email/phone/gender on students table — those are on profiles)
        const { data, error } = await supabase
          .from('students')
          .insert(studentRecords)
          .select();

        if (error) {
          results.failureCount += batch.length;
          results.errors.push({
            row: i + 2,
            message: error.message,
          });
        } else {
          results.successCount += (data?.length ?? 0);
          // Optionally create parent users and link via parent_students (see createParentLinks)
          await this.createParentLinks(supabase, data ?? [], batch);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.failureCount += batch.length;
        results.errors.push({ row: i + 2, message });
      }
    }

    return { data: results };
  }

  /**
   * Create Supabase auth users and profiles for students (per row; auth admin is per-user).
   * Mirrors StudentsService.createStudent: auth user → profiles (phone, date_of_birth, gender) → user_branches → user_roles.
   */
  private async createAuthUsersAndProfiles(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    rows: BulkStudentRowDto[],
    branchId: string,
  ): Promise<Array<{ userId: string | null; email: string }>> {
    const results: Array<{ userId: string | null; email: string }> = [];
    const username = 'bulk-import';

    for (const row of rows) {
      try {
        const tempPassword = this.generateTempPassword();
        const { data, error } = await supabase.auth.admin.createUser({
          email: row.email,
          password: tempPassword,
          email_confirm: true,
        });

        if (error || !data?.user) {
          results.push({ userId: null, email: row.email });
          continue;
        }

        const displayName = `${row.first_name.trim()} ${row.last_name.trim()}`.trim();
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: displayName,
          phone: row.phone ?? null,
          date_of_birth: row.date_of_birth ?? null,
          gender: row.gender ?? null,
          is_active: true,
          created_by: username,
          updated_by: username,
        });

        await supabase.from('user_branches').insert({
          user_id: data.user.id,
          branch_id: branchId,
          is_primary: false,
          created_by: username,
        });

        const { data: studentRole } = await supabase.from('roles').select('id').eq('name', 'student').single();
        if (studentRole) {
          await supabase.from('user_roles').insert({
            user_id: data.user.id,
            role_id: studentRole.id,
            branch_id: branchId,
            created_by: username,
          });
        }

        results.push({ userId: data.user.id, email: row.email });
      } catch {
        results.push({ userId: null, email: row.email });
      }
    }

    return results;
  }

  /**
   * Optionally create parent auth users and link to students via parent_students.
   * Parents are users; linking is parent_user_id + student_id (relationship: father | mother | guardian).
   */
  private async createParentLinks(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    students: Array<{ id: string }>,
    rows: BulkStudentRowDto[],
  ): Promise<void> {
    const links: Array<{ parent_user_id: string; student_id: string; relationship: 'father' | 'mother' | 'guardian'; is_primary: boolean; can_approve: boolean }> = [];
    for (let i = 0; i < students.length; i++) {
      const row = rows[i];
      if (!row.parent_email?.trim()) continue;
      const parentUserId = await this.findOrCreateParentUser(supabase, row);
      if (parentUserId) {
        links.push({
          parent_user_id: parentUserId,
          student_id: students[i].id,
          relationship: 'guardian',
          is_primary: true,
          can_approve: true,
        });
      }
    }
    if (links.length > 0) {
      await supabase.from('parent_students').insert(links);
    }
  }

  /** Create parent auth user + profile; if email already exists, return null (link can be done later via parent-associations). */
  private async findOrCreateParentUser(
    supabase: ReturnType<SupabaseConfig['getClient']>,
    row: BulkStudentRowDto,
  ): Promise<string | null> {
    const tempPassword = this.generateTempPassword();
    const { data, error } = await supabase.auth.admin.createUser({
      email: row.parent_email!,
      password: tempPassword,
      email_confirm: true,
    });
    if (error || !data?.user) return null;
    await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: row.parent_name ?? 'Parent',
      created_by: 'bulk-import',
      updated_by: 'bulk-import',
    });
    return data.user.id;
  }

  /**
   * Generate student ID (customize format as needed)
   */
  private generateStudentId(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `STU-${year}-${random}`;
  }

  /**
   * Generate temporary password for new users
   */
  private generateTempPassword(): string {
    // Generate secure random password
    return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
  }
}
```

---

### 1.5 Controller Endpoints

**File: `backend/src/modules/bulk-import/bulk-import.controller.ts`**

```typescript
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
import { BulkImportService } from './bulk-import.service';
import { BulkStudentRowDto } from './dto/bulk-student-row.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';

@Controller('api/v1/bulk-import')
@UseGuards(JwtAuthGuard, BranchGuard)
@ApiBearerAuth()
export class BulkImportController {
  constructor(private readonly bulkImportService: BulkImportService) {}

  /**
   * Upload and preview students file
   * Returns parsed data with validation errors
   */
  @Post('students/preview')
  @ApiOperation({ summary: 'Preview students bulk import' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
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

    // Validate file type
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only Excel (.xlsx, .xls) and CSV files are allowed');
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    return this.bulkImportService.parseStudentsFile(file, branch.branchId);
  }

  /**
   * Confirm and perform bulk import
   */
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

    return this.bulkImportService.importStudents(body.rows, branch.branchId, body.academicYearId);
  }

  /**
   * Download sample Excel template
   */
  @Post('students/template')
  @ApiOperation({ summary: 'Download students import template' })
  downloadTemplate() {
    // Return sample template structure
    return {
      columns: [
        { key: 'first_name', label: 'First Name', example: 'Ahmed' },
        { key: 'last_name', label: 'Last Name', example: 'Ali' },
        { key: 'email', label: 'Email', example: 'ahmed.ali@example.com' },
        { key: 'phone', label: 'Phone', example: '+9647701234567' },
        { key: 'date_of_birth', label: 'Date of Birth', example: '2010-05-15' },
        { key: 'gender', label: 'Gender', example: 'male' },
        { key: 'student_id', label: 'Student ID (optional)', example: 'STU-2024-0001' },
        { key: 'class_section_id', label: 'Class Section ID', example: 'uuid-here' },
        { key: 'parent_name', label: 'Parent Name (optional)', example: 'Ali Ahmed' },
        { key: 'parent_email', label: 'Parent Email (optional)', example: 'parent@example.com' },
        { key: 'parent_phone', label: 'Parent Phone (optional)', example: '+9647709876543' },
      ],
    };
  }
}
```

---

## Phase 2: Frontend (Next.js)

### 2.1 API Service

**File: `frontend/src/lib/api/bulk-import.ts`** (or call apiClient directly from the hook; this project uses `@/lib/api-client`.)

```typescript
import { apiClient } from '@/lib/api-client';

export interface BulkImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: Array<{
    rowNumber: number;
    data: any;
    errors: string[];
    isValid: boolean;
  }>;
}

export interface BulkImportResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ row: number; message: string }>;
}

/** Shape of one row for import; can be inferred from preview.rows[].data or defined to match backend BulkStudentRowDto */
export type BulkStudentRowDto = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth: string;
  gender: string;
  student_id?: string;
  class_section_id: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
};

export const bulkImportApi = {
  /**
   * Upload file and get preview
   */
  async previewStudents(file: File): Promise<BulkImportPreview> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<BulkImportPreview>('/api/v1/bulk-import/students/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return (response as { data?: BulkImportPreview }).data ?? response;
  },

  /**
   * Confirm and execute import
   */
  async importStudents(rows: BulkStudentRowDto[], academicYearId: string): Promise<BulkImportResult> {
    const response = await apiClient.post<BulkImportResult>('/api/v1/bulk-import/students/import', {
      rows,
      academicYearId,
    });
    return (response as { data?: BulkImportResult }).data ?? response;
  },

  /**
   * Get template structure
   */
  async getTemplate() {
    const response = await apiClient.post<{ columns: Array<{ key: string; label: string; example: string }> }>('/api/v1/bulk-import/students/template');
    return (response as { data?: { columns: Array<{ key: string; label: string; example: string }> } }).data ?? response;
  },
};
```

---

### 2.2 React Hook

**File: `frontend/src/hooks/useBulkImport.ts`**

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import { bulkImportApi } from '@/lib/api/bulk-import';

export function useBulkImportPreview() {
  return useMutation({
    mutationFn: (file: File) => bulkImportApi.previewStudents(file),
  });
}

export function useBulkImport() {
  return useMutation({
    mutationFn: ({ rows, academicYearId }: { rows: any[]; academicYearId: string }) =>
      bulkImportApi.importStudents(rows, academicYearId),
  });
}

export function useBulkImportTemplate() {
  return useQuery({
    queryKey: ['bulk-import-template', 'students'],
    queryFn: () => bulkImportApi.getTemplate(),
  });
}
```

---

### 2.3 Bulk Import Page/Component

**File: `frontend/src/app/(portal)/students/bulk-import/page.tsx`** (this project uses the `(portal)` route group for the main app.)

```typescript
'use client';

import { useState } from 'react';
import {
  Button,
  FileInput,
  Alert,
  Table,
  Badge,
  Progress,
  Title,
  Text,
  Group,
  Stack,
  Paper,
  Select,
} from '@mantine/core';
import { IconUpload, IconCheck, IconX, IconAlertCircle, IconDownload } from '@tabler/icons-react';
import { useBulkImportPreview, useBulkImport, useBulkImportTemplate } from '@/hooks/useBulkImport';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';

export default function BulkImportStudentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');

  const previewMutation = useBulkImportPreview();
  const importMutation = useBulkImport();
  const { data: template } = useBulkImportTemplate();

  // Handle file upload and preview
  const handleFileUpload = async (uploadedFile: File | null) => {
    if (!uploadedFile) {
      setFile(null);
      setPreview(null);
      return;
    }

    setFile(uploadedFile);

    try {
      const result = await previewMutation.mutateAsync(uploadedFile);
      setPreview(result);

      if (result.invalidRows > 0) {
        notifications.show({
          title: 'Validation Issues',
          message: `${result.invalidRows} of ${result.totalRows} rows have errors. Please review below.`,
          color: 'yellow',
          icon: <IconAlertCircle />,
        });
      } else {
        notifications.show({
          title: 'Ready to Import',
          message: `All ${result.validRows} rows are valid and ready to import.`,
          color: 'green',
          icon: <IconCheck />,
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Upload Failed',
        message: error.response?.data?.message || 'Failed to parse file',
        color: 'red',
        icon: <IconX />,
      });
    }
  };

  // Confirm and execute import
  const handleImport = async () => {
    if (!preview || !selectedYear) {
      notifications.show({
        title: 'Missing Information',
        message: 'Please select an academic year',
        color: 'red',
      });
      return;
    }

    const validRows = preview.rows.filter((r: any) => r.isValid).map((r: any) => r.data);

    try {
      const result = await importMutation.mutateAsync({
        rows: validRows,
        academicYearId: selectedYear,
      });

      notifications.show({
        title: 'Import Complete',
        message: `Successfully imported ${result.successCount} students. ${result.failureCount} failed.`,
        color: result.failureCount === 0 ? 'green' : 'yellow',
        icon: <IconCheck />,
      });

      // Reset state
      setFile(null);
      setPreview(null);
    } catch (error: any) {
      notifications.show({
        title: 'Import Failed',
        message: error.response?.data?.message || 'Failed to import students',
        color: 'red',
        icon: <IconX />,
      });
    }
  };

  // Download template
  const handleDownloadTemplate = () => {
    if (!template) return;

    // Create sample data
    const sampleData = [
      {
        'First Name': 'Ahmed',
        'Last Name': 'Ali',
        'Email': 'ahmed.ali@example.com',
        'Phone': '+9647701234567',
        'Date of Birth': '2010-05-15',
        'Gender': 'male',
        'Student ID': 'STU-2024-0001',
        'Class Section ID': 'uuid-here',
        'Parent Name': 'Ali Ahmed',
        'Parent Email': 'parent@example.com',
        'Parent Phone': '+9647709876543',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'students-import-template.xlsx');

    notifications.show({
      title: 'Template Downloaded',
      message: 'Check your downloads folder',
      color: 'green',
      icon: <IconCheck />,
    });
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Bulk Import Students</Title>

      {/* Instructions */}
      <Alert icon={<IconAlertCircle />} title="How to use" color="blue">
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Download the template Excel file</li>
          <li>Fill in student information (required fields: First Name, Last Name, Email, DOB, Gender, Class Section ID)</li>
          <li>Upload the completed file to preview</li>
          <li>Review any errors and fix in the Excel file</li>
          <li>Re-upload and click "Import Students"</li>
        </ol>
      </Alert>

      {/* Template Download */}
      <Paper p="md" withBorder>
        <Group justify="space-between">
          <div>
            <Text fw={500}>Download Template</Text>
            <Text size="sm" c="dimmed">
              Download a sample Excel file with the correct format
            </Text>
          </div>
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={handleDownloadTemplate}
            variant="light"
          >
            Download Template
          </Button>
        </Group>
      </Paper>

      {/* File Upload */}
      <Paper p="md" withBorder>
        <Stack gap="md">
          <FileInput
            label="Upload Excel or CSV file"
            placeholder="Click to select file"
            accept=".xlsx,.xls,.csv"
            value={file}
            onChange={handleFileUpload}
            leftSection={<IconUpload size={16} />}
            disabled={previewMutation.isPending}
          />

          {previewMutation.isPending && (
            <Progress value={100} animated label="Parsing file..." />
          )}

          {preview && (
            <Select
              label="Academic Year"
              placeholder="Select academic year"
              value={selectedYear}
              onChange={(val) => setSelectedYear(val || '')}
              data={[
                { value: 'year-1', label: '2024-2025' },
                { value: 'year-2', label: '2025-2026' },
              ]}
              required
            />
          )}
        </Stack>
      </Paper>

      {/* Preview Table */}
      {preview && (
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Title order={4}>Preview</Title>
                <Text size="sm" c="dimmed">
                  {preview.validRows} valid / {preview.totalRows} total rows
                </Text>
              </div>
              <Button
                onClick={handleImport}
                disabled={preview.validRows === 0 || !selectedYear || importMutation.isPending}
                loading={importMutation.isPending}
                leftSection={<IconCheck size={16} />}
              >
                Import {preview.validRows} Students
              </Button>
            </Group>

            <div style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Row</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>First Name</Table.Th>
                    <Table.Th>Last Name</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Gender</Table.Th>
                    <Table.Th>Class Section</Table.Th>
                    <Table.Th>Errors</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {preview.rows.map((row: any) => (
                    <Table.Tr key={row.rowNumber} bg={row.isValid ? undefined : 'red.0'}>
                      <Table.Td>{row.rowNumber}</Table.Td>
                      <Table.Td>
                        <Badge color={row.isValid ? 'green' : 'red'} size="sm">
                          {row.isValid ? 'Valid' : 'Error'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{row.data.first_name}</Table.Td>
                      <Table.Td>{row.data.last_name}</Table.Td>
                      <Table.Td>{row.data.email}</Table.Td>
                      <Table.Td>{row.data.gender}</Table.Td>
                      <Table.Td>{row.data.class_section_id}</Table.Td>
                      <Table.Td>
                        {row.errors.length > 0 && (
                          <Text size="xs" c="red">
                            {row.errors.join(', ')}
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
```

---

## Phase 3: Excel Template Generation (Advanced)

### 3.1 Generate Template with Dropdowns

**Add to backend controller:** (Use `CurrentBranch()` and your Supabase config getClient(); ensure Nest returns the file via `StreamableFile` or `Res()` with proper headers.)

```typescript
import * as XLSX from 'xlsx';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';

@Get('students/template/download')
async downloadExcelTemplate(@CurrentBranch() branch: { branchId: string }, @Res() res: Response) {
  const supabase = this.supabaseConfig.getClient();
  const branchId = branch.branchId;
  // Fetch class sections for dropdown
  const { data: classSections } = await supabase
    .from('class_sections')
    .select('id, name')
    .eq('branch_id', branchId);

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Main sheet with headers
  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Date of Birth',
    'Gender',
    'Student ID',
    'Class Section ID',
    'Parent Name',
    'Parent Email',
    'Parent Phone',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers]);

  // Add sample row
  XLSX.utils.sheet_add_aoa(
    ws,
    [
      [
        'Ahmed',
        'Ali',
        'ahmed.ali@example.com',
        '+9647701234567',
        '2010-05-15',
        'male',
        'STU-2024-0001',
        classSections?.[0]?.id || 'uuid-here',
        'Ali Ahmed',
        'parent@example.com',
        '+9647709876543',
      ],
    ],
    { origin: 'A2' },
  );

  // Add class sections reference sheet
  const classSheetData = classSections?.map(cs => [cs.id, cs.name]) || [];
  const classSheet = XLSX.utils.aoa_to_sheet([['ID', 'Name'], ...classSheetData]);
  XLSX.utils.book_append_sheet(wb, classSheet, 'Class Sections');

  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  // Generate buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=students-template.xlsx');
  res.send(buffer);
}
```

---

## Phase 4: Error Handling & Edge Cases

### 4.1 Common Errors to Handle

Use your service’s Supabase client (e.g. `this.getClient()` or `this.supabaseConfig.getClient()`). Duplicate emails are caught when creating auth users; you can pre-check if needed. Students table has no `email` column — email is in auth.

```typescript
const supabase = this.getClient(); // or this.supabaseConfig.getClient()

// 1. Duplicate emails — check auth or catch on createUser (e.g. "already registered")

// 2. Invalid class_section_id (must exist in class_sections for this branch)
const validClassSections = await supabase
  .from('class_sections')
  .select('id')
  .eq('branch_id', branchId);

const validIds = new Set((validClassSections.data ?? []).map((cs: { id: string }) => cs.id));
const invalidRows = rows.filter(r => !validIds.has(r.class_section_id));

if (invalidRows.length > 0) {
  throw new BadRequestException('Some class section IDs are invalid');
}

// 3. Invalid date formats
rows.forEach((row, index) => {
  const date = new Date(row.date_of_birth);
  if (isNaN(date.getTime())) {
    throw new BadRequestException(`Row ${index + 2}: Invalid date format`);
  }
});
```

---

## Summary Checklist

**Backend:**
- [ ] Install xlsx, class-validator, class-transformer, multer; use SupabaseConfig (not SupabaseService) from `common/config/supabase.config`
- [ ] Create BulkImportModule, Service, Controller; register BulkImportService and SupabaseConfig in module providers
- [ ] Create BulkStudentRowDto with validation (class_section_id resolved to class_id + section_id for students table)
- [ ] Implement parseStudentsFile() with column mapping
- [ ] Implement importStudents() with batch insert
- [ ] Handle auth user creation
- [ ] Add error handling and validation
- [ ] Create template download endpoint

**Frontend:**
- [ ] Create API service (bulkImportApi)
- [ ] Create hooks (useBulkImportPreview, useBulkImport)
- [ ] Build upload page with FileInput
- [ ] Show preview table with validation status
- [ ] Add academic year selector
- [ ] Implement import confirmation
- [ ] Add template download button
- [ ] Show progress and results

**Features:**
- [ ] Column name mapping (handles variations)
- [ ] Row-by-row validation with error messages
- [ ] Batch insert (500 rows per batch)
- [ ] Parent record creation
- [ ] Auth user creation for students
- [ ] Error reporting (which rows failed)
- [ ] Template with sample data

---

## Testing

**Test Cases:**

1. **Valid file:** 100 rows, all valid → Should import all
2. **Invalid emails:** Some rows have bad email format → Should show errors in preview
3. **Missing required fields:** Some rows missing first_name → Should show errors
4. **Duplicate emails:** Two rows with same email → Should show error
5. **Invalid class section ID:** Non-existent UUID → Should show error
6. **Large file:** 1000+ rows → Should handle in batches
7. **Different column names:** "First Name" vs "first_name" → Should map correctly
8. **CSV file:** Test with .csv instead of .xlsx → Should work
9. **Empty file:** No rows → Should show error
10. **File too large:** >10MB → Should reject

---

This implementation handles all common scenarios. You can extend it for staff, subjects, or any other entity by following the same pattern!