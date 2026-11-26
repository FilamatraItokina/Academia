import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.ts';
import { buildPaginatedResult, type PaginatedResult } from '../../shared/pagination.ts';
import * as yearRepo from '../academic-years/academic-year.repository.ts';
import { recordAuditEvent } from '../audit/audit.service.ts';
import * as repo from './class.repository.ts';
import type {
  CreateClassInput,
  CreateClassroomInput,
  CreateLevelInput,
  CreateSeriesInput,
  ListClassesQuery,
  UpdateClassInput,
  UpdateClassroomInput,
  UpdateLevelInput,
  UpdateSeriesInput,
} from './class.schema.ts';
import type {
  ClassItem,
  ClassroomItem,
  LevelItem,
  SeriesItem,
} from './class.types.ts';

export async function listLevels(): Promise<LevelItem[]> {
  return await repo.findAllLevels();
}

export async function createLevel(
  input: CreateLevelInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<LevelItem> {
  const dup = await repo.findLevelByCode(input.code);
  if (dup) throw new ConflictError(`Un niveau avec le code « ${input.code} » existe déjà.`);
  const created = await repo.insertLevel(input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'LEVEL_CREATED',
    entityType: 'level',
    entityId: created.id,
    details: { code: created.code, name: created.name },
    ipAddress: actor.ipAddress,
  });
  return created;
}

export async function updateLevel(
  id: number,
  input: UpdateLevelInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<LevelItem> {
  const existing = await repo.findLevelById(id);
  if (!existing) throw new NotFoundError('Niveau introuvable.');
  if (input.code && input.code !== existing.code) {
    const dup = await repo.findLevelByCode(input.code);
    if (dup) throw new ConflictError(`Un niveau avec le code « ${input.code} » existe déjà.`);
  }
  const updated = await repo.updateLevelRecord(id, input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'LEVEL_UPDATED',
    entityType: 'level',
    entityId: updated.id,
    details: { code: updated.code, name: updated.name },
    ipAddress: actor.ipAddress,
  });
  return updated;
}

export async function initializeDefaultLevels(actor: {
  id: number;
  email: string;
  ipAddress?: string | null;
}): Promise<LevelItem[]> {
  const levels = await repo.seedDefaultLevels();
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'LEVELS_SEEDED',
    entityType: 'level',
    details: { count: levels.length },
    ipAddress: actor.ipAddress,
  });
  return levels;
}

export async function listSeries(): Promise<SeriesItem[]> {
  return await repo.findAllSeries();
}

export async function createSeries(
  input: CreateSeriesInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<SeriesItem> {
  const dup = await repo.findSeriesByCode(input.code);
  if (dup) throw new ConflictError(`Une série avec le code « ${input.code} » existe déjà.`);
  const created = await repo.insertSeries(input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'SERIES_CREATED',
    entityType: 'series',
    entityId: created.id,
    details: { code: created.code, name: created.name },
    ipAddress: actor.ipAddress,
  });
  return created;
}

export async function updateSeries(
  id: number,
  input: UpdateSeriesInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<SeriesItem> {
  const existing = await repo.findSeriesById(id);
  if (!existing) throw new NotFoundError('Série introuvable.');
  if (input.code && input.code !== existing.code) {
    const dup = await repo.findSeriesByCode(input.code);
    if (dup) throw new ConflictError(`Une série avec le code « ${input.code} » existe déjà.`);
  }
  return await repo.updateSeriesRecord(id, input);
}

export async function initializeDefaultSeries(actor: {
  id: number;
  email: string;
  ipAddress?: string | null;
}): Promise<SeriesItem[]> {
  const items = await repo.seedDefaultSeries();
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'SERIES_SEEDED',
    entityType: 'series',
    details: { count: items.length },
    ipAddress: actor.ipAddress,
  });
  return items;
}

export async function listClassrooms(): Promise<ClassroomItem[]> {
  return await repo.findAllClassrooms();
}

export async function createClassroom(
  input: CreateClassroomInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<ClassroomItem> {
  const dup = await repo.findClassroomByCode(input.code);
  if (dup) throw new ConflictError(`Une salle avec le code « ${input.code} » existe déjà.`);
  const created = await repo.insertClassroom(input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'CLASSROOM_CREATED',
    entityType: 'classroom',
    entityId: created.id,
    details: { code: created.code, name: created.name, capacity: created.capacity },
    ipAddress: actor.ipAddress,
  });
  return created;
}

export async function updateClassroom(
  id: number,
  input: UpdateClassroomInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<ClassroomItem> {
  const existing = await repo.findClassroomById(id);
  if (!existing) throw new NotFoundError('Salle introuvable.');
  if (input.code && input.code !== existing.code) {
    const dup = await repo.findClassroomByCode(input.code);
    if (dup) throw new ConflictError(`Une salle avec le code « ${input.code} » existe déjà.`);
  }
  const updated = await repo.updateClassroomRecord(id, input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'CLASSROOM_UPDATED',
    entityType: 'classroom',
    entityId: updated.id,
    details: { code: updated.code, capacity: updated.capacity, isActive: updated.isActive },
    ipAddress: actor.ipAddress,
  });
  return updated;
}

export async function listClasses(
  query: ListClassesQuery
): Promise<PaginatedResult<ClassItem>> {
  const { items, total } = await repo.findClasses(query);
  return buildPaginatedResult(items, total, query.page, query.limit);
}

export async function getClassById(id: number): Promise<ClassItem> {
  const cls = await repo.findClassById(id);
  if (!cls) throw new NotFoundError('Classe introuvable.');
  return cls;
}

export async function createClass(
  input: CreateClassInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<ClassItem> {
  const [year, level] = await Promise.all([
    yearRepo.findAcademicYearById(input.academicYearId),
    repo.findLevelById(input.levelId),
  ]);

  if (!year) throw new NotFoundError('Année scolaire introuvable.');
  if (year.status === 'CLOSED') {
    throw new ForbiddenError('Impossible de créer une classe dans une année scolaire clôturée.');
  }
  if (!level) throw new NotFoundError('Niveau scolaire introuvable.');

  if (input.seriesId) {
    const s = await repo.findSeriesById(input.seriesId);
    if (!s) throw new NotFoundError('Série introuvable.');
  }

  if (input.classroomId) {
    const room = await repo.findClassroomById(input.classroomId);
    if (!room) throw new NotFoundError('Salle attribuée introuvable.');
    if (!room.isActive) {
      throw new ValidationError('La salle sélectionnée est désactivée.');
    }
    if (input.capacity > room.capacity) {
      throw new ValidationError(
        `La capacité de la classe (${input.capacity}) dépasse celle de la salle « ${room.name} » (${room.capacity} places).`
      );
    }
  }

  const dup = await repo.findClassByYearAndName(input.academicYearId, input.name);
  if (dup) {
    throw new ConflictError(
      `Une classe nommée « ${input.name} » existe déjà pour l’année ${year.name}.`
    );
  }

  const created = await repo.insertClass(input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'CLASS_CREATED',
    entityType: 'class',
    entityId: created.id,
    details: { name: created.name, year: year.name, level: level.code },
    ipAddress: actor.ipAddress,
  });
  return created;
}

export async function updateClass(
  id: number,
  input: UpdateClassInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<ClassItem> {
  const existing = await repo.findClassById(id);
  if (!existing) throw new NotFoundError('Classe introuvable.');

  if (existing.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Les classes d’une année clôturée sont en lecture seule.');
  }

  if (input.levelId) {
    const level = await repo.findLevelById(input.levelId);
    if (!level) throw new NotFoundError('Niveau scolaire introuvable.');
  }

  if (input.seriesId) {
    const s = await repo.findSeriesById(input.seriesId);
    if (!s) throw new NotFoundError('Série introuvable.');
  }

  const nextClassroomId =
    input.classroomId !== undefined ? input.classroomId : existing.classroomId;
  const nextCapacity = input.capacity ?? existing.capacity;

  if (nextClassroomId) {
    const room = await repo.findClassroomById(nextClassroomId);
    if (!room) throw new NotFoundError('Salle introuvable.');
    if (nextCapacity > room.capacity) {
      throw new ValidationError(
        `La capacité de la classe (${nextCapacity}) dépasse celle de la salle « ${room.name} » (${room.capacity} places).`
      );
    }
  }

  if (input.name && input.name !== existing.name) {
    const dup = await repo.findClassByYearAndName(existing.academicYearId, input.name);
    if (dup) {
      throw new ConflictError(`Une classe nommée « ${input.name} » existe déjà cette année.`);
    }
  }

  const updated = await repo.updateClassRecord(id, input);
  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'CLASS_UPDATED',
    entityType: 'class',
    entityId: updated.id,
    details: { name: updated.name, isArchived: updated.isArchived },
    ipAddress: actor.ipAddress,
  });
  return updated;
}
