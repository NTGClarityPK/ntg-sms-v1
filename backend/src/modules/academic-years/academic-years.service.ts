import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { AcademicYearDto } from './dto/academic-year.dto';
import { QueryAcademicYearsDto } from './dto/query-academic-years.dto';

type AcademicYearRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
};

function mapAcademicYear(row: AcademicYearRow): AcademicYearDto {
  return new AcademicYearDto({
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
    isLocked: row.is_locked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class AcademicYearsService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async list(query: QueryAcademicYearsDto): Promise<{
    data: AcademicYearDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('academic_years')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.search) {
      // Search by name (case-insensitive)
      dbQuery = dbQuery.ilike('name', `%${query.search}%`);
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: (data as AcademicYearRow[]).map(mapAcademicYear),
      meta: { total, page, limit, totalPages },
    };
  }

  async getActive(): Promise<AcademicYearDto | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    throwIfDbError(error);
    return data ? mapAcademicYear(data as AcademicYearRow) : null;
  }

  async create(input: { name: string; startDate: string; endDate: string }): Promise<AcademicYearDto> {
    if (input.startDate >= input.endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('academic_years')
      .insert({
        name: input.name,
        start_date: input.startDate,
        end_date: input.endDate,
      })
      .select('*')
      .single();

    throwIfDbError(error);
    return mapAcademicYear(data as AcademicYearRow);
  }

  async activate(id: string): Promise<AcademicYearDto> {
    const supabase = this.supabaseConfig.getClient();

    // Ensure it exists and not locked
    const { data: existing, error: existingError } = await supabase
      .from('academic_years')
      .select('*')
      .eq('id', id)
      .single();
    if (existingError || !existing) throw new NotFoundException('Academic year not found');
    if ((existing as AcademicYearRow).is_locked) throw new BadRequestException('Academic year is locked');

    // Deactivate all, then activate selected (service role key bypasses RLS)
    const { error: deactivateError } = await supabase
      .from('academic_years')
      .update({ is_active: false })
      .eq('is_active', true);
    throwIfDbError(deactivateError);

    const { data, error } = await supabase
      .from('academic_years')
      .update({ is_active: true })
      .eq('id', id)
      .select('*')
      .single();

    throwIfDbError(error);
    return mapAcademicYear(data as AcademicYearRow);
  }

  async lock(id: string): Promise<AcademicYearDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: existingError } = await supabase
      .from('academic_years')
      .select('*')
      .eq('id', id)
      .single();
    if (existingError || !existing) throw new NotFoundException('Academic year not found');

    const { data, error } = await supabase
      .from('academic_years')
      .update({ is_locked: true })
      .eq('id', id)
      .select('*')
      .single();

    throwIfDbError(error);
    return mapAcademicYear(data as AcademicYearRow);
  }
}


