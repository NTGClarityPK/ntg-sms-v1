import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Body,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { ReportsService } from './reports.service';
import { BranchesService } from '../branches/branches.service';
import { ClassStudentCountDto } from './dto/class-student-count.dto';

const PUBLIC_STATS_TOKEN_EXPIRY = '1h';

@ApiTags('Public API')
@Controller('api/v1/public/statistics')
export class PublicStatisticsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly branchesService: BranchesService,
    private readonly jwtService: JwtService,
  ) {}

  @Post(':branchCode/verify')
  async verify(
    @Param('branchCode') branchCode: string,
    @Body() body: { password?: string },
  ): Promise<{ data: { token: string } }> {
    const branch = await this.branchesService.getByCode(branchCode);
    if (!branch) {
      throw new UnauthorizedException('Invalid branch');
    }
    if (!branch.public_stats_enabled) {
      throw new UnauthorizedException('Public statistics are not enabled for this branch');
    }
    const password = body?.password ?? '';
    if (!branch.public_stats_password || branch.public_stats_password !== password) {
      throw new UnauthorizedException('Invalid password');
    }
    const token = this.jwtService.sign(
      { branchCode, purpose: 'public-stats' },
      { expiresIn: PUBLIC_STATS_TOKEN_EXPIRY },
    );
    return { data: { token } };
  }

  @Get(':branchCode')
  async getStatistics(
    @Param('branchCode') branchCode: string,
    @Headers('authorization') authorization?: string,
    @Query('token') queryToken?: string,
    @Query('academicYearId') academicYearId?: string,
  ): Promise<{ data: { studentCountByClass: ClassStudentCountDto[]; totals: { total: number; male: number; female: number } } }> {
    const bearerToken =
      typeof authorization === 'string' && authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : null;
    const token = queryToken ?? bearerToken;
    if (!token) {
      throw new UnauthorizedException('Token required. Call POST verify first.');
    }
    let payload: { branchCode?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.purpose !== 'public-stats' || payload.branchCode !== branchCode) {
      throw new UnauthorizedException('Invalid token for this branch');
    }
    const branch = await this.branchesService.getByCode(branchCode);
    if (!branch || !branch.public_stats_enabled) {
      throw new UnauthorizedException('Public statistics are not available');
    }
    const { data: studentCountByClass } = await this.reportsService.getAllClassStudentCounts(
      branch.id,
      academicYearId,
    );
    const totals = studentCountByClass.reduce(
      (acc, c) => ({
        total: acc.total + c.totalStudents,
        male: acc.male + c.maleCount,
        female: acc.female + c.femaleCount,
      }),
      { total: 0, male: 0, female: 0 },
    );
    return {
      data: {
        studentCountByClass,
        totals,
      },
    };
  }
}
