import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.ts';
import { recordAuditEvent } from '../audit/audit.service.ts';
import * as repo from './academic-year.repository.ts';
import type {
  CreateAcademicYearInput,
  CreateTermInput,
  UpdateAcademicYearInput,
  UpdateTermInput,
} from './academic-year.schema.ts';
import type { AcademicYearItem, TermItem, TermType } from './academic-year.types.ts';

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function generatePeriodsForYear(
  startDate: string,
  endDate: string,
  mode: 'TRIMESTER' | 'SEMESTER' | 'NONE'
): Array<{
  name: string;
  termType: TermType;
  orderIndex: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}> {
  if (mode === 'NONE') return [];
  const count = mode === 'TRIMESTER' ? 3 : 2;
  const label = mode === 'TRIMESTER' ? 'Trimestre' : 'Semestre';

  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  const totalDays = Math.max(count, Math.round((endMs - startMs) / 86400000));
  const sliceDays = Math.floor(totalDays / count);

  const periods: Array<{
    name: string;
    termType: TermType;
    orderIndex: number;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }> = [];

  for (let i = 0; i < count; i++) {
    const pStartMs = startMs + i * sliceDays * 86400000;
    const pEndMs =
      i === count - 1 ? endMs : startMs + ((i + 1) * sliceDays - 1) * 86400000;
    periods.push({
      name: `${label} ${i + 1}`,
      termType: mode,
      orderIndex: i + 1,
      startDate: toIsoDate(pStartMs),
      endDate: toIsoDate(Math.max(pStartMs + 86400000, pEndMs)),
      isCurrent: i === 0,
    });
  }
  return periods;
}

export function validateTermDates(
  year: { startDate: string; endDate: string },
  candidate: { startDate: string; endDate: string },
  existingTerms: TermItem[],
  excludeTermId?: number
): void {
  if (candidate.startDate < year.startDate || candidate.endDate > year.endDate) {
    throw new ValidationError(
      `Les dates de la période doivent être comprises entre le ${year.startDate} et le ${year.endDate}.`
    );
  }
  for (const other of existingTerms) {
    if (excludeTermId !== undefined && other.id === excludeTermId) continue;
    const overlaps =
      candidate.startDate <= other.endDate && candidate.endDate >= other.startDate;
    if (overlaps) {
      throw new ConflictError(
        `Les dates chevauchent la période existante « ${other.name} » (${other.startDate} au ${other.endDate}).`
      );
    }
  }
}

export async function listAcademicYears(): Promise<AcademicYearItem[]> {
  return await repo.findAllAcademicYears();
}

export async function createAcademicYear(
  input: CreateAcademicYearInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<AcademicYearItem> {
  const existing = await repo.findAcademicYearByName(input.name);
  if (existing) {
    throw new ConflictError(`L’année scolaire « ${input.name} » existe déjà.`);
  }

  const initialTerms = generatePeriodsForYear(
    input.startDate,
    input.endDate,
    input.autoGeneratePeriods
  );

  const created = await repo.createAcademicYearWithTerms({
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    initialTerms,
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'ACADEMIC_YEAR_CREATED',
    entityType: 'academic_year',
    entityId: created.id,
    details: { name: created.name, termsCount: created.terms.length },
    ipAddress: actor.ipAddress,
  });

  return created;
}

export async function updateAcademicYear(
  id: number,
  input: UpdateAcademicYearInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<AcademicYearItem> {
  const year = await repo.findAcademicYearById(id);
  if (!year) throw new NotFoundError('Année scolaire introuvable.');
  if (year.status === 'CLOSED') {
    throw new ForbiddenError('Une année scolaire clôturée ne peut plus être modifiée.');
  }

  const nextStart = input.startDate ?? year.startDate;
  const nextEnd = input.endDate ?? year.endDate;
  if (nextStart >= nextEnd) {
    throw new ValidationError('La date de fin doit être postérieure à la date de début.');
  }

  if (input.name && input.name !== year.name) {
    const dup = await repo.findAcademicYearByName(input.name);
    if (dup) throw new ConflictError(`L’année scolaire « ${input.name} » existe déjà.`);
  }

  const updated = await repo.updateAcademicYearRecord(id, input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'ACADEMIC_YEAR_UPDATED',
    entityType: 'academic_year',
    entityId: updated.id,
    details: { name: updated.name, startDate: updated.startDate, endDate: updated.endDate },
    ipAddress: actor.ipAddress,
  });
  return updated;
}

export async function activateAcademicYear(
  id: number,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<AcademicYearItem> {
  const year = await repo.findAcademicYearById(id);
  if (!year) throw new NotFoundError('Année scolaire introuvable.');
  if (year.status === 'CLOSED') {
    throw new ForbiddenError(
      'Une année scolaire clôturée est archivée et ne peut pas être réactivée.'
    );
  }
  if (year.status === 'ACTIVE') return year;

  const activated = await repo.activateAcademicYearTransaction(id);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'ACADEMIC_YEAR_ACTIVATED',
    entityType: 'academic_year',
    entityId: activated.id,
    details: { name: activated.name },
    ipAddress: actor.ipAddress,
  });
  return activated;
}

export async function closeAcademicYear(
  id: number,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<AcademicYearItem> {
  const year = await repo.findAcademicYearById(id);
  if (!year) throw new NotFoundError('Année scolaire introuvable.');
  if (year.status === 'CLOSED') return year;

  const closed = await repo.closeAcademicYearRecord(id);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'ACADEMIC_YEAR_CLOSED',
    entityType: 'academic_year',
    entityId: closed.id,
    details: { name: closed.name },
    ipAddress: actor.ipAddress,
  });
  return closed;
}

export async function addTerm(
  academicYearId: number,
  input: CreateTermInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<TermItem> {
  const year = await repo.findAcademicYearById(academicYearId);
  if (!year) throw new NotFoundError('Année scolaire introuvable.');
  if (year.status === 'CLOSED') {
    throw new ForbiddenError('Impossible d’ajouter une période à une année clôturée.');
  }

  if (year.terms.some((t) => t.orderIndex === input.orderIndex)) {
    throw new ConflictError(`Une période d’ordre ${input.orderIndex} existe déjà.`);
  }

  validateTermDates(year, input, year.terms);
  const created = await repo.insertTermRecord({
    academicYearId,
    ...input,
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'TERM_CREATED',
    entityType: 'term',
    entityId: created.id,
    details: { academicYearId, name: created.name },
    ipAddress: actor.ipAddress,
  });
  return created;
}

export async function updateTerm(
  termId: number,
  input: UpdateTermInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<TermItem> {
  const existing = await repo.findTermById(termId);
  if (!existing) throw new NotFoundError('Période introuvable.');

  const year = await repo.findAcademicYearById(existing.academicYearId);
  if (!year) throw new NotFoundError('Année scolaire introuvable.');
  if (year.status === 'CLOSED') {
    throw new ForbiddenError('Impossible de modifier une période d’une année clôturée.');
  }

  const nextStart = input.startDate ?? existing.startDate;
  const nextEnd = input.endDate ?? existing.endDate;
  if (nextStart >= nextEnd) {
    throw new ValidationError('La date de fin doit être postérieure à la date de début.');
  }

  validateTermDates(
    year,
    { startDate: nextStart, endDate: nextEnd },
    year.terms,
    termId
  );

  const updated = await repo.updateTermRecord(termId, input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'TERM_UPDATED',
    entityType: 'term',
    entityId: updated.id,
    details: { name: updated.name, startDate: updated.startDate, endDate: updated.endDate },
    ipAddress: actor.ipAddress,
  });
  return updated;
}

export async function setCurrentTerm(
  termId: number,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<TermItem> {
  const existing = await repo.findTermById(termId);
  if (!existing) throw new NotFoundError('Période introuvable.');

  const year = await repo.findAcademicYearById(existing.academicYearId);
  if (!year) throw new NotFoundError('Année scolaire introuvable.');
  if (year.status === 'CLOSED') {
    throw new ForbiddenError('Impossible d’activer une période sur une année clôturée.');
  }

  const updated = await repo.setCurrentTermTransaction(existing.academicYearId, termId);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'TERM_SET_CURRENT',
    entityType: 'term',
    entityId: updated.id,
    details: { academicYearId: existing.academicYearId, name: updated.name },
    ipAddress: actor.ipAddress,
  });
  return updated;
}

export async function deleteTerm(
  termId: number,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<void> {
  const existing = await repo.findTermById(termId);
  if (!existing) throw new NotFoundError('Période introuvable.');
  const year = await repo.findAcademicYearById(existing.academicYearId);
  if (year?.status === 'CLOSED') {
    throw new ForbiddenError('Impossible de supprimer une période d’une année clôturée.');
  }

  await repo.deleteTermRecord(termId);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'TERM_DELETED',
    entityType: 'term',
    entityId: termId,
    details: { name: existing.name },
    ipAddress: actor.ipAddress,
  });
}
