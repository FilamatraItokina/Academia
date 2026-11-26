import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.ts';
import { recordAuditEvent } from '../audit/audit.service.ts';
import * as classRepo from '../classes/class.repository.ts';
import * as teacherRepo from '../teachers/teacher.repository.ts';
import * as repo from './subject.repository.ts';
import type {
  AssignClassSubjectInput,
  CopyCurriculumInput,
  CreateSubjectInput,
  ListSubjectsQuery,
  UpdateClassSubjectInput,
  UpdateSubjectInput,
} from './subject.schema.ts';
import type {
  ClassCurriculumResponse,
  ClassSubjectItem,
  CurriculumSummary,
  SubjectItem,
} from './subject.types.ts';

interface ActorContext {
  id: number;
  email: string;
  ipAddress?: string;
}

export function computeCurriculumSummary(items: ClassSubjectItem[]): CurriculumSummary {
  let mandatoryCount = 0;
  let optionalCount = 0;
  let totalCoefficient = 0;
  let totalWeeklyHours = 0;
  let assignedTeachersCount = 0;

  for (const item of items) {
    if (item.isOptional) optionalCount += 1;
    else mandatoryCount += 1;
    totalCoefficient += item.coefficient;
    totalWeeklyHours += item.weeklyHours;
    if (item.teacherId !== null) assignedTeachersCount += 1;
  }

  return {
    subjectCount: items.length,
    mandatoryCount,
    optionalCount,
    totalCoefficient: Math.round(totalCoefficient * 10) / 10,
    totalWeeklyHours: Math.round(totalWeeklyHours * 10) / 10,
    assignedTeachersCount,
    unassignedTeachersCount: items.length - assignedTeachersCount,
  };
}

export async function listSubjects(query: ListSubjectsQuery): Promise<SubjectItem[]> {
  return repo.findAllSubjects(query);
}

export async function createSubject(
  input: CreateSubjectInput,
  actor: ActorContext
): Promise<SubjectItem> {
  const existing = await repo.findSubjectByCode(input.code);
  if (existing) {
    throw new ConflictError(`Une matière avec le code « ${input.code} » existe déjà.`);
  }

  const created = await repo.insertSubject({
    code: input.code,
    name: input.name,
    department: input.department,
    defaultCoefficient: input.defaultCoefficient,
    description: input.description ?? '',
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'SUBJECT_CREATED',
    entityType: 'SUBJECT',
    entityId: String(created.id),
    details: { code: created.code, name: created.name, defaultCoefficient: created.defaultCoefficient },
    ipAddress: actor.ipAddress,
  });

  return created;
}

export async function updateSubject(
  id: number,
  input: UpdateSubjectInput,
  actor: ActorContext
): Promise<SubjectItem> {
  const existing = await repo.findSubjectById(id);
  if (!existing) throw new NotFoundError('Matière introuvable.');

  if (input.code && input.code !== existing.code) {
    const conflict = await repo.findSubjectByCode(input.code);
    if (conflict) {
      throw new ConflictError(`Le code matière « ${input.code} » est déjà utilisé.`);
    }
  }

  const updated = await repo.updateSubjectRecord(id, input);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'SUBJECT_UPDATED',
    entityType: 'SUBJECT',
    entityId: String(id),
    details: { code: updated.code, name: updated.name, isActive: updated.isActive },
    ipAddress: actor.ipAddress,
  });

  return updated;
}

export async function getClassCurriculum(classId: number): Promise<ClassCurriculumResponse> {
  const cls = await classRepo.findClassById(classId);
  if (!cls) throw new NotFoundError('Classe introuvable.');

  const items = await repo.findClassSubjectsByClassId(classId);
  return {
    classInfo: {
      id: cls.id,
      name: cls.name,
      academicYearId: cls.academicYearId,
      academicYearName: cls.academicYearName,
      academicYearStatus: cls.academicYearStatus,
      levelName: cls.levelName,
      seriesName: cls.seriesName,
      enrolledCount: cls.enrolledCount,
    },
    items,
    summary: computeCurriculumSummary(items),
  };
}

export async function assignSubjectToClass(
  classId: number,
  input: AssignClassSubjectInput,
  actor: ActorContext
): Promise<ClassSubjectItem> {
  const cls = await classRepo.findClassById(classId);
  if (!cls) throw new NotFoundError('Classe introuvable.');
  if (cls.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Impossible de modifier le programme d’une année scolaire clôturée.');
  }

  const subject = await repo.findSubjectById(input.subjectId);
  if (!subject) throw new NotFoundError('Matière introuvable.');
  if (!subject.isActive) {
    throw new ValidationError('Impossible d’affecter une matière archivée.');
  }

  const duplicate = await repo.findClassSubjectByPair(classId, input.subjectId);
  if (duplicate) {
    throw new ConflictError(`La matière « ${subject.name} » figure déjà au programme de ${cls.name}.`);
  }

  let teacherId: number | null = input.teacherId ?? null;
  if (teacherId !== null) {
    const teacher = await teacherRepo.findTeacherById(teacherId);
    if (!teacher) throw new NotFoundError('Enseignant introuvable.');
    if (!teacher.isActive) {
      throw new ValidationError('Impossible d’affecter un enseignant inactif.');
    }
  }

  const created = await repo.insertClassSubject({
    classId,
    subjectId: input.subjectId,
    teacherId,
    coefficient: input.coefficient,
    weeklyHours: input.weeklyHours,
    isOptional: input.isOptional ?? false,
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'CLASS_SUBJECT_ASSIGNED',
    entityType: 'CLASS',
    entityId: String(classId),
    details: {
      className: cls.name,
      subjectCode: subject.code,
      coefficient: created.coefficient,
      teacherId: created.teacherId,
    },
    ipAddress: actor.ipAddress,
  });

  return created;
}

export async function updateClassSubject(
  id: number,
  input: UpdateClassSubjectInput,
  actor: ActorContext
): Promise<ClassSubjectItem> {
  const existing = await repo.findClassSubjectById(id);
  if (!existing) throw new NotFoundError('Ligne de programme introuvable.');

  const cls = await classRepo.findClassById(existing.classId);
  if (cls?.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Année scolaire clôturée : modification impossible.');
  }

  if (input.teacherId !== undefined && input.teacherId !== null) {
    const teacher = await teacherRepo.findTeacherById(input.teacherId);
    if (!teacher) throw new NotFoundError('Enseignant introuvable.');
    if (!teacher.isActive) {
      throw new ValidationError('Impossible d’affecter un enseignant inactif.');
    }
  }

  const updated = await repo.updateClassSubjectRecord(id, input);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'CLASS_SUBJECT_UPDATED',
    entityType: 'CLASS_SUBJECT',
    entityId: String(id),
    details: {
      className: existing.className,
      subjectCode: existing.subjectCode,
      coefficient: updated.coefficient,
      weeklyHours: updated.weeklyHours,
      teacherId: updated.teacherId,
    },
    ipAddress: actor.ipAddress,
  });

  return updated;
}

export async function removeClassSubject(id: number, actor: ActorContext): Promise<void> {
  const existing = await repo.findClassSubjectById(id);
  if (!existing) throw new NotFoundError('Ligne de programme introuvable.');

  const cls = await classRepo.findClassById(existing.classId);
  if (cls?.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Année scolaire clôturée : suppression impossible.');
  }

  await repo.deleteClassSubjectRecord(id);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'CLASS_SUBJECT_REMOVED',
    entityType: 'CLASS',
    entityId: String(existing.classId),
    details: {
      className: existing.className,
      subjectCode: existing.subjectCode,
    },
    ipAddress: actor.ipAddress,
  });
}

export async function copyCurriculumFromClass(
  targetClassId: number,
  input: CopyCurriculumInput,
  actor: ActorContext
): Promise<{ copiedCount: number; targetClassName: string; sourceClassName: string }> {
  if (targetClassId === input.sourceClassId) {
    throw new ValidationError('La classe source et la classe cible doivent être différentes.');
  }

  const [targetCls, sourceCls] = await Promise.all([
    classRepo.findClassById(targetClassId),
    classRepo.findClassById(input.sourceClassId),
  ]);

  if (!targetCls) throw new NotFoundError('Classe cible introuvable.');
  if (!sourceCls) throw new NotFoundError('Classe source introuvable.');
  if (targetCls.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Impossible de modifier une classe sur une année clôturée.');
  }

  const sourceItems = await repo.findClassSubjectsByClassId(input.sourceClassId);
  if (sourceItems.length === 0) {
    throw new ValidationError(`La classe ${sourceCls.name} ne contient aucune matière à copier.`);
  }

  const activeEntries = sourceItems
    .filter((item) => item.subjectIsActive)
    .map((item) => ({
      subjectId: item.subjectId,
      teacherId: input.includeTeachers ? item.teacherId : null,
      coefficient: item.coefficient,
      weeklyHours: item.weeklyHours,
      isOptional: item.isOptional,
    }));

  const copiedCount = await repo.copyClassSubjectsBatch(targetClassId, activeEntries);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'CLASS_CURRICULUM_COPIED',
    entityType: 'CLASS',
    entityId: String(targetClassId),
    details: {
      sourceClassId: input.sourceClassId,
      sourceClassName: sourceCls.name,
      targetClassName: targetCls.name,
      copiedCount,
    },
    ipAddress: actor.ipAddress,
  });

  return {
    copiedCount,
    targetClassName: targetCls.name,
    sourceClassName: sourceCls.name,
  };
}
