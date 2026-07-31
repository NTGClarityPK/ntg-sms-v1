import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BranchesService } from '../branches/branches.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { LibraryItemDto } from './dto/library-item.dto';
import { CreateLibraryItemDto } from './dto/create-library-item.dto';
import { UpdateLibraryItemDto } from './dto/update-library-item.dto';
import { QueryLibraryItemsDto } from './dto/query-library-items.dto';

type Meta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type LibraryItemRow = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  subject_id: string | null;
  class_id: string | null;
  category: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  thumbnail_url: string | null;
  is_active: boolean;
  view_count: number;
  download_count: number;
  uploaded_by: string | null;
  branch_id: string;
  created_at: string;
  updated_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function mapLibraryItem(row: LibraryItemRow): LibraryItemDto {
  return new LibraryItemDto({
    id: row.id,
    title: row.title,
    author: row.author ?? undefined,
    description: row.description ?? undefined,
    subjectId: row.subject_id ?? undefined,
    classId: row.class_id ?? undefined,
    category: row.category,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    mimeType: row.mime_type,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    isActive: row.is_active,
    viewCount: row.view_count,
    downloadCount: row.download_count,
    uploadedBy: row.uploaded_by ?? undefined,
    branchId: row.branch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

@Injectable()
export class LibraryService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly branchesService: BranchesService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async list(
    query: QueryLibraryItemsDto,
    branchId: string,
  ): Promise<{ data: LibraryItemDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('library_items')
      .select(
        'id, title, author, description, subject_id, class_id, category, file_url, file_name, file_size_bytes, mime_type, thumbnail_url, is_active, view_count, download_count, uploaded_by, branch_id, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.category) {
      dbQuery = dbQuery.eq('category', query.category);
    }

    if (query.subjectId) {
      dbQuery = dbQuery.eq('subject_id', query.subjectId);
    }

    if (query.classId) {
      dbQuery = dbQuery.eq('class_id', query.classId);
    }

    if (query.search) {
      dbQuery = dbQuery.or(
        `title.ilike.%${query.search}%,author.ilike.%${query.search}%,description.ilike.%${query.search}%`,
      );
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const rows = (data as LibraryItemRow[]) ?? [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: rows.map(mapLibraryItem),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async getById(id: string, branchId: string): Promise<LibraryItemDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('library_items')
      .select(
        'id, title, author, description, subject_id, class_id, category, file_url, file_name, file_size_bytes, mime_type, thumbnail_url, is_active, view_count, download_count, uploaded_by, branch_id, created_at, updated_at',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Library item not found');
    }

    return mapLibraryItem(data as LibraryItemRow);
  }

  async create(
    input: CreateLibraryItemDto,
    branchId: string,
    uploadedBy: string,
    userEmail: string,
    fileSizeBytes: number,
    mimeType: string,
  ): Promise<LibraryItemDto> {
    const supabase = this.supabaseConfig.getClient();

    // Validate category exists in system_settings
    const { data: categoriesSetting } = await this.systemSettingsService.getByKey(
      'library_categories',
    );
    const categories = (categoriesSetting.value as string[]) || [];
    if (!categories.includes(input.category)) {
      throw new BadRequestException(
        `Category "${input.category}" is not a valid library category`,
      );
    }

    // Validate subject exists if provided
    if (input.subjectId) {
      const { data: subject, error: subjectError } = await supabase
        .from('subjects')
        .select('id')
        .eq('id', input.subjectId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(subjectError);
      if (!subject) {
        throw new BadRequestException('Subject not found');
      }
    }

    // Validate class exists if provided
    if (input.classId) {
      const { data: classRow, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('id', input.classId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(classError);
      if (!classRow) {
        throw new BadRequestException('Class not found');
      }
    }

    const { data, error } = await supabase
      .from('library_items')
      .insert({
        title: input.title,
        author: input.author ?? null,
        description: input.description ?? null,
        subject_id: input.subjectId ?? null,
        class_id: input.classId ?? null,
        category: input.category,
        file_url: input.fileUrl,
        file_name: input.fileName,
        file_size_bytes: fileSizeBytes,
        mime_type: mimeType,
        thumbnail_url: input.thumbnailUrl ?? null,
        uploaded_by: uploadedBy,
        branch_id: branchId,
      })
      .select(
        'id, title, author, description, subject_id, class_id, category, file_url, file_name, file_size_bytes, mime_type, thumbnail_url, is_active, view_count, download_count, uploaded_by, branch_id, created_at, updated_at',
      )
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException('Failed to create library item');
    }

    const libraryItem = mapLibraryItem(data as LibraryItemRow);

    // Audit log

    return libraryItem;
  }

  async update(
    id: string,
    input: UpdateLibraryItemDto,
    branchId: string,
    userEmail: string,
  ): Promise<LibraryItemDto> {
    const supabase = this.supabaseConfig.getClient();

    // Get existing item
    const existing = await this.getById(id, branchId);

    // Validate category if provided
    if (input.category) {
      const { data: categoriesSetting } = await this.systemSettingsService.getByKey(
        'library_categories',
      );
      const categories = (categoriesSetting.value as string[]) || [];
      if (!categories.includes(input.category)) {
        throw new BadRequestException(
          `Category "${input.category}" is not a valid library category`,
        );
      }
    }

    // Validate subject if provided
    if (input.subjectId) {
      const { data: subject, error: subjectError } = await supabase
        .from('subjects')
        .select('id')
        .eq('id', input.subjectId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(subjectError);
      if (!subject) {
        throw new BadRequestException('Subject not found');
      }
    }

    // Validate class if provided
    if (input.classId) {
      const { data: classRow, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('id', input.classId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(classError);
      if (!classRow) {
        throw new BadRequestException('Class not found');
      }
    }

    const updateData: Partial<LibraryItemRow> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.author !== undefined) updateData.author = input.author ?? null;
    if (input.description !== undefined)
      updateData.description = input.description ?? null;
    if (input.subjectId !== undefined)
      updateData.subject_id = input.subjectId ?? null;
    if (input.classId !== undefined) updateData.class_id = input.classId ?? null;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;

    const { data, error } = await supabase
      .from('library_items')
      .update(updateData)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select(
        'id, title, author, description, subject_id, class_id, category, file_url, file_name, file_size_bytes, mime_type, thumbnail_url, is_active, view_count, download_count, uploaded_by, branch_id, created_at, updated_at',
      )
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Library item not found');
    }

    const updated = mapLibraryItem(data as LibraryItemRow);

    // Audit log

    return updated;
  }

  async delete(id: string, branchId: string, userEmail: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const existing = await this.getById(id, branchId);

    // Get file URL for deletion from storage
    const fileUrl = existing.fileUrl;
    const fileSizeBytes = existing.fileSizeBytes;

    // Delete from database
    const { error } = await supabase
      .from('library_items')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    throwIfDbError(error);

    // Delete file from storage (if URL contains bucket path)
    // Extract bucket and path from URL
    try {
      const urlParts = fileUrl.split('/');
      const bucketIndex = urlParts.findIndex((part) => part.includes('storage'));
      if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
        const bucketName = urlParts[bucketIndex + 1];
        const filePath = urlParts.slice(bucketIndex + 2).join('/');
        if (bucketName && filePath) {
          await supabase.storage.from(bucketName).remove([filePath]);
        }
      }
    } catch (storageError) {
      // Log but don't fail if storage deletion fails
      console.error('Failed to delete file from storage:', storageError);
    }

    // Update storage quota (decrease)
    try {
      const branch = await this.branchesService.getById(branchId);
      const newUsedBytes = Math.max(0, branch.storageUsedBytes - fileSizeBytes);
      await supabase
        .from('branches')
        .update({ storage_used_bytes: newUsedBytes })
        .eq('id', branchId);
    } catch (quotaError) {
      console.error('Failed to update storage quota:', quotaError);
    }

    // Audit log
  }

  async incrementViewCount(id: string, branchId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase.rpc('increment_library_view_count', {
      item_id: id,
    });
    if (error) {
      // Fallback to manual increment if RPC doesn't exist
      const { data } = await supabase
        .from('library_items')
        .select('view_count')
        .eq('id', id)
        .eq('branch_id', branchId)
        .single();
      if (data) {
        await supabase
          .from('library_items')
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq('id', id)
          .eq('branch_id', branchId);
      }
    }
  }

  async incrementDownloadCount(id: string, branchId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase.rpc('increment_library_download_count', {
      item_id: id,
    });
    if (error) {
      // Fallback to manual increment if RPC doesn't exist
      const { data } = await supabase
        .from('library_items')
        .select('download_count')
        .eq('id', id)
        .eq('branch_id', branchId)
        .single();
      if (data) {
        await supabase
          .from('library_items')
          .update({ download_count: (data.download_count || 0) + 1 })
          .eq('id', id)
          .eq('branch_id', branchId);
      }
    }
  }

  async search(
    query: QueryLibraryItemsDto,
    branchId: string,
  ): Promise<{ data: LibraryItemDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('library_items')
      .select(
        'id, title, author, description, subject_id, class_id, category, file_url, file_name, file_size_bytes, mime_type, thumbnail_url, is_active, view_count, download_count, uploaded_by, branch_id, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.category) {
      dbQuery = dbQuery.eq('category', query.category);
    }

    if (query.subjectId) {
      dbQuery = dbQuery.eq('subject_id', query.subjectId);
    }

    if (query.classId) {
      dbQuery = dbQuery.eq('class_id', query.classId);
    }

    if (query.search) {
      // Use full-text search if available, otherwise fallback to ilike
      // PostgreSQL full-text search using the GIN index
      const searchTerm = query.search.trim();
      dbQuery = dbQuery.or(
        `title.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`,
      );
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const rows = (data as LibraryItemRow[]) ?? [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: rows.map(mapLibraryItem),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async getCategories(): Promise<{ data: string[] }> {
    const { data: categoriesSetting } = await this.systemSettingsService.getByKey(
      'library_categories',
    );
    const categories = (categoriesSetting.value as string[]) || [];
    return { data: categories };
  }
}
