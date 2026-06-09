import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import type { CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { CertificatesService } from './certificates.service';
import { QueryCertificateHistoryDto } from './dto/query-certificate-history.dto';
import { throwIfDbError } from './utils/throw-if-db-error.util';

const FEATURE_CODE = 'certificates';

@ApiTags('My certificates')
@Controller('api/v1/my-certificates')
@UseGuards(JwtAuthGuard, BranchGuard)
export class CertificatesPortalController {
  constructor(
    private readonly certificatesService: CertificatesService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureMyCertificatesAccess(
    user: CurrentUserPayload,
    branchId: string,
  ): Promise<void> {
    const roleNames = (user.roles || []).map((r) => r.toLowerCase());
    if (roleNames.includes('school_admin')) return;

    const supabase = this.supabaseConfig.getClient();
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .in('name', user.roles || []);
    if (rolesError) throw new ForbiddenException('Unable to verify permissions');
    const roleIds = (rolesData || []).map((r: { id: string }) => r.id);

    const { data: featureData } = await supabase
      .from('features')
      .select('id')
      .eq('code', FEATURE_CODE)
      .maybeSingle();
    if (!featureData) {
      throw new ForbiddenException(`${FEATURE_CODE} feature not configured`);
    }

    const { data: permissionRows } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);

    const canView = (permissionRows || []).some(
      (row: { permission: string }) =>
        row.permission === 'view' || row.permission === 'edit',
    );
    if (!canView) {
      throw new ForbiddenException('You do not have access to certificates');
    }
  }

  private async resolveAllowedStudentIds(
    user: CurrentUserPayload,
    branchId: string,
  ): Promise<string[]> {
    const roles = (user.roles || []).map((r) => r.toLowerCase());
    const supabase = this.supabaseConfig.getClient();

    if (roles.includes('student')) {
      const { data, error } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .eq('branch_id', branchId);
      throwIfDbError(error);
      return (data || []).map((r: { id: string }) => r.id);
    }

    if (roles.includes('parent') || roles.includes('guardian')) {
      const { data: links, error } = await supabase
        .from('parent_students')
        .select('student_id')
        .eq('parent_user_id', user.id);
      throwIfDbError(error);
      const ids = (links || []).map((r: { student_id: string }) => r.student_id);
      if (ids.length === 0) return [];
      const { data: students, error: stuErr } = await supabase
        .from('students')
        .select('id')
        .in('id', ids)
        .eq('branch_id', branchId);
      throwIfDbError(stuErr);
      return (students || []).map((r: { id: string }) => r.id);
    }

    throw new ForbiddenException('This endpoint is for students and parents only');
  }

  @Get()
  async listMine(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryCertificateHistoryDto,
  ) {
    await this.ensureMyCertificatesAccess(user, branch.branchId);
    const allowed = await this.resolveAllowedStudentIds(user, branch.branchId);
    if (allowed.length === 0) {
      return {
        data: [],
        meta: { total: 0, page: query.page ?? 1, limit: query.limit ?? 20, totalPages: 0 },
      };
    }
    return this.certificatesService.findHistory(
      branch.branchId,
      { ...query, status: query.status ?? 'issued' },
      { restrictStudentIds: allowed },
    );
  }

  @Get(':id/pdf')
  async downloadMine(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    await this.ensureMyCertificatesAccess(user, branch.branchId);
    const allowed = await this.resolveAllowedStudentIds(user, branch.branchId);
    if (allowed.length === 0) {
      throw new ForbiddenException('No student profile linked');
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: cert, error } = await supabase
      .from('certificates')
      .select('student_id, status')
      .eq('id', id)
      .eq('branch_id', branch.branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!cert) throw new ForbiddenException('Certificate not found');
    const studentId = (cert as { student_id: string }).student_id;
    if (!allowed.includes(studentId)) {
      throw new ForbiddenException('You cannot access this certificate');
    }
    if ((cert as { status: string }).status === 'revoked') {
      throw new ForbiddenException('This certificate has been revoked');
    }

    const buffer = await this.certificatesService.getPdfBuffer(
      branch.branchId,
      id,
      { studentIdScope: studentId },
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${id}.pdf"`);
    res.send(buffer);
  }
}
