import { NotFoundError } from '../../shared/errors.ts';
import { buildPaginatedResult, type PaginatedResult } from '../../shared/pagination.ts';
import { recordAuditEvent } from '../audit/audit.service.ts';
import * as studentRepo from '../students/student.repository.ts';
import * as repo from './guardian.repository.ts';
import type {
  CreateGuardianInput,
  LinkStudentInput,
  ListGuardiansQuery,
  UpdateGuardianInput,
} from './guardian.schema.ts';
import type { GuardianItem } from './guardian.types.ts';

export async function listGuardians(
  query: ListGuardiansQuery
): Promise<PaginatedResult<GuardianItem>> {
  const { items, total } = await repo.findGuardians(query);
  return buildPaginatedResult(items, total, query.page, query.limit);
}

export async function getGuardianById(id: number): Promise<GuardianItem> {
  const guardian = await repo.findGuardianById(id);
  if (!guardian) throw new NotFoundError('Responsable légal introuvable.');
  return guardian;
}

export async function createGuardian(
  input: CreateGuardianInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<GuardianItem> {
  if (input.initialStudentLink) {
    const student = await studentRepo.findStudentDossierById(
      input.initialStudentLink.studentId
    );
    if (!student) throw new NotFoundError('Élève à associer introuvable.');
  }

  const created = await repo.createGuardianTransaction(input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'GUARDIAN_CREATED',
    entityType: 'guardian',
    entityId: created.id,
    details: { fullName: `${created.firstName} ${created.lastName}`, phone: created.phone },
    ipAddress: actor.ipAddress,
  });
  return created;
}

export async function updateGuardian(
  id: number,
  input: UpdateGuardianInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<GuardianItem> {
  const existing = await repo.findGuardianById(id);
  if (!existing) throw new NotFoundError('Responsable légal introuvable.');

  const updated = await repo.updateGuardianRecord(id, input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'GUARDIAN_UPDATED',
    entityType: 'guardian',
    entityId: updated.id,
    details: { fullName: `${updated.firstName} ${updated.lastName}` },
    ipAddress: actor.ipAddress,
  });
  return updated;
}

export async function linkStudentToGuardian(
  guardianId: number,
  input: LinkStudentInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<GuardianItem> {
  const [guardian, student] = await Promise.all([
    repo.findGuardianById(guardianId),
    studentRepo.findStudentDossierById(input.studentId),
  ]);
  if (!guardian) throw new NotFoundError('Responsable légal introuvable.');
  if (!student) throw new NotFoundError('Élève introuvable.');

  const updated = await repo.upsertStudentGuardianLink(guardianId, input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'STUDENT_GUARDIAN_LINKED',
    entityType: 'guardian',
    entityId: guardianId,
    details: { studentId: input.studentId, relationship: input.relationship },
    ipAddress: actor.ipAddress,
  });
  return updated;
}

export async function unlinkStudentFromGuardian(
  guardianId: number,
  studentId: number,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<GuardianItem> {
  const existing = await repo.findGuardianById(guardianId);
  if (!existing) throw new NotFoundError('Responsable légal introuvable.');

  const updated = await repo.deleteStudentGuardianLink(guardianId, studentId);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'STUDENT_GUARDIAN_UNLINKED',
    entityType: 'guardian',
    entityId: guardianId,
    details: { studentId },
    ipAddress: actor.ipAddress,
  });
  return updated;
}
