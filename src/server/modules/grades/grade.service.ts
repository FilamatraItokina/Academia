import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.ts';
import {
  findAcademicYearById,
  findTermById,
} from '../academic-years/academic-year.repository.ts';
import { recordAuditEvent } from '../audit/audit.service.ts';
import * as classRepo from '../classes/class.repository.ts';
import * as subjectRepo from '../subjects/subject.repository.ts';
import * as repo from './grade.repository.ts';
import type {
  ClassSummaryQuery,
  CreateAssessmentInput,
  ListAssessmentsQuery,
  MyGradesQuery,
  SaveBulkScoresInput,
  UpdateAssessmentInput,
} from './grade.schema.ts';
import type {
  AssessmentItem,
  AssessmentSheetResponse,
  AssessmentType,
  ClassStudentTermSummary,
  ClassTermSummaryResponse,
  MyGradesSummaryResponse,
  MySubjectGradesSummary,
} from './grade.types.ts';

interface ActorContext {
  id: number;
  email: string;
  roleCodes: string[];
  ipAddress?: string;
}

const ADMIN_OR_DIRECTION = new Set(['ADMIN', 'PRINCIPAL']);

export function normalizeScoreToScale(
  score: number,
  maxScore: number,
  targetScale = 20
): number {
  if (maxScore <= 0) return 0;
  return Math.round(((score / maxScore) * targetScale) * 100) / 100;
}

export function computeWeightedSubjectAverage(
  entries: Array<{
    score: number | null;
    maxScore: number;
    weight: number;
    isAbsent: boolean;
  }>,
  targetScale = 20
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const entry of entries) {
    if (entry.isAbsent || entry.score === null || entry.maxScore <= 0 || entry.weight <= 0) {
      continue;
    }
    const onScale = (entry.score / entry.maxScore) * targetScale;
    weightedSum += onScale * entry.weight;
    totalWeight += entry.weight;
  }

  if (totalWeight <= 0) return null;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

export function computeWeightedGeneralAverage(
  subjectAverages: Array<{ coefficient: number; averageOn20: number | null }>
): number | null {
  let weightedSum = 0;
  let totalCoeff = 0;

  for (const s of subjectAverages) {
    if (s.averageOn20 === null || s.coefficient <= 0) continue;
    weightedSum += s.averageOn20 * s.coefficient;
    totalCoeff += s.coefficient;
  }

  if (totalCoeff <= 0) return null;
  return Math.round((weightedSum / totalCoeff) * 100) / 100;
}

export function assignClassRanks<T extends { generalAverageOn20: number | null }>(
  rows: T[]
): Array<T & { rank: number | null }> {
  const rankedValues = rows
    .filter((r) => r.generalAverageOn20 !== null)
    .map((r) => r.generalAverageOn20 as number)
    .sort((a, b) => b - a);

  return rows.map((row) => {
    if (row.generalAverageOn20 === null) {
      return { ...row, rank: null };
    }
    const rank = rankedValues.indexOf(row.generalAverageOn20) + 1;
    return { ...row, rank };
  });
}

async function resolveTeacherRestriction(actor: ActorContext): Promise<{
  isStaffPrivileged: boolean;
  teacherId: number | null;
}> {
  const isStaffPrivileged = actor.roleCodes.some((c) => ADMIN_OR_DIRECTION.has(c));
  if (isStaffPrivileged) {
    return { isStaffPrivileged: true, teacherId: null };
  }

  if (!actor.roleCodes.includes('TEACHER')) {
    throw new ForbiddenError('Accès réservé au corps enseignant et à la direction.');
  }

  const teacher = await repo.findTeacherByUserId(actor.id);
  if (!teacher) {
    throw new ForbiddenError('Votre compte enseignant n’est pas encore rattaché à une fiche professeur.');
  }

  return { isStaffPrivileged: false, teacherId: teacher.id };
}

export async function listAssessments(
  query: ListAssessmentsQuery,
  actor: ActorContext
): Promise<AssessmentItem[]> {
  const { isStaffPrivileged, teacherId } = await resolveTeacherRestriction(actor);
  return repo.findAssessmentsWithStats({
    classId: query.classId,
    termId: query.termId,
    classSubjectId: query.classSubjectId,
    restrictTeacherId: isStaffPrivileged ? undefined : (teacherId ?? -1),
  });
}

export async function createAssessment(
  input: CreateAssessmentInput,
  actor: ActorContext
): Promise<AssessmentItem> {
  const { isStaffPrivileged, teacherId } = await resolveTeacherRestriction(actor);

  const cs = await repo.findClassSubjectContext(input.classSubjectId);
  if (!cs) {
    throw new NotFoundError('Matière de classe introuvable.');
  }
  if (cs.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Impossible de créer une évaluation sur une année clôturée.');
  }
  if (!isStaffPrivileged && cs.teacherId !== teacherId) {
    throw new ForbiddenError('Vous ne pouvez créer des évaluations que dans vos matières affectées.');
  }

  const term = await findTermById(input.termId);
  if (!term) {
    throw new NotFoundError('Période scolaire introuvable.');
  }
  if (term.academicYearId !== cs.academicYearId) {
    throw new ValidationError('La période choisie ne correspond pas à l’année scolaire de la classe.');
  }

  const createdId = await repo.insertAssessmentRecord({
    classSubjectId: input.classSubjectId,
    termId: input.termId,
    title: input.title,
    assessmentType: input.assessmentType,
    assessmentDate: input.assessmentDate,
    maxScore: input.maxScore,
    weight: input.weight,
    description: input.description ?? '',
    isPublished: input.isPublished ?? false,
    createdByUserId: actor.id,
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'ASSESSMENT_CREATED',
    entityType: 'ASSESSMENT',
    entityId: String(createdId),
    details: {
      className: cs.className,
      subjectName: cs.subjectName,
      title: input.title,
      maxScore: input.maxScore,
    },
    ipAddress: actor.ipAddress,
  });

  const list = await repo.findAssessmentsWithStats({
    classSubjectId: input.classSubjectId,
    termId: input.termId,
  });
  const created = list.find((a) => a.id === createdId);
  if (!created) throw new Error('Évaluation créée introuvable.');
  return created;
}

export async function updateAssessment(
  id: number,
  input: UpdateAssessmentInput,
  actor: ActorContext
): Promise<AssessmentItem> {
  const { isStaffPrivileged, teacherId } = await resolveTeacherRestriction(actor);
  const existing = await repo.findAssessmentById(id);
  if (!existing) throw new NotFoundError('Évaluation introuvable.');

  if (existing.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Année scolaire clôturée : modification impossible.');
  }
  if (!isStaffPrivileged && existing.teacherId !== teacherId) {
    throw new ForbiddenError('Vous ne pouvez modifier que vos propres évaluations.');
  }

  await repo.updateAssessmentRecord(id, input);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'ASSESSMENT_UPDATED',
    entityType: 'ASSESSMENT',
    entityId: String(id),
    details: {
      title: input.title ?? existing.title,
      isPublished: input.isPublished ?? existing.isPublished,
    },
    ipAddress: actor.ipAddress,
  });

  const list = await repo.findAssessmentsWithStats({
    classSubjectId: existing.classSubjectId,
    termId: existing.termId,
  });
  const updated = list.find((a) => a.id === id);
  if (!updated) throw new Error('Évaluation mise à jour introuvable.');
  return updated;
}

export async function deleteAssessment(id: number, actor: ActorContext): Promise<void> {
  const { isStaffPrivileged, teacherId } = await resolveTeacherRestriction(actor);
  const existing = await repo.findAssessmentById(id);
  if (!existing) throw new NotFoundError('Évaluation introuvable.');

  if (existing.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Année scolaire clôturée : suppression impossible.');
  }
  if (!isStaffPrivileged && existing.teacherId !== teacherId) {
    throw new ForbiddenError('Vous ne pouvez supprimer que vos propres évaluations.');
  }

  await repo.deleteAssessmentRecord(id);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'ASSESSMENT_DELETED',
    entityType: 'ASSESSMENT',
    entityId: String(id),
    details: { title: existing.title, className: existing.className },
    ipAddress: actor.ipAddress,
  });
}

export async function getAssessmentSheet(
  assessmentId: number,
  actor: ActorContext
): Promise<AssessmentSheetResponse> {
  const { isStaffPrivileged, teacherId } = await resolveTeacherRestriction(actor);
  const assessmentCtx = await repo.findAssessmentById(assessmentId);
  if (!assessmentCtx) throw new NotFoundError('Évaluation introuvable.');

  if (!isStaffPrivileged && assessmentCtx.teacherId !== teacherId) {
    throw new ForbiddenError('Accès refusé à cette feuille de notes.');
  }

  const [enrolledStudents, existingGrades, listForStats] = await Promise.all([
    repo.findActiveStudentsInClass(assessmentCtx.classId),
    repo.findGradesByAssessmentId(assessmentId),
    repo.findAssessmentsWithStats({
      classSubjectId: assessmentCtx.classSubjectId,
      termId: assessmentCtx.termId,
    }),
  ]);

  const gradeByStudent = new Map(existingGrades.map((g) => [g.studentId, g]));
  let gradedCount = 0;
  let absentCount = 0;
  let sumRaw = 0;
  let sumOn20 = 0;
  let minScore: number | null = null;
  let maxScoreVal: number | null = null;

  const rows = enrolledStudents.map((st) => {
    const g = gradeByStudent.get(st.studentId);
    const score = g && g.score !== null ? Number(g.score) : null;
    const isAbsent = g?.isAbsent ?? false;
    const normalizedOn20 =
      !isAbsent && score !== null
        ? normalizeScoreToScale(score, assessmentCtx.maxScore, 20)
        : null;

    if (isAbsent) {
      absentCount += 1;
    } else if (score !== null) {
      gradedCount += 1;
      sumRaw += score;
      sumOn20 += normalizedOn20 ?? 0;
      minScore = minScore === null ? score : Math.min(minScore, score);
      maxScoreVal = maxScoreVal === null ? score : Math.max(maxScoreVal, score);
    }

    return {
      studentId: st.studentId,
      matricule: st.matricule,
      firstName: st.firstName,
      lastName: st.lastName,
      gradeId: g?.id ?? null,
      score,
      isAbsent,
      comment: g?.comment ?? '',
      normalizedOn20,
      updatedAt: g?.updatedAt ? g.updatedAt.toISOString() : null,
    };
  });

  const assessment =
    listForStats.find((a) => a.id === assessmentId) ?? {
      ...assessmentCtx,
      gradedCount,
      absentCount,
      enrolledCount: enrolledStudents.length,
      averageOn20:
        gradedCount > 0 ? Math.round((sumOn20 / gradedCount) * 100) / 100 : null,
    };

  return {
    assessment,
    rows,
    stats: {
      enrolledCount: enrolledStudents.length,
      gradedCount,
      absentCount,
      averageRaw: gradedCount > 0 ? Math.round((sumRaw / gradedCount) * 100) / 100 : null,
      averageOn20:
        gradedCount > 0 ? Math.round((sumOn20 / gradedCount) * 100) / 100 : null,
      minScore,
      maxScore: maxScoreVal,
    },
  };
}

export async function saveAssessmentScores(
  assessmentId: number,
  input: SaveBulkScoresInput,
  actor: ActorContext
): Promise<{ savedCount: number }> {
  const { isStaffPrivileged, teacherId } = await resolveTeacherRestriction(actor);
  const assessmentCtx = await repo.findAssessmentById(assessmentId);
  if (!assessmentCtx) throw new NotFoundError('Évaluation introuvable.');

  if (assessmentCtx.academicYearStatus === 'CLOSED') {
    throw new ForbiddenError('Année scolaire clôturée : saisie des notes impossible.');
  }
  if (!isStaffPrivileged && assessmentCtx.teacherId !== teacherId) {
    throw new ForbiddenError('Vous ne pouvez saisir des notes que sur vos évaluations.');
  }

  const enrolled = await repo.findActiveStudentsInClass(assessmentCtx.classId);
  const enrolledIds = new Set(enrolled.map((s) => s.studentId));

  for (const entry of input.entries) {
    if (!enrolledIds.has(entry.studentId)) {
      throw new ValidationError(
        `L’élève #${entry.studentId} n’est pas inscrit dans ${assessmentCtx.className}.`
      );
    }
    if (!entry.isAbsent && entry.score !== null && entry.score > assessmentCtx.maxScore) {
      throw new ValidationError(
        `La note ${entry.score} dépasse le barème maximal (${assessmentCtx.maxScore}).`
      );
    }
  }

  const savedCount = await repo.upsertBulkGrades({
    assessmentId,
    gradedByUserId: actor.id,
    entries: input.entries,
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'GRADES_BULK_SAVED',
    entityType: 'ASSESSMENT',
    entityId: String(assessmentId),
    details: {
      className: assessmentCtx.className,
      subjectCode: assessmentCtx.subjectCode,
      title: assessmentCtx.title,
      savedCount,
    },
    ipAddress: actor.ipAddress,
  });

  return { savedCount };
}

export async function getClassTermSummary(
  query: ClassSummaryQuery,
  actor: ActorContext
): Promise<ClassTermSummaryResponse> {
  await resolveTeacherRestriction(actor);

  const [cls, term] = await Promise.all([
    classRepo.findClassById(query.classId),
    findTermById(query.termId),
  ]);
  if (!cls) throw new NotFoundError('Classe introuvable.');
  if (!term) throw new NotFoundError('Période introuvable.');
  if (term.academicYearId !== cls.academicYearId) {
    throw new ValidationError('Cette période n’appartient pas à l’année scolaire de la classe.');
  }

  const [classSubjectsList, enrolledStudents, termData] = await Promise.all([
    subjectRepo.findClassSubjectsByClassId(cls.id),
    repo.findActiveStudentsInClass(cls.id),
    repo.findClassAssessmentsAndGradesForTerm(cls.id, term.id, false),
  ]);

  const assessmentsByClassSubject = new Map<number, typeof termData.assessments>();
  for (const a of termData.assessments) {
    const arr = assessmentsByClassSubject.get(a.classSubjectId) ?? [];
    arr.push(a);
    assessmentsByClassSubject.set(a.classSubjectId, arr);
  }

  const gradeMap = new Map<string, (typeof termData.grades)[number]>();
  for (const g of termData.grades) {
    gradeMap.set(`${g.assessmentId}:${g.studentId}`, g);
  }

  const baseStudents = enrolledStudents.map((st) => {
    const subjectAverages = classSubjectsList.map((cs) => {
      const subAssessments = assessmentsByClassSubject.get(cs.id) ?? [];
      const entries = subAssessments
        .map((a) => {
          const g = gradeMap.get(`${a.id}:${st.studentId}`);
          if (!g) return null;
          return {
            score: g.score !== null ? Number(g.score) : null,
            maxScore: Number(a.maxScore),
            weight: Number(a.weight),
            isAbsent: g.isAbsent,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      const avg = computeWeightedSubjectAverage(entries, 20);
      return {
        classSubjectId: cs.id,
        subjectId: cs.subjectId,
        subjectCode: cs.subjectCode,
        subjectName: cs.subjectName,
        coefficient: cs.coefficient,
        teacherFullName: cs.teacherFullName,
        assessmentCount: entries.filter((e) => !e.isAbsent && e.score !== null).length,
        averageOn20: avg,
      };
    });

    const generalAverageOn20 = computeWeightedGeneralAverage(subjectAverages);
    return {
      studentId: st.studentId,
      matricule: st.matricule,
      firstName: st.firstName,
      lastName: st.lastName,
      subjectAverages,
      generalAverageOn20,
    };
  });

  const rankedStudents: ClassStudentTermSummary[] = assignClassRanks(baseStudents);

  const subjectColumns = classSubjectsList.map((cs) => {
    const vals = rankedStudents
      .map((st) => st.subjectAverages.find((sa) => sa.classSubjectId === cs.id)?.averageOn20 ?? null)
      .filter((v): v is number => v !== null);
    const classAverageOn20 =
      vals.length > 0
        ? Math.round((vals.reduce((acc, v) => acc + v, 0) / vals.length) * 100) / 100
        : null;

    return {
      classSubjectId: cs.id,
      subjectId: cs.subjectId,
      subjectCode: cs.subjectCode,
      subjectName: cs.subjectName,
      coefficient: cs.coefficient,
      teacherFullName: cs.teacherFullName,
      classAverageOn20,
    };
  });

  const generalVals = rankedStudents
    .map((s) => s.generalAverageOn20)
    .filter((v): v is number => v !== null);

  return {
    classInfo: {
      id: cls.id,
      name: cls.name,
      levelName: cls.levelName,
      academicYearName: cls.academicYearName,
    },
    termInfo: {
      id: term.id,
      name: term.name,
    },
    subjects: subjectColumns,
    students: rankedStudents,
    stats: {
      studentCount: rankedStudents.length,
      evaluatedStudentsCount: generalVals.length,
      classGeneralAverage:
        generalVals.length > 0
          ? Math.round(
              (generalVals.reduce((acc, v) => acc + v, 0) / generalVals.length) * 100
            ) / 100
          : null,
      highestAverage: generalVals.length > 0 ? Math.max(...generalVals) : null,
      lowestAverage: generalVals.length > 0 ? Math.min(...generalVals) : null,
    },
  };
}

export async function getMyPublishedGrades(
  query: MyGradesQuery,
  actor: ActorContext
): Promise<MyGradesSummaryResponse> {
  const accessibleStudents = await repo.findAccessibleStudentsForUser(
    actor.id,
    actor.roleCodes
  );

  if (accessibleStudents.length === 0) {
    return {
      students: [],
      selectedStudentId: null,
      terms: [],
      selectedTermId: null,
      generalAverageOn20: null,
      subjects: [],
    };
  }

  const selectedStudent =
    (query.studentId
      ? accessibleStudents.find((s) => s.id === query.studentId)
      : undefined) ?? accessibleStudents[0];

  if (!selectedStudent.classId || !selectedStudent.academicYearId) {
    return {
      students: accessibleStudents.map((s) => ({
        id: s.id,
        matricule: s.matricule,
        firstName: s.firstName,
        lastName: s.lastName,
        className: s.className,
      })),
      selectedStudentId: selectedStudent.id,
      terms: [],
      selectedTermId: null,
      generalAverageOn20: null,
      subjects: [],
    };
  }

  const year = await findAcademicYearById(selectedStudent.academicYearId);
  const termsList = (year?.terms ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    isCurrent: t.isCurrent,
  }));

  const selectedTerm =
    (query.termId ? termsList.find((t) => t.id === query.termId) : undefined) ??
    termsList.find((t) => t.isCurrent) ??
    termsList[0] ??
    null;

  if (!selectedTerm) {
    return {
      students: accessibleStudents.map((s) => ({
        id: s.id,
        matricule: s.matricule,
        firstName: s.firstName,
        lastName: s.lastName,
        className: s.className,
      })),
      selectedStudentId: selectedStudent.id,
      terms: [],
      selectedTermId: null,
      generalAverageOn20: null,
      subjects: [],
    };
  }

  const [classSubjectsList, termData] = await Promise.all([
    subjectRepo.findClassSubjectsByClassId(selectedStudent.classId),
    repo.findClassAssessmentsAndGradesForTerm(
      selectedStudent.classId,
      selectedTerm.id,
      true
    ),
  ]);

  const gradeByAssessment = new Map(
    termData.grades
      .filter((g) => g.studentId === selectedStudent.id)
      .map((g) => [g.assessmentId, g])
  );

  const subjectSummaries: MySubjectGradesSummary[] = classSubjectsList.map((cs) => {
    const subAssessments = termData.assessments.filter((a) => a.classSubjectId === cs.id);
    const items = subAssessments
      .map((a) => {
        const g = gradeByAssessment.get(a.id);
        if (!g) return null;
        const score = g.score !== null ? Number(g.score) : null;
        const maxScore = Number(a.maxScore);
        return {
          assessmentId: a.id,
          title: a.title,
          assessmentType: a.assessmentType as AssessmentType,
          assessmentDate: a.assessmentDate,
          maxScore,
          weight: Number(a.weight),
          score,
          isAbsent: g.isAbsent,
          normalizedOn20:
            !g.isAbsent && score !== null ? normalizeScoreToScale(score, maxScore, 20) : null,
          comment: g.comment,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const avg = computeWeightedSubjectAverage(
      items.map((i) => ({
        score: i.score,
        maxScore: i.maxScore,
        weight: i.weight,
        isAbsent: i.isAbsent,
      })),
      20
    );

    return {
      classSubjectId: cs.id,
      subjectCode: cs.subjectCode,
      subjectName: cs.subjectName,
      coefficient: cs.coefficient,
      teacherFullName: cs.teacherFullName,
      averageOn20: avg,
      grades: items,
    };
  });

  const generalAverageOn20 = computeWeightedGeneralAverage(subjectSummaries);

  return {
    students: accessibleStudents.map((s) => ({
      id: s.id,
      matricule: s.matricule,
      firstName: s.firstName,
      lastName: s.lastName,
      className: s.className,
    })),
    selectedStudentId: selectedStudent.id,
    terms: termsList,
    selectedTermId: selectedTerm.id,
    generalAverageOn20,
    subjects: subjectSummaries,
  };
}
