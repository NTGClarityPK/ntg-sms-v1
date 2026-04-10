import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { ClassSectionsService } from '../class-sections/class-sections.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventDto } from './dto/event.dto';
import { EventParticipantDto } from './dto/event-participant.dto';
import { EventConsentDto } from './dto/event-consent.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto, EventStatus } from './dto/query-events.dto';

type Meta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  title_translations?: Record<string, string> | null;
  description_translations?: Record<string, string> | null;
  start_date: string;
  end_date: string;
  requires_consent: boolean;
  consent_deadline: string | null;
  created_by: string;
  branch_id: string;
  academic_year_id: string;
  created_at: string;
  updated_at: string;
};

type EventParticipantRow = {
  id: string;
  event_id: string;
  class_section_id: string | null;
  student_id: string | null;
  branch_id: string;
  created_at: string;
};

type EventConsentRow = {
  id: string;
  event_id: string;
  student_id: string;
  parent_user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  responded_at: string | null;
  ip_address: string | null;
  notes: string | null;
  branch_id: string;
  created_at: string;
  updated_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function resolveEventTitle(
  row: { title: string; title_translations?: Record<string, string> | null },
  language: string,
): string {
  const t = row.title_translations;
  return (t?.[language] ?? t?.en ?? row.title) || row.title;
}

function resolveEventDescription(
  row: { description: string | null; description_translations?: Record<string, string> | null },
  language: string,
): string | undefined {
  const t = row.description_translations;
  const resolved = t?.[language] ?? t?.en ?? row.description;
  return resolved ?? undefined;
}

function mapEvent(row: EventRow, language: string = 'ar'): EventDto {
  return new EventDto({
    id: row.id,
    title: resolveEventTitle(row, language),
    description: resolveEventDescription(row, language),
    startDate: row.start_date,
    endDate: row.end_date,
    requiresConsent: row.requires_consent,
    consentDeadline: row.consent_deadline ?? undefined,
    createdBy: row.created_by,
    branchId: row.branch_id,
    academicYearId: row.academic_year_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapEventParticipant(
  row: EventParticipantRow,
  className?: string,
  sectionName?: string,
): EventParticipantDto {
  return new EventParticipantDto({
    id: row.id,
    eventId: row.event_id,
    classSectionId: row.class_section_id ?? undefined,
    studentId: row.student_id ?? undefined,
    branchId: row.branch_id,
    createdAt: row.created_at,
    className,
    sectionName,
  });
}

function mapEventConsent(row: EventConsentRow): EventConsentDto {
  return new EventConsentDto({
    id: row.id,
    eventId: row.event_id,
    studentId: row.student_id,
    parentUserId: row.parent_user_id,
    status: row.status,
    respondedAt: row.responded_at ?? undefined,
    ipAddress: row.ip_address ?? undefined,
    notes: row.notes ?? undefined,
    branchId: row.branch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

@Injectable()
export class EventsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
    private readonly academicYearsService: AcademicYearsService,
    private readonly classSectionsService: ClassSectionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listEvents(
    query: QueryEventsDto,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: EventDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const language = query.language ?? 'ar';

    let activeYearId = academicYearId;
    if (!activeYearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      activeYearId = activeYear.id;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId);

    if (query.startDate) {
      dbQuery = dbQuery.gte('end_date', query.startDate);
    }

    if (query.endDate) {
      dbQuery = dbQuery.lte('start_date', query.endDate);
    }

    if (query.requiresConsent !== undefined) {
      dbQuery = dbQuery.eq('requires_consent', query.requiresConsent);
    }

    if (query.status === EventStatus.UPCOMING) {
      dbQuery = dbQuery.gte('start_date', new Date().toISOString().split('T')[0]);
    } else if (query.status === EventStatus.PAST) {
      dbQuery = dbQuery.lt('end_date', new Date().toISOString().split('T')[0]);
    }

    dbQuery = dbQuery.order('start_date', { ascending: true });

    const { data, error, count } = await dbQuery.range(from, to);
    throwIfDbError(error);

    if (!data || data.length === 0) {
      return {
        data: [],
        meta: {
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    }

    const events = (data as EventRow[]).map((row) => mapEvent(row, language));
    const eventIds = events.map((e) => e.id);

    // Fetch participants with class section details for all events
    const { data: participantsData } = await supabase
      .from('event_participants')
      .select(
        'id, event_id, class_section_id, student_id, branch_id, created_at, class_sections:class_section_id(class_id, section_id, classes:class_id(name, display_name), sections:section_id(name))',
      )
      .in('event_id', eventIds)
      .eq('branch_id', branchId);

    // Group participants by event ID
    const participantsByEventId = new Map<string, EventParticipantDto[]>();
    for (const p of (participantsData || []) as any[]) {
      const eventId = p.event_id as string;
      if (!participantsByEventId.has(eventId)) {
        participantsByEventId.set(eventId, []);
      }

      const classSection = p.class_sections;
      let className: string | undefined;
      let sectionName: string | undefined;

      if (classSection) {
        const classData = Array.isArray(classSection.classes)
          ? classSection.classes[0]
          : classSection.classes;
        const sectionData = Array.isArray(classSection.sections)
          ? classSection.sections[0]
          : classSection.sections;
        className = classData?.display_name || classData?.name;
        sectionName = sectionData?.name;
      }

      participantsByEventId.get(eventId)!.push(
        mapEventParticipant(
          {
            id: p.id as string,
            event_id: eventId,
            class_section_id: p.class_section_id,
            student_id: p.student_id,
            branch_id: p.branch_id as string,
            created_at: p.created_at as string,
          },
          className,
          sectionName,
        ),
      );
    }

    // Attach participants to events
    for (const event of events) {
      event.participants = participantsByEventId.get(event.id) || [];
    }

    // Filter by class section if provided
    if (query.classSectionId) {
      const filteredEvents = events.filter((e) =>
        e.participants?.some((p) => p.classSectionId === query.classSectionId),
      );

      return {
        data: filteredEvents,
        meta: {
          total: filteredEvents.length,
          page,
          limit,
          totalPages: Math.ceil(filteredEvents.length / limit),
        },
      };
    }

    return {
      data: events,
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async getEvent(id: string, branchId: string, language: string = 'ar'): Promise<EventDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Event not found');
    }

    const event = mapEvent(data as EventRow, language);

    // Fetch participants for this event with class section details
    const { data: participantsData, error: participantsError } = await supabase
      .from('event_participants')
      .select(
        '*, class_sections:class_section_id(class_id, section_id, classes:class_id(name, display_name), sections:section_id(name))',
      )
      .eq('event_id', id)
      .eq('branch_id', branchId);

    throwIfDbError(participantsError);

    const participants = (participantsData || []).map((p: any) => {
      const classSection = p.class_sections;
      let className: string | undefined;
      let sectionName: string | undefined;

      if (classSection) {
        const classData = Array.isArray(classSection.classes)
          ? classSection.classes[0]
          : classSection.classes;
        const sectionData = Array.isArray(classSection.sections)
          ? classSection.sections[0]
          : classSection.sections;
        className = classData?.display_name || classData?.name;
        sectionName = sectionData?.name;
      }

      return mapEventParticipant(p as EventParticipantRow, className, sectionName);
    });
    event.participants = participants;

    return event;
  }

  async createEvent(
    input: CreateEventDto,
    branchId: string,
    userId: string,
    userEmail: string,
  ): Promise<EventDto> {
    const supabase = this.supabaseConfig.getClient();

    // Validate dates
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('End date must be greater than or equal to start date');
    }

    if (input.consentDeadline) {
      const deadline = new Date(input.consentDeadline);
      if (deadline > startDate) {
        throw new BadRequestException('Consent deadline must be before or equal to start date');
      }
    }

    // Validate at least one participant type
    if (
      (!input.classSectionIds || input.classSectionIds.length === 0) &&
      (!input.studentIds || input.studentIds.length === 0)
    ) {
      throw new BadRequestException('At least one class section or student must be specified');
    }

    // Get active academic year
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    await this.academicYearsService.assertNotLockedForBranch(branchId, activeYear.id);

    // Validate class sections belong to branch
    if (input.classSectionIds && input.classSectionIds.length > 0) {
      for (const classSectionId of input.classSectionIds) {
        const classSection = await this.classSectionsService.getClassSectionById(
          classSectionId,
          branchId,
        );
        if (!classSection) {
          throw new NotFoundException(`Class section ${classSectionId} not found`);
        }
      }
    }

    const titleTranslations = input.title_translations ?? { en: input.title, ar: input.title };
    const descriptionTranslations = input.description_translations ?? {
      en: input.description ?? '',
      ar: input.description ?? '',
    };
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .insert({
        title: input.title,
        description: input.description ?? null,
        title_translations: titleTranslations,
        description_translations: descriptionTranslations,
        start_date: input.startDate,
        end_date: input.endDate,
        requires_consent: input.requiresConsent ?? false,
        consent_deadline: input.consentDeadline ?? null,
        created_by: userId,
        branch_id: branchId,
        academic_year_id: activeYear.id,
      })
      .select('*')
      .single();

    throwIfDbError(eventError);
    if (!eventData) {
      throw new BadRequestException('Failed to create event');
    }

    this.auditLogService
      .logCreate(
        'events',
        (eventData as EventRow).id,
        userEmail,
        { ...eventData } as Record<string, unknown>,
        { branchId },
      )
      .catch(() => {});

    const event = mapEvent(eventData as EventRow, 'ar');

    // Create participants
    const participants: Array<{
      event_id: string;
      class_section_id: string | null;
      student_id: string | null;
      branch_id: string;
    }> = [];

    if (input.classSectionIds && input.classSectionIds.length > 0) {
      for (const classSectionId of input.classSectionIds) {
        participants.push({
          event_id: event.id,
          class_section_id: classSectionId,
          student_id: null,
          branch_id: branchId,
        });
      }
    }

    if (input.studentIds && input.studentIds.length > 0) {
      for (const studentId of input.studentIds) {
        participants.push({
          event_id: event.id,
          class_section_id: null,
          student_id: studentId,
          branch_id: branchId,
        });
      }
    }

    if (participants.length > 0) {
      const { error: participantsError } = await supabase
        .from('event_participants')
        .insert(participants);

      throwIfDbError(participantsError);
    }

    // Create initial consents if required
    if (input.requiresConsent) {
      await this.createInitialConsents(event.id, branchId);
    }

    // Send notifications to participants
    await this.notifyEventCreated(event.id, branchId);

    return event;
  }

  async updateEvent(
    id: string,
    input: UpdateEventDto,
    branchId: string,
    userEmail: string,
  ): Promise<EventDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: existingError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(existingError);
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    await this.academicYearsService.assertNotLockedForBranch(
      branchId,
      (existing as EventRow).academic_year_id,
    );

    // Validate dates if provided
    const startDate = input.startDate ? new Date(input.startDate) : new Date(existing.start_date);
    const endDate = input.endDate ? new Date(input.endDate) : new Date(existing.end_date);
    if (endDate < startDate) {
      throw new BadRequestException('End date must be greater than or equal to start date');
    }

    if (input.consentDeadline) {
      const deadline = new Date(input.consentDeadline);
      if (deadline > startDate) {
        throw new BadRequestException('Consent deadline must be before or equal to start date');
      }
    }

    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined) payload.description = input.description ?? null;
    if (input.title_translations !== undefined) payload.title_translations = input.title_translations;
    if (input.description_translations !== undefined) payload.description_translations = input.description_translations;
    if (input.startDate !== undefined) payload.start_date = input.startDate;
    if (input.endDate !== undefined) payload.end_date = input.endDate;
    if (input.requiresConsent !== undefined) payload.requires_consent = input.requiresConsent;
    if (input.consentDeadline !== undefined) payload.consent_deadline = input.consentDeadline ?? null;

    const { data, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select('*')
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException('Failed to update event');
    }

    const newRow = data as EventRow;
    const changedFields = Object.keys(payload);
    this.auditLogService
      .logUpdate(
        'events',
        id,
        userEmail,
        { ...existing } as Record<string, unknown>,
        { ...newRow } as Record<string, unknown>,
        changedFields,
        { branchId },
      )
      .catch(() => {});

    // Update participants if provided
    if (input.classSectionIds !== undefined || input.studentIds !== undefined) {
      // Delete existing participants
      await supabase.from('event_participants').delete().eq('event_id', id);

      // Create new participants
      const participants: Array<{
        event_id: string;
        class_section_id: string | null;
        student_id: string | null;
        branch_id: string;
      }> = [];

      if (input.classSectionIds && input.classSectionIds.length > 0) {
        for (const classSectionId of input.classSectionIds) {
          participants.push({
            event_id: id,
            class_section_id: classSectionId,
            student_id: null,
            branch_id: branchId,
          });
        }
      }

      if (input.studentIds && input.studentIds.length > 0) {
        for (const studentId of input.studentIds) {
          participants.push({
            event_id: id,
            class_section_id: null,
            student_id: studentId,
            branch_id: branchId,
          });
        }
      }

      if (participants.length > 0) {
        const { error: participantsError } = await supabase
          .from('event_participants')
          .insert(participants);

        throwIfDbError(participantsError);
      }

      // Recreate consents if consent is required
      if (input.requiresConsent || existing.requires_consent) {
        await this.createInitialConsents(id, branchId);
      }
    }

    // Send update notifications
    await this.notifyEventUpdated(id, branchId);

    return mapEvent(newRow, 'ar');
  }

  async deleteEvent(
    id: string,
    branchId: string,
    userEmail: string,
  ): Promise<{ id: string }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: oldRow, error: existingError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(existingError);
    if (!oldRow) {
      throw new NotFoundException('Event not found');
    }
    await this.academicYearsService.assertNotLockedForBranch(
      branchId,
      (oldRow as EventRow).academic_year_id,
    );

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    throwIfDbError(error);

    this.auditLogService
      .logDelete('events', id, userEmail, { ...oldRow } as Record<string, unknown>, { branchId })
      .catch(() => {});
    return { id };
  }

  async getEventConsents(
    eventId: string,
    branchId: string,
  ): Promise<{ data: EventConsentDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    // Verify event exists and belongs to branch
    await this.getEvent(eventId, branchId);

    const { data, error } = await supabase
      .from('event_consents')
      .select('*')
      .eq('event_id', eventId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    throwIfDbError(error);

    const consentRows = (data || []) as EventConsentRow[];

    if (consentRows.length === 0) {
      return { data: [] };
    }

    // Get unique student IDs and parent user IDs
    const studentIds = [...new Set(consentRows.map((c) => c.student_id))];
    const parentUserIds = [...new Set(consentRows.map((c) => c.parent_user_id))];

    // Fetch students with their user_ids, class_id, and section_id
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, student_id, user_id, class_id, section_id, classes:class_id(name, display_name), sections:section_id(name)')
      .in('id', studentIds);

    throwIfDbError(studentsError);

    const studentRows = (students || []) as Array<{
      id: string;
      student_id: string;
      user_id: string | null;
      class_id: string | null;
      section_id: string | null;
      classes: { name: string; display_name: string } | { name: string; display_name: string }[] | null;
      sections: { name: string } | { name: string }[] | null;
    }>;

    // Get student user IDs
    const studentUserIds = [
      ...new Set(
        studentRows
          .map((s) => s.user_id)
          .filter((id): id is string => !!id),
      ),
    ];

    // Fetch student profiles
    const { data: studentProfiles, error: studentProfilesError } =
      studentUserIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', studentUserIds)
        : { data: [], error: null };

    throwIfDbError(studentProfilesError);

    // Fetch parent profiles
    const { data: parentProfiles, error: parentProfilesError } =
      parentUserIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', parentUserIds)
        : { data: [], error: null };

    throwIfDbError(parentProfilesError);

    // Create maps for quick lookup
    const studentById = new Map(
      studentRows.map((s) => {
        const classData = Array.isArray(s.classes) ? s.classes[0] : s.classes;
        const sectionData = Array.isArray(s.sections) ? s.sections[0] : s.sections;
        return [
          s.id,
          {
            studentId: s.student_id,
            userId: s.user_id,
            className: classData?.display_name || classData?.name,
            sectionName: sectionData?.name,
          },
        ];
      }),
    );
    const studentNameByUserId = new Map(
      (studentProfiles || []).map((p) => [
        (p as { id: string }).id,
        (p as { full_name: string }).full_name,
      ]),
    );
    const parentNameById = new Map(
      (parentProfiles || []).map((p) => [
        (p as { id: string }).id,
        (p as { full_name: string }).full_name,
      ]),
    );

    // Map consents with names
    const consents = consentRows.map((row) => {
      const student = studentById.get(row.student_id);
      const studentName = student?.userId
        ? studentNameByUserId.get(student.userId)
        : undefined;
      const parentName = parentNameById.get(row.parent_user_id);

      return new EventConsentDto({
        id: row.id,
        eventId: row.event_id,
        studentId: row.student_id,
        studentName,
        studentStudentId: student?.studentId,
        className: student?.className,
        sectionName: student?.sectionName,
        parentUserId: row.parent_user_id,
        parentName,
        status: row.status,
        respondedAt: row.responded_at ?? undefined,
        ipAddress: row.ip_address ?? undefined,
        notes: row.notes ?? undefined,
        branchId: row.branch_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    });

    return { data: consents };
  }

  async getConsentStats(
    eventId: string,
    branchId: string,
  ): Promise<{
    approved: number;
    rejected: number;
    pending: number;
    total: number;
  }> {
    const supabase = this.supabaseConfig.getClient();

    // Verify event exists
    await this.getEvent(eventId, branchId);

    const { data, error } = await supabase
      .from('event_consents')
      .select('status')
      .eq('event_id', eventId)
      .eq('branch_id', branchId);

    throwIfDbError(error);

    const consents = (data || []) as Array<{ status: string }>;
    const approved = consents.filter((c) => c.status === 'approved').length;
    const rejected = consents.filter((c) => c.status === 'rejected').length;
    const pending = consents.filter((c) => c.status === 'pending').length;

    return {
      approved,
      rejected,
      pending,
      total: consents.length,
    };
  }

  async submitConsent(
    eventId: string,
    studentId: string,
    status: 'approved' | 'rejected',
    notes: string | undefined,
    ipAddress: string | undefined,
    userId: string,
    branchId: string,
  ): Promise<EventConsentDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify event exists and requires consent
    const event = await this.getEvent(eventId, branchId);
    if (!event.requiresConsent) {
      throw new BadRequestException('Event does not require consent');
    }

    // Verify student exists and belongs to branch
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(studentError);
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Verify parent-student relationship
    const { data: parentStudent, error: parentStudentError } = await supabase
      .from('parent_students')
      .select('id')
      .eq('parent_user_id', userId)
      .eq('student_id', studentId)
      .maybeSingle();

    throwIfDbError(parentStudentError);
    if (!parentStudent) {
      throw new BadRequestException('You are not authorized to provide consent for this student');
    }

    // Upsert consent
    const { data, error } = await supabase
      .from('event_consents')
      .upsert(
        {
          event_id: eventId,
          student_id: studentId,
          parent_user_id: userId,
          status,
          responded_at: new Date().toISOString(),
          ip_address: ipAddress ?? null,
          notes: notes ?? null,
          branch_id: branchId,
        },
        {
          onConflict: 'event_id,student_id,parent_user_id',
        },
      )
      .select('*')
      .single();

    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException('Failed to submit consent');
    }

    // Send notification to event creator
    await this.notifyConsentSubmitted(
      eventId,
      event.createdBy,
      studentId,
      userId,
      status,
      branchId,
    );

    return mapEventConsent(data as EventConsentRow);
  }

  /**
   * Returns counts of upcoming/ongoing events and how many of them have conflicts
   * (assessment or overlapping event). "Upcoming" = not yet ended (end_date >= today).
   * Overlap is checked against all events in the branch/year, not just the upcoming set.
   */
  async getUpcomingEventsConflictCount(
    branchId: string,
  ): Promise<{ totalUpcoming: number; eventsWithConflicts: number }> {
    const supabase = this.supabaseConfig.getClient();
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      return { totalUpcoming: 0, eventsWithConflicts: 0 };
    }
    const today = new Date().toISOString().split('T')[0];
    // Include ongoing and upcoming: events that have not ended yet (end_date >= today)
    const { data: eventsData } = await supabase
      .from('events')
      .select('id, start_date, end_date')
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id)
      .gte('end_date', today)
      .order('start_date', { ascending: true });
    const events = (eventsData || []) as Array<{ id: string; start_date: string; end_date: string }>;
    if (events.length === 0) {
      return { totalUpcoming: 0, eventsWithConflicts: 0 };
    }
    const eventIds = events.map((e) => e.id);
    const { data: participants } = await supabase
      .from('event_participants')
      .select('event_id, class_section_id')
      .in('event_id', eventIds)
      .eq('branch_id', branchId)
      .not('class_section_id', 'is', null);
    const eventToSections = new Map<string, string[]>();
    for (const p of participants || []) {
      const eid = p.event_id as string;
      const cid = p.class_section_id as string;
      if (!eventToSections.has(eid)) eventToSections.set(eid, []);
      const arr = eventToSections.get(eid)!;
      if (!arr.includes(cid)) arr.push(cid);
    }
    const allSectionIds = [...new Set((participants || []).map((p) => p.class_section_id as string))];
    const eventIdsWithConflict = new Set<string>();
    if (allSectionIds.length > 0) {
      const minStart = events.reduce((a, e) => (e.start_date < a ? e.start_date : a), events[0].start_date);
      const maxEnd = events.reduce((a, e) => (e.end_date > a ? e.end_date : a), events[0].end_date);
      const { data: assessments } = await supabase
        .from('assessments')
        .select('class_section_id, due_date')
        .eq('branch_id', branchId)
        .in('class_section_id', allSectionIds)
        .gte('due_date', minStart)
        .lte('due_date', maxEnd);
      for (const event of events) {
        const sections = eventToSections.get(event.id) ?? [];
        if (sections.length === 0) continue;
        const hasAssessment = (assessments || []).some(
          (a) =>
            sections.includes(a.class_section_id as string) &&
            (a.due_date as string) >= event.start_date &&
            (a.due_date as string) <= event.end_date,
        );
        if (hasAssessment) eventIdsWithConflict.add(event.id);
      }
    }
    // Fetch all events in branch/year to detect overlap (same logic as getConflicts)
    const { data: allEventsData } = await supabase
      .from('events')
      .select('id, start_date, end_date')
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id);
    const allEvents = (allEventsData || []) as Array<{ id: string; start_date: string; end_date: string }>;
    for (const event of events) {
      const hasOverlap = allEvents.some(
        (other) =>
          other.id !== event.id &&
          other.start_date <= event.end_date &&
          other.end_date >= event.start_date,
      );
      if (hasOverlap) eventIdsWithConflict.add(event.id);
    }
    return {
      totalUpcoming: events.length,
      eventsWithConflicts: eventIdsWithConflict.size,
    };
  }

  async getConflicts(
    eventId: string,
    branchId: string,
  ): Promise<{
    assessmentConflicts: Array<{
      id: string;
      title: string;
      dueDate: string;
      classSectionId: string;
      className?: string;
      sectionName?: string;
      classTeacherName?: string;
      subjectName?: string;
    }>;
    eventConflicts: Array<{ id: string; title: string; startDate: string; endDate: string }>;
  }> {
    const supabase = this.supabaseConfig.getClient();

    const event = await this.getEvent(eventId, branchId);

    // Get participating class sections
    const { data: participants } = await supabase
      .from('event_participants')
      .select('class_section_id')
      .eq('event_id', eventId)
      .not('class_section_id', 'is', null);

    const classSectionIds = [
      ...new Set(
        (participants || [])
          .map((p) => p.class_section_id as string)
          .filter((id): id is string => !!id),
      ),
    ];

    if (classSectionIds.length === 0) {
      return { assessmentConflicts: [], eventConflicts: [] };
    }

    // Check assessment conflicts
    const { data: assessments } = await supabase
      .from('assessments')
      .select('id, title, due_date, class_section_id, subject_id')
      .in('class_section_id', classSectionIds)
      .eq('branch_id', branchId)
      .gte('due_date', event.startDate)
      .lte('due_date', event.endDate);

    const assessmentRows =
      (assessments || []) as Array<{
        id: string;
        title: string;
        due_date: string;
        class_section_id: string;
        subject_id: string;
      }>;

    const subjectIds = [
      ...new Set(assessmentRows.map((a) => a.subject_id).filter((id) => !!id)),
    ];
    const classSectionIdsForAssessments = [
      ...new Set(assessmentRows.map((a) => a.class_section_id).filter((id) => !!id)),
    ];

    // Load subject names in a single query
    let subjectNameById = new Map<string, string>();
    if (subjectIds.length > 0) {
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);
      subjectNameById = new Map(
        (subjects || []).map((s: any) => [s.id as string, s.name as string]),
      );
    }

    // Load class section details (including class/section names and class teacher) via service
    const classSectionById = new Map<string, import('../class-sections/dto/class-section.dto').ClassSectionDto>();
    for (const csId of classSectionIdsForAssessments) {
      const classSection = await this.classSectionsService.getClassSectionById(
        csId,
        branchId,
      );
      classSectionById.set(csId, classSection);
    }

    const assessmentConflicts = assessmentRows.map((a) => {
      const cs = classSectionById.get(a.class_section_id);
      const subjectName = subjectNameById.get(a.subject_id);
      return {
        id: a.id,
        title: a.title,
        dueDate: a.due_date,
        classSectionId: a.class_section_id,
        className: cs?.classDisplayName || cs?.className,
        sectionName: cs?.sectionName,
        classTeacherName: cs?.classTeacherName,
        subjectName,
      };
    });

    // Check event conflicts
    const { data: conflictingEvents } = await supabase
      .from('events')
      .select('id, title, start_date, end_date')
      .neq('id', eventId)
      .eq('branch_id', branchId)
      .or(
        `and(start_date.lte.${event.endDate},end_date.gte.${event.startDate})`,
      );

    const eventConflicts = (conflictingEvents || []).map((e) => ({
      id: e.id as string,
      title: e.title as string,
      startDate: e.start_date as string,
      endDate: e.end_date as string,
    }));

    return { assessmentConflicts, eventConflicts };
  }

  async checkConflicts(
    startDate: string,
    endDate: string,
    classSectionIds: string[],
    branchId: string,
  ): Promise<{
    assessmentConflicts: Array<{
      id: string;
      title: string;
      dueDate: string;
      classSectionId: string;
      className?: string;
      sectionName?: string;
      classTeacherName?: string;
      subjectName?: string;
    }>;
    eventConflicts: Array<{ id: string; title: string; startDate: string; endDate: string }>;
  }> {
    const supabase = this.supabaseConfig.getClient();

    if (classSectionIds.length === 0) {
      return { assessmentConflicts: [], eventConflicts: [] };
    }

    // Check assessment conflicts
    const { data: assessments } = await supabase
      .from('assessments')
      .select('id, title, due_date, class_section_id, subject_id')
      .in('class_section_id', classSectionIds)
      .eq('branch_id', branchId)
      .gte('due_date', startDate)
      .lte('due_date', endDate);

    const assessmentRows =
      (assessments || []) as Array<{
        id: string;
        title: string;
        due_date: string;
        class_section_id: string;
        subject_id: string;
      }>;

    const subjectIds = [
      ...new Set(assessmentRows.map((a) => a.subject_id).filter((id) => !!id)),
    ];
    const classSectionIdsForAssessments = [
      ...new Set(assessmentRows.map((a) => a.class_section_id).filter((id) => !!id)),
    ];

    let subjectNameById = new Map<string, string>();
    if (subjectIds.length > 0) {
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);
      subjectNameById = new Map(
        (subjects || []).map((s: any) => [s.id as string, s.name as string]),
      );
    }

    const classSectionById = new Map<string, import('../class-sections/dto/class-section.dto').ClassSectionDto>();
    for (const csId of classSectionIdsForAssessments) {
      const classSection = await this.classSectionsService.getClassSectionById(
        csId,
        branchId,
      );
      classSectionById.set(csId, classSection);
    }

    const assessmentConflicts = assessmentRows.map((a) => {
      const cs = classSectionById.get(a.class_section_id);
      const subjectName = subjectNameById.get(a.subject_id);
      return {
        id: a.id,
        title: a.title,
        dueDate: a.due_date,
        classSectionId: a.class_section_id,
        className: cs?.classDisplayName || cs?.className,
        sectionName: cs?.sectionName,
        classTeacherName: cs?.classTeacherName,
        subjectName,
      };
    });

    // Check event conflicts (overlapping events)
    // Events overlap if: startDate <= other.endDate && endDate >= other.startDate
    const { data: conflictingEvents } = await supabase
      .from('events')
      .select('id, title, start_date, end_date')
      .eq('branch_id', branchId)
      .or(
        `and(start_date.lte.${endDate},end_date.gte.${startDate})`,
      );

    const eventConflicts = (conflictingEvents || []).map((e) => ({
      id: e.id as string,
      title: e.title as string,
      startDate: e.start_date as string,
      endDate: e.end_date as string,
    }));

    return { assessmentConflicts, eventConflicts };
  }

  async getMyEvents(
    userId: string,
    branchId: string,
    userRoles: string[],
  ): Promise<{ data: EventDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }

    let eventIds: string[] = [];
    let currentStudentId: string | null = null;

    // If parent, get events for their children
    if (userRoles.includes('parent')) {
      const { data: parentStudents } = await supabase
        .from('parent_students')
        .select('student_id')
        .eq('parent_user_id', userId);

      const studentIds = [
        ...new Set(
          (parentStudents || []).map((ps) => ps.student_id as string),
        ),
      ];

      if (studentIds.length > 0) {
        // Get class-section IDs for these students
        const { data: students } = await supabase
          .from('students')
          .select('id, class_id, section_id')
          .in('id', studentIds);

        // Build class-section lookup
        const classSectionConditions: { classId: string; sectionId: string }[] = [];
        for (const student of students || []) {
          if (student.class_id && student.section_id) {
            classSectionConditions.push({
              classId: student.class_id as string,
              sectionId: student.section_id as string,
            });
          }
        }

        if (classSectionConditions.length > 0) {
          // Get class-section IDs
          const { data: classSections } = await supabase
            .from('class_sections')
            .select('id, class_id, section_id, branch_id, academic_year_id')
            .eq('branch_id', branchId)
            .eq('academic_year_id', activeYear.id);

          const classSectionIds: string[] = [];
          for (const cs of classSections || []) {
            for (const condition of classSectionConditions) {
              if (cs.class_id === condition.classId && cs.section_id === condition.sectionId) {
                classSectionIds.push(cs.id as string);
              }
            }
          }

          // Query event_participants for both student_id and class_section_id
          const { data: participantsByStudent } = await supabase
            .from('event_participants')
            .select('event_id')
            .in('student_id', studentIds);

          const { data: participantsByClass } = await supabase
            .from('event_participants')
            .select('event_id')
            .in('class_section_id', classSectionIds);

          const allParticipants = [
            ...(participantsByStudent || []),
            ...(participantsByClass || []),
          ];

          eventIds = [
            ...new Set(allParticipants.map((p) => p.event_id as string)),
          ];
        }
      }
    }

    // If teacher, get events for their assigned classes
    if (userRoles.includes('class_teacher') || userRoles.includes('subject_teacher')) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', userId)
        .eq('branch_id', branchId)
        .maybeSingle();

      if (staff) {
        // Get class sections where user is class teacher
        const { data: classSections } = await supabase
          .from('class_sections')
          .select('id')
          .eq('class_teacher_id', (staff as { id: string }).id)
          .eq('branch_id', branchId)
          .eq('academic_year_id', activeYear.id);

        const classSectionIds = [
          ...new Set((classSections || []).map((cs) => cs.id as string)),
        ];

        if (classSectionIds.length > 0) {
          const { data: participants } = await supabase
            .from('event_participants')
            .select('event_id')
            .in('class_section_id', classSectionIds);

          const teacherEventIds = [
            ...new Set((participants || []).map((p) => p.event_id as string)),
          ];
          eventIds = [...new Set([...eventIds, ...teacherEventIds])];
        }

        // Get events where user is assigned as subject teacher
        const { data: teacherAssignments } = await supabase
          .from('teacher_assignments')
          .select('class_section_id')
          .eq('staff_id', (staff as { id: string }).id)
          .eq('branch_id', branchId)
          .eq('academic_year_id', activeYear.id);

        const assignedClassSectionIds = [
          ...new Set(
            (teacherAssignments || []).map((ta) => ta.class_section_id as string),
          ),
        ];

        if (assignedClassSectionIds.length > 0) {
          const { data: participants } = await supabase
            .from('event_participants')
            .select('event_id')
            .in('class_section_id', assignedClassSectionIds);

          const assignedEventIds = [
            ...new Set((participants || []).map((p) => p.event_id as string)),
          ];
          eventIds = [...new Set([...eventIds, ...assignedEventIds])];
        }
      }
    }

    // If student, get events they're participating in
    if (userRoles.includes('student')) {
      const { data: student } = await supabase
        .from('students')
        .select('id, class_id, section_id')
        .eq('user_id', userId)
        .eq('branch_id', branchId)
        .maybeSingle();

      if (student) {
        const studentData = student as { id: string; class_id: string | null; section_id: string | null };
        currentStudentId = studentData.id;

        // Check for events assigned directly to the student
        const { data: directParticipants } = await supabase
          .from('event_participants')
          .select('event_id')
          .eq('student_id', studentData.id);

        let studentEventIds = [
          ...new Set((directParticipants || []).map((p) => p.event_id as string)),
        ];

        // Also check for events assigned to their class-section
        if (studentData.class_id && studentData.section_id) {
          const { data: classSection } = await supabase
            .from('class_sections')
            .select('id')
            .eq('class_id', studentData.class_id)
            .eq('section_id', studentData.section_id)
            .eq('branch_id', branchId)
            .eq('academic_year_id', activeYear.id)
            .maybeSingle();

          if (classSection) {
            const { data: classParticipants } = await supabase
              .from('event_participants')
              .select('event_id')
              .eq('class_section_id', (classSection as { id: string }).id);

            const classEventIds = [
              ...new Set((classParticipants || []).map((p) => p.event_id as string)),
            ];
            studentEventIds = [...new Set([...studentEventIds, ...classEventIds])];
          }
        }

        eventIds = [...new Set([...eventIds, ...studentEventIds])];
      }
    }

    if (eventIds.length === 0) {
      return { data: [] };
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .in('id', eventIds)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id)
      .order('start_date', { ascending: true });

    throwIfDbError(error);

    const events = (data || []).map((row) => mapEvent(row, 'ar'));

    // For students, attach their latest consent status for each event (when events require consent).
    if (userRoles.includes('student') && currentStudentId) {
      const consentEventIds = events.filter((e) => e.requiresConsent).map((e) => e.id);
      if (consentEventIds.length > 0) {
        const { data: consentRows, error: consentError } = await supabase
          .from('event_consents')
          .select('event_id, status, responded_at')
          .in('event_id', consentEventIds)
          .eq('student_id', currentStudentId)
          .order('responded_at', { ascending: false });
        throwIfDbError(consentError);

        const latestByEventId = new Map<
          string,
          { status: 'pending' | 'approved' | 'rejected'; respondedAt?: string }
        >();
        for (const r of (consentRows || []) as Array<{ event_id: string; status: string; responded_at: string | null }>) {
          const eventId = r.event_id;
          if (latestByEventId.has(eventId)) continue;
          latestByEventId.set(eventId, {
            status: (r.status as 'pending' | 'approved' | 'rejected') ?? 'pending',
            respondedAt: r.responded_at ?? undefined,
          });
        }

        for (const e of events) {
          const latest = latestByEventId.get(e.id);
          if (latest) {
            e.studentConsentStatus = latest.status;
            e.studentConsentRespondedAt = latest.respondedAt;
          } else if (e.requiresConsent) {
            e.studentConsentStatus = 'pending';
          }
        }
      }
    }

    // For parents, populate student names for each event
    if (userRoles.includes('parent')) {
      // Get parent's student IDs
      const { data: parentStudents } = await supabase
        .from('parent_students')
        .select('student_id')
        .eq('parent_user_id', userId);

      const parentStudentIds = [
        ...new Set((parentStudents || []).map((ps) => ps.student_id as string)),
      ];

      if (parentStudentIds.length > 0) {
        // Get student details with user_id
        const { data: students } = await supabase
          .from('students')
          .select('id, user_id, class_id, section_id')
          .in('id', parentStudentIds);

        // Fetch student names from profiles via user_id
        const userIds = (students || [])
          .map((s) => s.user_id as string | null)
          .filter((id) => !!id) as string[];
        const uniqueUserIds = Array.from(new Set(userIds));

        const profilesMap = new Map<string, string>();
        if (uniqueUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', uniqueUserIds);

          for (const p of profiles ?? []) {
            profilesMap.set((p as any).id as string, (p as any).full_name as string);
          }
        }

        // Create a map of student ID to full name
        const studentNamesMap = new Map<string, string>();
        for (const student of students || []) {
          const userId = student.user_id as string | undefined;
          const fullName = userId ? profilesMap.get(userId) : undefined;
          if (fullName) {
            studentNamesMap.set(student.id as string, fullName);
          }
        }

        // For each event, find which of the parent's children are involved
        for (const event of events) {
          const involvedStudentNames: string[] = [];

          // Get event participants
          const { data: participants } = await supabase
            .from('event_participants')
            .select('class_section_id, student_id')
            .eq('event_id', event.id);

          for (const participant of participants || []) {
            // Check if directly assigned to a student
            if (participant.student_id) {
              const studentName = studentNamesMap.get(participant.student_id as string);
              if (studentName) {
                involvedStudentNames.push(studentName);
              }
            }
            // Check if assigned to a class-section
            else if (participant.class_section_id) {
              const { data: classSection } = await supabase
                .from('class_sections')
                .select('class_id, section_id')
                .eq('id', participant.class_section_id as string)
                .maybeSingle();

              if (classSection) {
                // Find students in this class-section
                for (const student of students || []) {
                  if (
                    student.class_id === classSection.class_id &&
                    student.section_id === classSection.section_id
                  ) {
                    const studentName = studentNamesMap.get(student.id as string);
                    if (studentName) {
                      involvedStudentNames.push(studentName);
                    }
                  }
                }
              }
            }
          }

          // Remove duplicates and add to event
          event.studentNames = [...new Set(involvedStudentNames)];

          // If event requires consent, fetch consent statuses for parent's children
          if (event.requiresConsent) {
            const involvedStudentIds = new Set<string>();
            
            // Collect involved student IDs (same logic as above)
            for (const participant of participants || []) {
              // Check if directly assigned to a student
              if (participant.student_id && parentStudentIds.includes(participant.student_id as string)) {
                involvedStudentIds.add(participant.student_id as string);
              }
              // Check if assigned to a class-section
              else if (participant.class_section_id) {
                const { data: classSection } = await supabase
                  .from('class_sections')
                  .select('class_id, section_id')
                  .eq('id', participant.class_section_id as string)
                  .maybeSingle();

                if (classSection) {
                  // Find students in this class-section that belong to parent
                  for (const student of students || []) {
                    if (
                      student.class_id === classSection.class_id &&
                      student.section_id === classSection.section_id &&
                      parentStudentIds.includes(student.id as string)
                    ) {
                      involvedStudentIds.add(student.id as string);
                    }
                  }
                }
              }
            }

            // Fetch consent statuses for involved students
            if (involvedStudentIds.size > 0) {
              const studentIdsArray = Array.from(involvedStudentIds);
              const { data: consents } = await supabase
                .from('event_consents')
                .select('student_id, status, responded_at')
                .eq('event_id', event.id)
                .eq('parent_user_id', userId)
                .in('student_id', studentIdsArray);

              // Map consent statuses with student names
              const consentStatuses: Array<{
                studentId: string;
                studentName: string;
                status: 'pending' | 'approved' | 'rejected';
                respondedAt?: string;
              }> = [];

              for (const studentId of studentIdsArray) {
                const studentName = studentNamesMap.get(studentId);
                if (studentName) {
                  const consent = (consents || []).find(c => c.student_id === studentId);
                  consentStatuses.push({
                    studentId,
                    studentName,
                    status: consent?.status || 'pending',
                    respondedAt: consent?.responded_at || undefined,
                  });
                }
              }

              event.consentStatuses = consentStatuses;
            }
          }
        }
      }
    }

    return { data: events };
  }

  private async createInitialConsents(
    eventId: string,
    branchId: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    // Get all students participating in the event
    const { data: participants } = await supabase
      .from('event_participants')
      .select('class_section_id, student_id')
      .eq('event_id', eventId);

    const studentIds = new Set<string>();

    for (const participant of participants || []) {
      if (participant.student_id) {
        studentIds.add(participant.student_id as string);
      } else if (participant.class_section_id) {
        // Get class section details
        const { data: classSection } = await supabase
          .from('class_sections')
          .select('class_id, section_id, academic_year_id')
          .eq('id', participant.class_section_id as string)
          .maybeSingle();

        if (classSection) {
          // Get all active students in the class section for that academic year via enrolments.
          const { data: enrolments } = await supabase
            .from('student_enrolments')
            .select('student_id')
            .eq('branch_id', branchId)
            .eq('academic_year_id', (classSection as { academic_year_id: string }).academic_year_id)
            .eq('class_id', classSection.class_id as string)
            .eq('section_id', classSection.section_id as string)
            .eq('status', 'active');
          (enrolments || []).forEach((e) => {
            studentIds.add((e as { student_id: string }).student_id);
          });
        }
      }
    }

    // Get all parents for these students
    const { data: parentStudents } = await supabase
      .from('parent_students')
      .select('parent_user_id, student_id')
      .in('student_id', Array.from(studentIds));

    // Create pending consents
    const consents: Array<{
      event_id: string;
      student_id: string;
      parent_user_id: string;
      status: 'pending';
      branch_id: string;
    }> = [];

    for (const ps of parentStudents || []) {
      consents.push({
        event_id: eventId,
        student_id: ps.student_id as string,
        parent_user_id: ps.parent_user_id as string,
        status: 'pending',
        branch_id: branchId,
      });
    }

    if (consents.length > 0) {
      await supabase.from('event_consents').upsert(consents, {
        onConflict: 'event_id,student_id,parent_user_id',
        ignoreDuplicates: true,
      });
    }
  }

  private async notifyEventCreated(eventId: string, branchId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const event = await this.getEvent(eventId, branchId);

    // Get all participants (students and parents)
    const { data: participants } = await supabase
      .from('event_participants')
      .select('class_section_id, student_id')
      .eq('event_id', eventId);

    const userIds = new Set<string>();

    for (const participant of participants || []) {
      if (participant.student_id) {
        // Get student user_id
        const { data: student } = await supabase
          .from('students')
          .select('user_id')
          .eq('id', participant.student_id as string)
          .maybeSingle();

        if (student?.user_id) {
          userIds.add(student.user_id as string);
        }

        // Get parent user_ids
        const { data: parentStudents } = await supabase
          .from('parent_students')
          .select('parent_user_id')
          .eq('student_id', participant.student_id as string);

        (parentStudents || []).forEach((ps) => {
          userIds.add(ps.parent_user_id as string);
        });
      } else if (participant.class_section_id) {
        // Get class section details
        const { data: classSection } = await supabase
          .from('class_sections')
          .select('class_id, section_id')
          .eq('id', participant.class_section_id as string)
          .maybeSingle();

        if (classSection) {
          // Get all students in class section
          const { data: students } = await supabase
            .from('students')
            .select('id, user_id')
            .eq('class_id', classSection.class_id as string)
            .eq('section_id', classSection.section_id as string)
            .eq('branch_id', branchId);

          (students || []).forEach((s) => {
            if (s.user_id) {
              userIds.add(s.user_id as string);
            }
          });

          // Get parents for these students
          const studentIds = (students || []).map((s) => s.id as string);
          if (studentIds.length > 0) {
            const { data: parentStudents } = await supabase
              .from('parent_students')
              .select('parent_user_id')
              .in('student_id', studentIds);

            (parentStudents || []).forEach((ps) => {
              userIds.add(ps.parent_user_id as string);
            });
          }
        }

        // Get class teacher
        if (classSection) {
          const { data: classSectionForTeacher } = await supabase
            .from('class_sections')
            .select('class_teacher_id')
            .eq('id', participant.class_section_id as string)
            .maybeSingle();

          if (classSectionForTeacher?.class_teacher_id) {
            const { data: staff } = await supabase
              .from('staff')
              .select('user_id')
              .eq('id', classSectionForTeacher.class_teacher_id as string)
              .maybeSingle();

            if (staff?.user_id) {
              userIds.add(staff.user_id as string);
            }
          }
        }
      }
    }

    // Create notifications
    for (const userId of userIds) {
      await this.notificationsService.createNotification({
        userId,
        type: 'event_created',
        title: 'New Event: ' + event.title,
        body: `A new event "${event.title}" has been scheduled from ${event.startDate} to ${event.endDate}.`,
        data: { eventId: event.id },
      });
    }
  }

  private async notifyEventUpdated(eventId: string, branchId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const event = await this.getEvent(eventId, branchId);

    // Get all participants (same logic as notifyEventCreated)
    const { data: participants } = await supabase
      .from('event_participants')
      .select('class_section_id, student_id')
      .eq('event_id', eventId);

    const userIds = new Set<string>();

    for (const participant of participants || []) {
      if (participant.student_id) {
        const { data: student } = await supabase
          .from('students')
          .select('user_id')
          .eq('id', participant.student_id as string)
          .maybeSingle();

        if (student?.user_id) {
          userIds.add(student.user_id as string);
        }

        const { data: parentStudents } = await supabase
          .from('parent_students')
          .select('parent_user_id')
          .eq('student_id', participant.student_id as string);

        (parentStudents || []).forEach((ps) => {
          userIds.add(ps.parent_user_id as string);
        });
      } else if (participant.class_section_id) {
        // Get class section details
        const { data: classSectionData } = await supabase
          .from('class_sections')
          .select('class_id, section_id, class_teacher_id')
          .eq('id', participant.class_section_id as string)
          .maybeSingle();

        if (classSectionData) {
          const { data: students } = await supabase
            .from('students')
            .select('id, user_id')
            .eq('class_id', classSectionData.class_id as string)
            .eq('section_id', classSectionData.section_id as string)
            .eq('branch_id', branchId);

          (students || []).forEach((s) => {
            if (s.user_id) {
              userIds.add(s.user_id as string);
            }
          });

          const studentIds = (students || []).map((s) => s.id as string);
          if (studentIds.length > 0) {
            const { data: parentStudents } = await supabase
              .from('parent_students')
              .select('parent_user_id')
              .in('student_id', studentIds);

            (parentStudents || []).forEach((ps) => {
              userIds.add(ps.parent_user_id as string);
            });
          }

          if (classSectionData.class_teacher_id) {
            const { data: staff } = await supabase
              .from('staff')
              .select('user_id')
              .eq('id', classSectionData.class_teacher_id as string)
              .maybeSingle();

            if (staff?.user_id) {
              userIds.add(staff.user_id as string);
            }
          }
        }
      }
    }

    // Create notifications
    for (const userId of userIds) {
      await this.notificationsService.createNotification({
        userId,
        type: 'event_updated',
        title: 'Event Updated: ' + event.title,
        body: `The event "${event.title}" has been updated.`,
        data: { eventId: event.id },
      });
    }
  }

  private async notifyConsentSubmitted(
    eventId: string,
    eventCreatorUserId: string,
    studentId: string,
    parentUserId: string,
    status: 'approved' | 'rejected',
    branchId: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    // Get event details
    const event = await this.getEvent(eventId, branchId);

    // Get student name
    const { data: student } = await supabase
      .from('students')
      .select('user_id, class_id, section_id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .maybeSingle();

    let studentName = 'Student';
    const studentUserId = (student as { user_id?: string | null } | null)?.user_id ?? null;
    if (student?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', student.user_id as string)
        .maybeSingle();
      if (profile?.full_name) {
        studentName = profile.full_name as string;
      }
    }

    // Get parent name
    const { data: parentProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', parentUserId)
      .maybeSingle();

    const parentName = parentProfile?.full_name || 'Parent';

    const title = `Event Consent ${status === 'approved' ? 'Approved' : 'Rejected'}: ${event.title}`;
    const body = `${parentName} has ${status === 'approved' ? 'approved' : 'rejected'} consent for ${studentName} to participate in "${event.title}".`;

    const notifyUserIds = new Set<string>();
    if (eventCreatorUserId) notifyUserIds.add(eventCreatorUserId);
    if (studentUserId) notifyUserIds.add(studentUserId);

    // Notify the student's class teacher (if available) so teachers see the consent without needing to open the event.
    const classId = (student as { class_id?: string | null } | null)?.class_id ?? null;
    const sectionId = (student as { section_id?: string | null } | null)?.section_id ?? null;
    if (classId && sectionId && event.academicYearId) {
      const { data: cs } = await supabase
        .from('class_sections')
        .select('class_teacher_id, staff:class_teacher_id(user_id)')
        .eq('branch_id', branchId)
        .eq('academic_year_id', event.academicYearId)
        .eq('class_id', classId)
        .eq('section_id', sectionId)
        .maybeSingle();
      const staffUserId = (cs as { staff?: { user_id?: string | null } | null } | null)?.staff?.user_id ?? null;
      if (staffUserId) notifyUserIds.add(staffUserId);
    }

    // Avoid spamming the acting parent.
    notifyUserIds.delete(parentUserId);

    await Promise.all(
      [...notifyUserIds].map((uid) =>
        this.notificationsService.createNotification({
          userId: uid,
          type: 'event_consent_submitted',
          title,
          body,
          data: { eventId, studentId, status },
        }),
      ),
    ).catch(() => {});
  }
}

