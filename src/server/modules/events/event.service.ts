import { NotFoundError, ValidationError } from '../../shared/errors.ts';
import { findAcademicYearById } from '../academic-years/academic-year.repository.ts';
import { recordAuditEvent } from '../audit/audit.service.ts';
import * as repo from './event.repository.ts';
import type {
  CreateSchoolEventInput,
  ListEventsQuery,
  UpdateSchoolEventInput,
} from './event.schema.ts';
import type {
  EventTargetAudience,
  SchoolEventItem,
  SchoolEventRecord,
  UpcomingEventsResponse,
  UpcomingEventsSummary,
} from './event.types.ts';

interface ActorContext {
  id: number;
  email: string;
  roleCodes: string[];
  ipAddress?: string;
}

const FULL_AUDIENCE_ROLES = new Set([
  'ADMIN',
  'PRINCIPAL',
  'SECRETARY',
  'SUPERVISOR',
  'ACCOUNTANT',
]);

export function resolveAllowedAudiences(roleCodes: string[]): EventTargetAudience[] {
  const allowed = new Set<EventTargetAudience>(['ALL']);

  for (const code of roleCodes) {
    if (FULL_AUDIENCE_ROLES.has(code)) {
      return ['ALL', 'STAFF', 'TEACHERS', 'STUDENTS_PARENTS'];
    }
    if (code === 'TEACHER') {
      allowed.add('STAFF');
      allowed.add('TEACHERS');
    }
    if (code === 'STUDENT' || code === 'PARENT') {
      allowed.add('STUDENTS_PARENTS');
    }
  }

  return Array.from(allowed);
}

export function computeDaysUntil(startDate: string, referenceDate?: string): number {
  const todayStr = referenceDate ?? new Date().toISOString().slice(0, 10);
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const refMs = Date.parse(`${todayStr}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(refMs)) return 0;
  return Math.round((startMs - refMs) / 86_400_000);
}

function enrichEvent(record: SchoolEventRecord, referenceDate?: string): SchoolEventItem {
  const todayStr = referenceDate ?? new Date().toISOString().slice(0, 10);
  const daysUntil = computeDaysUntil(record.startDate, todayStr);
  const endLimit = record.endDate ?? record.startDate;
  const isOngoing = record.startDate <= todayStr && endLimit >= todayStr && daysUntil < 0;
  const isUrgent = endLimit >= todayStr && daysUntil <= 3;

  return {
    ...record,
    daysUntil,
    isOngoing,
    isUrgent,
  };
}

export async function listUpcomingEvents(
  query: ListEventsQuery,
  roleCodes: string[]
): Promise<UpcomingEventsResponse> {
  const allowedAudiences = resolveAllowedAudiences(roleCodes);
  const todayStr = new Date().toISOString().slice(0, 10);

  const [records, allUpcomingRecords] = await Promise.all([
    repo.findVisibleEvents({
      allowedAudiences,
      category: query.category,
      includePast: query.includePast,
      limit: query.limit,
    }),
    repo.findAllUpcomingForSummary(allowedAudiences),
  ]);

  const summary: UpcomingEventsSummary = {
    totalUpcoming: allUpcomingRecords.length,
    withinSevenDays: 0,
    examCount: 0,
    meetingCount: 0,
    holidayCount: 0,
    otherCount: 0,
  };

  for (const ev of allUpcomingRecords) {
    const d = computeDaysUntil(ev.startDate, todayStr);
    if (d <= 7) {
      summary.withinSevenDays += 1;
    }
    if (ev.category === 'EXAM') summary.examCount += 1;
    else if (ev.category === 'MEETING') summary.meetingCount += 1;
    else if (ev.category === 'HOLIDAY') summary.holidayCount += 1;
    else summary.otherCount += 1;
  }

  return {
    items: records.map((r) => enrichEvent(r, todayStr)),
    summary,
  };
}

export async function createSchoolEvent(
  input: CreateSchoolEventInput,
  actor: ActorContext
): Promise<SchoolEventItem> {
  if (input.academicYearId !== undefined && input.academicYearId !== null) {
    const year = await findAcademicYearById(input.academicYearId);
    if (!year) {
      throw new NotFoundError('Année scolaire associée introuvable.');
    }
  }

  const created = await repo.insertSchoolEvent({
    title: input.title,
    category: input.category,
    description: input.description ?? '',
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    startTime: input.startTime ?? '',
    location: input.location ?? '',
    targetAudience: input.targetAudience ?? 'ALL',
    academicYearId: input.academicYearId ?? null,
    createdByUserId: actor.id,
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'SCHOOL_EVENT_CREATED',
    entityType: 'SCHOOL_EVENT',
    entityId: String(created.id),
    details: {
      title: created.title,
      category: created.category,
      startDate: created.startDate,
      targetAudience: created.targetAudience,
    },
    ipAddress: actor.ipAddress,
  });

  return enrichEvent(created);
}

export async function updateSchoolEvent(
  id: number,
  input: UpdateSchoolEventInput,
  actor: ActorContext
): Promise<SchoolEventItem> {
  const existing = await repo.findEventById(id);
  if (!existing) {
    throw new NotFoundError('Événement scolaire introuvable.');
  }

  const nextStartDate = input.startDate ?? existing.startDate;
  const nextEndDate = input.endDate !== undefined ? input.endDate : existing.endDate;
  if (nextEndDate && nextEndDate < nextStartDate) {
    throw new ValidationError('La date de fin doit être postérieure ou égale à la date de début.');
  }

  if (input.academicYearId !== undefined && input.academicYearId !== null) {
    const year = await findAcademicYearById(input.academicYearId);
    if (!year) {
      throw new NotFoundError('Année scolaire associée introuvable.');
    }
  }

  const updated = await repo.updateSchoolEventRecord(id, {
    title: input.title,
    category: input.category,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate,
    startTime: input.startTime,
    location: input.location,
    targetAudience: input.targetAudience,
    academicYearId: input.academicYearId,
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'SCHOOL_EVENT_UPDATED',
    entityType: 'SCHOOL_EVENT',
    entityId: String(id),
    details: {
      title: updated.title,
      category: updated.category,
      startDate: updated.startDate,
    },
    ipAddress: actor.ipAddress,
  });

  return enrichEvent(updated);
}

export async function deleteSchoolEvent(id: number, actor: ActorContext): Promise<void> {
  const existing = await repo.findEventById(id);
  if (!existing) {
    throw new NotFoundError('Événement scolaire introuvable.');
  }

  await repo.deleteSchoolEventRecord(id);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'SCHOOL_EVENT_DELETED',
    entityType: 'SCHOOL_EVENT',
    entityId: String(id),
    details: {
      title: existing.title,
      category: existing.category,
      startDate: existing.startDate,
    },
    ipAddress: actor.ipAddress,
  });
}
