import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { QueryAcademicYearsDto } from './dto/query-academic-years.dto';
import { AcademicYearDto } from './dto/academic-year.dto';

@Controller('api/v1/academic-years')
@UseGuards(JwtAuthGuard)
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Get()
  async list(
    @Query() query: QueryAcademicYearsDto,
  ): Promise<{
    data: AcademicYearDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.academicYearsService.list(query);
  }

  @Get('active')
  async getActive(): Promise<{ data: AcademicYearDto | null }> {
    const year = await this.academicYearsService.getActive();
    return { data: year };
  }

  @Post()
  async create(@Body() body: CreateAcademicYearDto): Promise<{ data: AcademicYearDto }> {
    const created = await this.academicYearsService.create(body);
    return { data: created };
  }

  @Patch(':id/activate')
  async activate(@Param('id') id: string): Promise<{ data: AcademicYearDto }> {
    const updated = await this.academicYearsService.activate(id);
    return { data: updated };
  }

  @Patch(':id/lock')
  async lock(@Param('id') id: string): Promise<{ data: AcademicYearDto }> {
    const updated = await this.academicYearsService.lock(id);
    return { data: updated };
  }
}


