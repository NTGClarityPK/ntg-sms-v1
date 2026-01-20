import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CoreLookupsService } from './core-lookups.service';
import { QuerySectionsDto } from './dto/query-sections.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { SectionDto } from './dto/section.dto';

@Controller('api/v1/sections')
@UseGuards(JwtAuthGuard)
export class SectionsController {
  constructor(private readonly coreLookupsService: CoreLookupsService) {}

  @Get()
  async list(
    @Query() query: QuerySectionsDto,
  ): Promise<{
    data: SectionDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.coreLookupsService.listSections(query);
  }

  @Post()
  async create(@Body() body: CreateSectionDto): Promise<{ data: SectionDto }> {
    const created = await this.coreLookupsService.createSection(body);
    return { data: created };
  }
}


