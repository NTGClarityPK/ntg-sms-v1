import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import type { IdCardPersonType } from './types/id-card-person-type';

type UploadedPhotoFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class IdCardPhotoService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async processAndUpload(
    branchId: string,
    personType: IdCardPersonType,
    personId: string,
    file: UploadedPhotoFile,
  ): Promise<{ data: { originalUrl: string; processedUrl: string } }> {
    const supabase = this.supabaseConfig.getClient();
    const storageKey = await this.resolvePhotoStorageKey(branchId, personType, personId);
    const basePath = `${branchId}/${personType}/${storageKey}`;

    const processedBuffer = await sharp(file.buffer)
      .resize(400, 480, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toBuffer();

    const processedPath = `${basePath}.jpg`;
    const { error: procErr } = await supabase.storage
      .from('id-card-assets')
      .upload(processedPath, processedBuffer, { contentType: 'image/jpeg', upsert: true });
    throwIfDbError(procErr as PostgrestError | null);

    const { data: procPub } = supabase.storage.from('id-card-assets').getPublicUrl(processedPath);
    const processedUrl = procPub.publicUrl;

    await supabase.from('id_card_photos').insert({
      branch_id: branchId,
      person_id: personId,
      person_type: personType,
      original_url: processedUrl,
      processed_url: processedUrl,
      face_detected: false,
    });

    const userId = await this.resolveProfileUserId(personType, personId, branchId);
    if (userId) {
      await supabase.from('profiles').update({ avatar_url: processedUrl }).eq('id', userId);
    }

    await supabase
      .from('id_cards')
      .update({ photo_url: processedUrl, updated_at: new Date().toISOString() })
      .eq('branch_id', branchId)
      .eq('person_id', personId)
      .eq('person_type', personType);

    return {
      data: {
        originalUrl: processedUrl,
        processedUrl,
      },
    };
  }

  private sanitizeStorageKey(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException('Person identifier is required for photo storage');
    }
    return trimmed.replace(/[^a-zA-Z0-9_-]+/g, '_');
  }

  private async resolvePhotoStorageKey(
    branchId: string,
    personType: IdCardPersonType,
    personId: string,
  ): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    if (personType === 'student') {
      const { data, error } = await supabase
        .from('students')
        .select('student_id')
        .eq('id', personId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(error);
      const roll = (data as { student_id?: string } | null)?.student_id;
      return this.sanitizeStorageKey(roll ?? personId);
    }
    if (personType === 'staff' || personType === 'admin') {
      const { data, error } = await supabase
        .from('staff')
        .select('employee_id')
        .eq('id', personId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(error);
      const employeeId = (data as { employee_id?: string | null } | null)?.employee_id;
      return this.sanitizeStorageKey(employeeId ?? personId);
    }
    return this.sanitizeStorageKey(personId);
  }

  private async resolveProfileUserId(
    personType: IdCardPersonType,
    personId: string,
    branchId: string,
  ): Promise<string | null> {
    const supabase = this.supabaseConfig.getClient();
    if (personType === 'student') {
      const { data } = await supabase
        .from('students')
        .select('user_id')
        .eq('id', personId)
        .eq('branch_id', branchId)
        .maybeSingle();
      return (data as { user_id: string | null } | null)?.user_id ?? null;
    }
    if (personType === 'staff' || personType === 'admin') {
      const { data } = await supabase
        .from('staff')
        .select('user_id')
        .eq('id', personId)
        .eq('branch_id', branchId)
        .maybeSingle();
      return (data as { user_id: string | null } | null)?.user_id ?? null;
    }
    return null;
  }

  async matchPersonByFilename(
    branchId: string,
    personType: IdCardPersonType,
    filename: string,
  ): Promise<string | null> {
    const key = filename.replace(/\.[^.]+$/, '').trim().toLowerCase();
    if (!key) return null;
    const supabase = this.supabaseConfig.getClient();
    if (personType === 'student') {
      const { data } = await supabase
        .from('students')
        .select('id, student_id')
        .eq('branch_id', branchId);
      const row = (data || []).find(
        (s) => String((s as { student_id: string }).student_id).toLowerCase() === key,
      );
      return (row as { id: string } | undefined)?.id ?? null;
    }
    if (personType === 'staff' || personType === 'admin') {
      const { data } = await supabase
        .from('staff')
        .select('id, employee_id')
        .eq('branch_id', branchId);
      const row = (data || []).find(
        (s) => String((s as { employee_id: string | null }).employee_id ?? '').toLowerCase() === key,
      );
      return (row as { id: string } | undefined)?.id ?? null;
    }
    return null;
  }
}
