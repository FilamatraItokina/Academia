import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.ts';
import { recordAuditEvent } from '../audit/audit.service.ts';
import * as classRepo from '../classes/class.repository.ts';
import { emitAttendanceChanged } from './attendance.events.ts';
import * as repo from './attendance.repository.ts';
import {
  getTodayIsoDate,
  type BulkMarkAttendanceInput,
  type ClassRollQuery,
  type DailySummaryQuery,
  type UpdateAttendanceInput,
} from './attendance.schema.ts';
import type {
  ClassRollStudentItem,
  DailyAttendanceSummary,
} from './attendance.types.ts';

interface ActorContext {
  id: number;
  email: string;
  ipAddress?: string;
}

export function computeAbsenteeismRate(absentCount: number, totalEnrolled: number): number {
  if (totalEnrolled <= 0 || absentCount <= 0) return 0;
  return Math.round((absentCount / totalEnrolled) * 1000) / 10;
}

export async function getDailySummary(
  query: DailySummaryQuery
): Promise<DailyAttendanceSummary> {
  const date = query.date ?? getTodayIsoDate();
  return repo.getDailyAttendanceSummary(date, query.classId);
}

export async function getClassRoll(
  query: ClassRollQuery
): Promise<{ classId: number; className: string; date: string; students: ClassRollStudentItem[] }> {
  const cls = await classRepo.findClassById(query.classId);
  if (!cls) throw new NotFoundError('Classe introuvable.');
  const date = query.date ?? getTodayIsoDate();
  const students = await repo.getClassRoll(query.classId, date);
  return {
    classId: cls.id,
    className: cls.name,
    date,
    students,
  };
}

export async function saveBulkAttendance(
  input: BulkMarkAttendanceInput,
  actor: ActorContext
): Promise<{ savedCount: number; date: string; classId: number }> {
  const cls = await classRepo.findClassById(input.classId);
  if (!cls) throw new NotFoundError('Classe introuvable.');
  if (cls.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Impossible de modifier les présences sur une année scolaire clôturée.');
  }

  const enrolledIds = new Set(await repo.findActiveStudentIdsInClass(input.classId));
  for (const entry of input.entries) {
    if (!enrolledIds.has(entry.studentId)) {
      throw new ValidationError(
        `L’élève #${entry.studentId} n’est pas inscrit activement dans la classe ${cls.name}.`
      );
    }
  }

  const savedCount = await repo.upsertBulkAttendance({
    classId: cls.id,
    academicYearId: cls.academicYearId,
    date: input.date,
    recordedByUserId: actor.id,
    entries: input.entries,
  });

  const absentsCount = input.entries.filter(
    (e) => e.status === 'ABSENT' || e.status === 'EXCUSED'
  ).length;

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'ATTENDANCE_BULK_SAVED',
    entityType: 'CLASS',
    entityId: String(cls.id),
    details: { date: input.date, savedCount, absentsCount },
    ipAddress: actor.ipAddress,
  });

  emitAttendanceChanged(input.date, cls.id);

  return {
    savedCount,
    date: input.date,
    classId: cls.id,
  };
}

export async function updateAttendance(
  id: number,
  input: UpdateAttendanceInput,
  actor: ActorContext
) {
  const existing = await repo.findAttendanceById(id);
  if (!existing) throw new NotFoundError('Enregistrement de présence introuvable.');

  const cls = await classRepo.findClassById(existing.classId);
  if (cls?.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Année scolaire clôturée : modification impossible.');
  }

  const nextStatus = input.status ?? (existing.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED');
  const nextJustified =
    nextStatus === 'EXCUSED'
      ? true
      : input.isJustified !== undefined
        ? input.isJustified
        : existing.isJustified;

  const updated = await repo.updateAttendanceRecord(id, {
    status: input.status,
    reason: input.reason,
    isJustified: nextJustified,
    recordedByUserId: actor.id,
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'ATTENDANCE_UPDATED',
    entityType: 'STUDENT_ATTENDANCE',
    entityId: String(id),
    details: { status: updated.status, isJustified: updated.isJustified },
    ipAddress: actor.ipAddress,
  });

  emitAttendanceChanged(existing.attendanceDate, existing.classId);
  return updated;
}
