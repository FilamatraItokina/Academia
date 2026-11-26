import { ConflictError, NotFoundError } from '../../shared/errors.ts';
import { buildPaginatedResult, type PaginatedResult } from '../../shared/pagination.ts';
import { recordAuditEvent } from '../audit/audit.service.ts';
import * as repo from './teacher.repository.ts';
import type {
  CreateTeacherInput,
  ListTeachersQuery,
  UpdateTeacherInput,
} from './teacher.schema.ts';
import type { TeacherItem } from './teacher.types.ts';

export async function listTeachers(
  query: ListTeachersQuery
): Promise<PaginatedResult<TeacherItem>> {
  const { items, total } = await repo.findTeachers(query);
  return buildPaginatedResult(items, total, query.page, query.limit);
}

export async function getTeacherById(id: number): Promise<TeacherItem> {
  const teacher = await repo.findTeacherById(id);
  if (!teacher) throw new NotFoundError('Dossier enseignant introuvable.');
  return teacher;
}

export async function createTeacher(
  input: CreateTeacherInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<TeacherItem> {
  const dupEmail = await repo.findTeacherByEmail(input.email);
  if (dupEmail) {
    throw new ConflictError('Un enseignant existe déjà avec cette adresse e-mail.');
  }

  const employeeCode =
    input.employeeCode && input.employeeCode.length > 0
      ? input.employeeCode.toUpperCase()
      : await repo.generateNextEmployeeCode();

  const dupCode = await repo.findTeacherByCode(employeeCode);
  if (dupCode) {
    throw new ConflictError(`Le matricule enseignant « ${employeeCode} » est déjà utilisé.`);
  }

  const created = await repo.insertTeacher(employeeCode, input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'TEACHER_CREATED',
    entityType: 'teacher',
    entityId: created.id,
    details: {
      employeeCode: created.employeeCode,
      fullName: `${created.firstName} ${created.lastName}`,
      specialty: created.specialty,
    },
    ipAddress: actor.ipAddress,
  });
  return created;
}

export async function updateTeacher(
  id: number,
  input: UpdateTeacherInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<TeacherItem> {
  const existing = await repo.findTeacherById(id);
  if (!existing) throw new NotFoundError('Dossier enseignant introuvable.');

  if (input.email && input.email.toLowerCase() !== existing.email.toLowerCase()) {
    const dup = await repo.findTeacherByEmail(input.email);
    if (dup) throw new ConflictError('Cette adresse e-mail est déjà utilisée.');
  }

  const updated = await repo.updateTeacherRecord(id, input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'TEACHER_UPDATED',
    entityType: 'teacher',
    entityId: updated.id,
    details: { employeeCode: updated.employeeCode, isActive: updated.isActive },
    ipAddress: actor.ipAddress,
  });
  return updated;
}
