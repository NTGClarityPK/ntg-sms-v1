import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
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

function mapEvent(row: EventRow): EventDto {
  return new EventDto({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
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

function mapEventParticipant(row: EventParticipantRow): EventParticipantDto {
  return new EventParticipantDto({
    id: row.id,
    eventId: row.event_id,
    classSectionId: row.class_section_id ?? undefined,
    studentId: row.student_id ?? undefined,
    branchId: row.branch_id,
    createdAt: row.created_at,
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

    const events = (data as EventRow[]).map(mapEvent);

    // Filter by class section if provided
    if (query.classSectionId) {
      const eventIds = events.map((e) => e.id);
      const { data: participants } = await supabase
        .from('event_participants')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('class_section_id', query.classSectionId);

      const participantEventIds = new Set(
        (participants || []).map((p) => p.event_id as string),
      );
      const filteredEvents = events.filter((e) => participantEventIds.has(e.id));

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

  async getEvent(id: string, branchId: string): Promise<EventDto> {
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

    const event = mapEvent(data as EventRow);

    // Fetch participants for this event
    const { data: participantsData, error: participantsError } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', id)
      .eq('branch_id', branchId);

    throwIfDbError(participantsError);

    const participants = (participantsData || []).map(mapEventParticipant);
    event.participants = participants;

    return event;
  }

  async createEvent(
    input: CreateEventDto,
    branchId: string,
    userId: string,
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

    // Create event
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .insert({
        title: input.title,
        description: input.description ?? null,
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

    const event = mapEvent(eventData as EventRow);

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

    return mapEvent(data as EventRow);
  }

  async deleteEvent(id: string, branchId: string): Promise<{ id: string }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: existingError } = await supabase
      .from('events')
      .select('id')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(existingError);
    if (!existing) {
      throw new NotFoundException('Event not found');
    }

    // Delete event (cascade will delete participants and consents)
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    throwIfDbError(error);

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

    return mapEventConsent(data as EventConsentRow);
  }

  async getConflicts(
    eventId: string,
    branchId: string,
  ): Promise<{
    assessmentConflicts: Array<{ id: string; title: string; dueDate: string; classSectionId: string }>;
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
      .select('id, title, due_date, class_section_id')
      .in('class_section_id', classSectionIds)
      .eq('branch_id', branchId)
      .gte('due_date', event.startDate)
      .lte('due_date', event.endDate);

    const assessmentConflicts = (assessments || []).map((a) => ({
      id: a.id as string,
      title: a.title as string,
      dueDate: a.due_date as string,
      classSectionId: a.class_section_id as string,
    }));

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
        const { data: participants } = await supabase
          .from('event_participants')
          .select('event_id')
          .in('student_id', studentIds);

        eventIds = [
          ...new Set((participants || []).map((p) => p.event_id as string)),
        ];
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
        .select('id')
        .eq('user_id', userId)
        .eq('branch_id', branchId)
        .maybeSingle();

      if (student) {
        const { data: participants } = await supabase
          .from('event_participants')
          .select('event_id')
          .eq('student_id', (student as { id: string }).id);

        const studentEventIds = [
          ...new Set((participants || []).map((p) => p.event_id as string)),
        ];
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

    const events = (data || []).map(mapEvent);

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
          .select('class_id, section_id')
          .eq('id', participant.class_section_id as string)
          .maybeSingle();

        if (classSection) {
          // Get all students in the class section
          const { data: students } = await supabase
            .from('students')
            .select('id')
            .eq('class_id', classSection.class_id as string)
            .eq('section_id', classSection.section_id as string)
            .eq('branch_id', branchId);

          (students || []).forEach((s) => {
            studentIds.add(s.id as string);
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
}

