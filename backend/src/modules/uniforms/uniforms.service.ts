import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  UniformItemDto,
  StockEntryDto,
} from './dto/uniform-item.dto';
import { CreateUniformItemDto } from './dto/create-uniform-item.dto';
import { UpdateUniformItemDto } from './dto/update-uniform-item.dto';
import { QueryUniformsDto } from './dto/query-uniforms.dto';
import { AddOrUpdateStockDto } from './dto/add-or-update-stock.dto';

type Meta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type UniformItemRow = {
  id: string;
  name: string;
  item_code: string | null;
  category: string;
  gender: string | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  branch_id: string;
  created_at: string;
  updated_at: string;
};

type UniformStockRow = {
  id: string;
  uniform_item_id: string;
  size: string;
  quantity: number;
  low_stock_threshold: number;
  branch_id: string;
  created_at: string;
  updated_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(
    error instanceof Error ? error.message : 'Unknown error',
  );
}

function mapItemRow(row: UniformItemRow): UniformItemDto {
  return new UniformItemDto({
    id: row.id,
    name: row.name,
    itemCode: row.item_code ?? undefined,
    category: row.category,
    gender: row.gender ?? undefined,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    isActive: row.is_active,
    branchId: row.branch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapStockRow(row: UniformStockRow): StockEntryDto {
  return new StockEntryDto({
    id: row.id,
    uniformItemId: row.uniform_item_id,
    size: row.size,
    quantity: row.quantity,
    lowStockThreshold: row.low_stock_threshold,
    branchId: row.branch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

@Injectable()
export class UniformsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async list(
    query: QueryUniformsDto,
    branchId: string,
  ): Promise<{ data: UniformItemDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('uniform_items')
      .select(
        'id, name, item_code, category, gender, description, image_url, is_active, branch_id, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.category) {
      dbQuery = dbQuery.eq('category', query.category);
    }
    if (query.gender) {
      dbQuery = dbQuery.eq('gender', query.gender);
    }
    if (query.search) {
      dbQuery = dbQuery.or(
        `name.ilike.%${query.search}%,item_code.ilike.%${query.search}%,description.ilike.%${query.search}%`,
      );
    }

    const { data: itemsData, error: itemsError, count } = await dbQuery;
    throwIfDbError(itemsError);
    const rows = (itemsData as UniformItemRow[]) ?? [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    if (rows.length === 0) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages },
      };
    }

    const itemIds = rows.map((r) => r.id);
    const { data: stockData, error: stockError } = await supabase
      .from('uniform_stock')
      .select(
        'id, uniform_item_id, size, quantity, low_stock_threshold, branch_id, created_at, updated_at',
      )
      .in('uniform_item_id', itemIds)
      .eq('branch_id', branchId);

    throwIfDbError(stockError);
    const stockRows = (stockData as UniformStockRow[]) ?? [];
    const stockByItem = new Map<string, StockEntryDto[]>();
    for (const s of stockRows) {
      const list = stockByItem.get(s.uniform_item_id) ?? [];
      list.push(mapStockRow(s));
      stockByItem.set(s.uniform_item_id, list);
    }

    const data = rows.map((r) => {
      const dto = mapItemRow(r);
      dto.stock = stockByItem.get(r.id) ?? [];
      return dto;
    });

    return {
      data,
      meta: { total, page, limit, totalPages },
    };
  }

  async getById(id: string, branchId: string): Promise<UniformItemDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data: item, error: itemError } = await supabase
      .from('uniform_items')
      .select(
        'id, name, item_code, category, gender, description, image_url, is_active, branch_id, created_at, updated_at',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(itemError);
    if (!item) {
      throw new NotFoundException('Uniform item not found');
    }

    const { data: stockData, error: stockError } = await supabase
      .from('uniform_stock')
      .select(
        'id, uniform_item_id, size, quantity, low_stock_threshold, branch_id, created_at, updated_at',
      )
      .eq('uniform_item_id', id)
      .eq('branch_id', branchId);

    throwIfDbError(stockError);
    const stockRows = (stockData as UniformStockRow[]) ?? [];
    const dto = mapItemRow(item as UniformItemRow);
    dto.stock = stockRows.map(mapStockRow);
    return dto;
  }

  private async validateCategoryIfConfigured(category: string): Promise<void> {
    try {
      const { data } = await this.systemSettingsService.getByKey(
        'inventory_categories',
      );
      const allowed = Array.isArray(data?.value)
        ? (data.value as string[])
        : null;
      if (
        allowed &&
        allowed.length > 0 &&
        !allowed.some(
          (c) => c.trim().toLowerCase() === category.trim().toLowerCase(),
        )
      ) {
        throw new BadRequestException(
          `Category must be one of: ${allowed.join(', ')}`,
        );
      }
    } catch (e) {
      if (e instanceof NotFoundException) {
        return;
      }
      throw e;
    }
  }

  async create(
    input: CreateUniformItemDto,
    branchId: string,
  ): Promise<UniformItemDto> {
    await this.validateCategoryIfConfigured(input.category);
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('uniform_items')
      .insert({
        name: input.name,
        item_code: input.itemCode ?? null,
        category: input.category,
        gender: input.gender ?? null,
        description: input.description ?? null,
        image_url: input.imageUrl ?? '/inventoryitems.jpg',
        is_active: input.isActive ?? true,
        branch_id: branchId,
      })
      .select(
        'id, name, item_code, category, gender, description, image_url, is_active, branch_id, created_at, updated_at',
      )
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException('Failed to create uniform item');
    }
    const dto = mapItemRow(data as UniformItemRow);
    dto.stock = [];
    return dto;
  }

  async update(
    id: string,
    input: UpdateUniformItemDto,
    branchId: string,
  ): Promise<UniformItemDto> {
    if (input.category !== undefined) {
      await this.validateCategoryIfConfigured(input.category);
    }
    const supabase = this.supabaseConfig.getClient();
    const updatePayload: Record<string, unknown> = {};
    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.itemCode !== undefined) updatePayload.item_code = input.itemCode;
    if (input.category !== undefined) updatePayload.category = input.category;
    if (input.gender !== undefined) updatePayload.gender = input.gender;
    if (input.description !== undefined)
      updatePayload.description = input.description;
    if (input.imageUrl !== undefined) updatePayload.image_url = input.imageUrl;
    if (input.isActive !== undefined) updatePayload.is_active = input.isActive;

    const { data, error } = await supabase
      .from('uniform_items')
      .update(updatePayload)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select(
        'id, name, item_code, category, gender, description, image_url, is_active, branch_id, created_at, updated_at',
      )
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Uniform item not found');
    }
    return this.getById(id, branchId);
  }

  async delete(id: string, branchId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase
      .from('uniform_items')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    throwIfDbError(error);
  }

  async addOrUpdateStock(
    itemId: string,
    input: AddOrUpdateStockDto,
    branchId: string,
  ): Promise<StockEntryDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data: item } = await supabase
      .from('uniform_items')
      .select('id')
      .eq('id', itemId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (!item) {
      throw new NotFoundException('Uniform item not found');
    }

    const threshold = input.lowStockThreshold ?? 10;
    const { data: existing } = await supabase
      .from('uniform_stock')
      .select('id, uniform_item_id, size, quantity, low_stock_threshold, branch_id, created_at, updated_at')
      .eq('uniform_item_id', itemId)
      .eq('size', input.size)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabase
        .from('uniform_stock')
        .update({
          quantity: input.quantity,
          low_stock_threshold: threshold,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('branch_id', branchId)
        .select(
          'id, uniform_item_id, size, quantity, low_stock_threshold, branch_id, created_at, updated_at',
        )
        .single();

      throwIfDbError(error);
      if (!updated) throw new BadRequestException('Failed to update stock');
      return mapStockRow(updated as UniformStockRow);
    }

    const { data: inserted, error } = await supabase
      .from('uniform_stock')
      .insert({
        uniform_item_id: itemId,
        size: input.size,
        quantity: input.quantity,
        low_stock_threshold: threshold,
        branch_id: branchId,
      })
      .select(
        'id, uniform_item_id, size, quantity, low_stock_threshold, branch_id, created_at, updated_at',
      )
      .single();

    throwIfDbError(error);
    if (!inserted) throw new BadRequestException('Failed to add stock');
    return mapStockRow(inserted as UniformStockRow);
  }

  async updateStockQuantity(
    stockId: string,
    quantity: number,
    branchId: string,
  ): Promise<StockEntryDto> {
    const supabase = this.supabaseConfig.getClient();
    if (quantity < 0) {
      throw new BadRequestException('Quantity cannot be negative');
    }
    const { data, error } = await supabase
      .from('uniform_stock')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', stockId)
      .eq('branch_id', branchId)
      .select(
        'id, uniform_item_id, size, quantity, low_stock_threshold, branch_id, created_at, updated_at',
      )
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Stock entry not found');
    }
    return mapStockRow(data as UniformStockRow);
  }

  async getLowStock(branchId: string): Promise<UniformItemDto[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data: stockRows, error: stockError } = await supabase
      .from('uniform_stock')
      .select(
        'id, uniform_item_id, size, quantity, low_stock_threshold, branch_id, created_at, updated_at',
      )
      .eq('branch_id', branchId);

    throwIfDbError(stockError);
    const allStock = (stockRows as UniformStockRow[]) ?? [];
    const lowByThreshold = allStock.filter(
      (s) => s.quantity <= s.low_stock_threshold,
    );
    if (lowByThreshold.length === 0) return [];

    const itemIds = [...new Set(lowByThreshold.map((s) => s.uniform_item_id))];
    const { data: itemsData, error: itemsError } = await supabase
      .from('uniform_items')
      .select(
        'id, name, item_code, category, gender, description, image_url, is_active, branch_id, created_at, updated_at',
      )
      .in('id', itemIds)
      .eq('branch_id', branchId)
      .eq('is_active', true);

    throwIfDbError(itemsError);
    const itemRows = (itemsData as UniformItemRow[]) ?? [];
    const stockByItem = new Map<string, StockEntryDto[]>();
    for (const s of lowByThreshold) {
      const list = stockByItem.get(s.uniform_item_id) ?? [];
      list.push(mapStockRow(s));
      stockByItem.set(s.uniform_item_id, list);
    }
    return itemRows.map((r) => {
      const dto = mapItemRow(r);
      dto.stock = stockByItem.get(r.id) ?? [];
      return dto;
    });
  }
}
