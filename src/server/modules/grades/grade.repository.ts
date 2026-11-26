import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  academicYears,
  assessments,
  classes,
  classSubjects,
  enrollments,
  grades,
  guardians,
  levels,
  studentGuardians,
  students,
  subjects,
  teachers,
  terms,
} from '../../../db/schema.ts';
import type {
  AssessmentItem,
  AssessmentType,
} from './grade.types.ts';

export interface RawAssessmentContext {
  id: number;
  classSubjectId: number;
  classId: number;
  className: string;
  levelName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  subjectCoefficient: number;
  teacherId: number | null;
  teacherFullName: string | null;
  termId: number;
  termName: string;
  academicYearId: number;
  academicYearName: string;
  academicYearStatus: string;
  title: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  maxScore: number;
  weight: number;
  description: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function findTeacherByUserId(userId: number): Promise<{ id: number } | null> {
  const rows = await db
    .select({ id: teachers.id })
    .from(teachers)
    .where(eq(teachers.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function findClassSubjectContext(classSubjectId: number) {
  const rows = await db
    .select({
      id: classSubjects.id,
      classId: classSubjects.classId,
      teacherId: classSubjects.teacherId,
      coefficient: classSubjects.coefficient,
      className: classes.name,
      academicYearId: classes.academicYearId,
      academicYearStatus: academicYears.status,
      subjectName: subjects.name,
    })
    .from(classSubjects)
    .innerJoin(classes, eq(classSubjects.classId, classes.id))
    .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id))
    .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(eq(classSubjects.id, classSubjectId))
    .limit(1);

  return rows[0] ?? null;
}

export async function findAssessmentById(id: number): Promise<RawAssessmentContext | null> {
  try {
    const rows = await db
      .select({
        a: assessments,
        cs: classSubjects,
        cls: classes,
        lvl: levels,
        sub: subjects,
        tchrFirst: teachers.firstName,
        tchrLast: teachers.lastName,
        trm: terms,
        ay: academicYears,
      })
      .from(assessments)
      .innerJoin(classSubjects, eq(assessments.classSubjectId, classSubjects.id))
      .innerJoin(classes, eq(classSubjects.classId, classes.id))
      .innerJoin(levels, eq(classes.levelId, levels.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .leftJoin(teachers, eq(classSubjects.teacherId, teachers.id))
      .innerJoin(terms, eq(assessments.termId, terms.id))
      .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id))
      .where(eq(assessments.id, id))
      .limit(1);

    const r = rows[0];
    if (!r) return null;

    return {
      id: r.a.id,
      classSubjectId: r.a.classSubjectId,
      classId: r.cls.id,
      className: r.cls.name,
      levelName: r.lvl.name,
      subjectId: r.sub.id,
      subjectCode: r.sub.code,
      subjectName: r.sub.name,
      subjectCoefficient: Number(r.cs.coefficient),
      teacherId: r.cs.teacherId,
      teacherFullName:
        r.tchrFirst && r.tchrLast ? `${r.tchrLast} ${r.tchrFirst}` : null,
      termId: r.trm.id,
      termName: r.trm.name,
      academicYearId: r.ay.id,
      academicYearName: r.ay.name,
      academicYearStatus: r.ay.status,
      title: r.a.title,
      assessmentType: r.a.assessmentType as AssessmentType,
      assessmentDate: r.a.assessmentDate,
      maxScore: Number(r.a.maxScore),
      weight: Number(r.a.weight),
      description: r.a.description,
      isPublished: r.a.isPublished,
      createdAt: r.a.createdAt.toISOString(),
      updatedAt: r.a.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in findAssessmentById:', error);
    throw new Error('Impossible de récupérer l’évaluation.', { cause: error });
  }
}

export async function findAssessmentsWithStats(filters: {
  classId?: number;
  termId?: number;
  classSubjectId?: number;
  restrictTeacherId?: number;
}): Promise<AssessmentItem[]> {
  try {
    const conditions = [];
    if (filters.classId) conditions.push(eq(classSubjects.classId, filters.classId));
    if (filters.termId) conditions.push(eq(assessments.termId, filters.termId));
    if (filters.classSubjectId) {
      conditions.push(eq(assessments.classSubjectId, filters.classSubjectId));
    }
    if (filters.restrictTeacherId !== undefined) {
      conditions.push(eq(classSubjects.teacherId, filters.restrictTeacherId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        a: assessments,
        cs: classSubjects,
        cls: classes,
        sub: subjects,
        tchrFirst: teachers.firstName,
        tchrLast: teachers.lastName,
        trm: terms,
        ay: academicYears,
      })
      .from(assessments)
      .innerJoin(classSubjects, eq(assessments.classSubjectId, classSubjects.id))
      .innerJoin(classes, eq(classSubjects.classId, classes.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .leftJoin(teachers, eq(classSubjects.teacherId, teachers.id))
      .innerJoin(terms, eq(assessments.termId, terms.id))
      .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id))
      .where(whereClause)
      .orderBy(desc(assessments.assessmentDate), desc(assessments.id));

    if (rows.length === 0) return [];

    const assessmentIds = rows.map((r) => r.a.id);
    const classIds = Array.from(new Set(rows.map((r) => r.cls.id)));

    const [gradeRows, enrollmentRows] = await Promise.all([
      db
        .select({
          assessmentId: grades.assessmentId,
          score: grades.score,
          isAbsent: grades.isAbsent,
        })
        .from(grades)
        .where(inArray(grades.assessmentId, assessmentIds)),
      db
        .select({
          classId: enrollments.classId,
          studentId: enrollments.studentId,
        })
        .from(enrollments)
        .where(
          and(inArray(enrollments.classId, classIds), eq(enrollments.status, 'ACTIVE'))
        ),
    ]);

    const enrolledByClass = new Map<number, number>();
    for (const en of enrollmentRows) {
      enrolledByClass.set(en.classId, (enrolledByClass.get(en.classId) ?? 0) + 1);
    }

    const gradesByAssessment = new Map<
      number,
      Array<{ score: number | null; isAbsent: boolean }>
    >();
    for (const g of gradeRows) {
      const list = gradesByAssessment.get(g.assessmentId) ?? [];
      list.push({
        score: g.score !== null ? Number(g.score) : null,
        isAbsent: g.isAbsent,
      });
      gradesByAssessment.set(g.assessmentId, list);
    }

    return rows.map((r) => {
      const gList = gradesByAssessment.get(r.a.id) ?? [];
      const maxScore = Number(r.a.maxScore);
      let gradedCount = 0;
      let absentCount = 0;
      let sumOn20 = 0;

      for (const g of gList) {
        if (g.isAbsent) {
          absentCount += 1;
        } else if (g.score !== null) {
          gradedCount += 1;
          sumOn20 += (g.score / maxScore) * 20;
        }
      }

      return {
        id: r.a.id,
        classSubjectId: r.a.classSubjectId,
        classId: r.cls.id,
        className: r.cls.name,
        subjectId: r.sub.id,
        subjectCode: r.sub.code,
        subjectName: r.sub.name,
        subjectCoefficient: Number(r.cs.coefficient),
        teacherId: r.cs.teacherId,
        teacherFullName:
          r.tchrFirst && r.tchrLast ? `${r.tchrLast} ${r.tchrFirst}` : null,
        termId: r.trm.id,
        termName: r.trm.name,
        academicYearId: r.ay.id,
        academicYearName: r.ay.name,
        academicYearStatus: r.ay.status,
        title: r.a.title,
        assessmentType: r.a.assessmentType as AssessmentType,
        assessmentDate: r.a.assessmentDate,
        maxScore,
        weight: Number(r.a.weight),
        description: r.a.description,
        isPublished: r.a.isPublished,
        gradedCount,
        absentCount,
        enrolledCount: enrolledByClass.get(r.cls.id) ?? 0,
        averageOn20:
          gradedCount > 0 ? Math.round((sumOn20 / gradedCount) * 100) / 100 : null,
        createdAt: r.a.createdAt.toISOString(),
        updatedAt: r.a.updatedAt.toISOString(),
      };
    });
  } catch (error) {
    console.error('Database query failed in findAssessmentsWithStats:', error);
    throw new Error('Impossible de charger les évaluations.', { cause: error });
  }
}

export async function insertAssessmentRecord(input: {
  classSubjectId: number;
  termId: number;
  title: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  maxScore: number;
  weight: number;
  description: string;
  isPublished: boolean;
  createdByUserId: number;
}): Promise<number> {
  const inserted = await db
    .insert(assessments)
    .values({
      classSubjectId: input.classSubjectId,
      termId: input.termId,
      title: input.title,
      assessmentType: input.assessmentType,
      assessmentDate: input.assessmentDate,
      maxScore: input.maxScore.toFixed(2),
      weight: input.weight.toFixed(2),
      description: input.description,
      isPublished: input.isPublished,
      createdByUserId: input.createdByUserId,
    })
    .returning({ id: assessments.id });

  return inserted[0].id;
}

export async function updateAssessmentRecord(
  id: number,
  updates: Partial<{
    title: string;
    assessmentType: AssessmentType;
    assessmentDate: string;
    maxScore: number;
    weight: number;
    description: string;
    isPublished: boolean;
  }>
): Promise<void> {
  await db
    .update(assessments)
    .set({
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.assessmentType !== undefined
        ? { assessmentType: updates.assessmentType }
        : {}),
      ...(updates.assessmentDate !== undefined
        ? { assessmentDate: updates.assessmentDate }
        : {}),
      ...(updates.maxScore !== undefined
        ? { maxScore: updates.maxScore.toFixed(2) }
        : {}),
      ...(updates.weight !== undefined ? { weight: updates.weight.toFixed(2) } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.isPublished !== undefined ? { isPublished: updates.isPublished } : {}),
      updatedAt: new Date(),
    })
    .where(eq(assessments.id, id));
}

export async function deleteAssessmentRecord(id: number): Promise<void> {
  await db.delete(assessments).where(eq(assessments.id, id));
}

export async function findActiveStudentsInClass(classId: number) {
  return db
    .select({
      studentId: students.id,
      matricule: students.matricule,
      firstName: students.firstName,
      lastName: students.lastName,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(and(eq(enrollments.classId, classId), eq(enrollments.status, 'ACTIVE')))
    .orderBy(asc(students.lastName), asc(students.firstName));
}

export async function findGradesByAssessmentId(assessmentId: number) {
  return db
    .select()
    .from(grades)
    .where(eq(grades.assessmentId, assessmentId));
}

export async function upsertBulkGrades(params: {
  assessmentId: number;
  gradedByUserId: number;
  entries: Array<{
    studentId: number;
    score: number | null;
    isAbsent: boolean;
    comment: string;
  }>;
}): Promise<number> {
  await db.transaction(async (tx) => {
    for (const entry of params.entries) {
      const normalizedScore =
        entry.isAbsent || entry.score === null ? null : entry.score.toFixed(2);
      await tx
        .insert(grades)
        .values({
          assessmentId: params.assessmentId,
          studentId: entry.studentId,
          score: normalizedScore,
          isAbsent: entry.isAbsent,
          comment: entry.comment,
          gradedByUserId: params.gradedByUserId,
        })
        .onConflictDoUpdate({
          target: [grades.assessmentId, grades.studentId],
          set: {
            score: normalizedScore,
            isAbsent: entry.isAbsent,
            comment: entry.comment,
            gradedByUserId: params.gradedByUserId,
            updatedAt: new Date(),
          },
        });
    }
  });
  return params.entries.length;
}

export async function findClassAssessmentsAndGradesForTerm(
  classId: number,
  termId: number,
  publishedOnly = false
) {
  const conditions = [eq(classSubjects.classId, classId), eq(assessments.termId, termId)];
  if (publishedOnly) {
    conditions.push(eq(assessments.isPublished, true));
  }

  const assessmentRows = await db
    .select({
      id: assessments.id,
      classSubjectId: assessments.classSubjectId,
      title: assessments.title,
      assessmentType: assessments.assessmentType,
      assessmentDate: assessments.assessmentDate,
      maxScore: assessments.maxScore,
      weight: assessments.weight,
      isPublished: assessments.isPublished,
    })
    .from(assessments)
    .innerJoin(classSubjects, eq(assessments.classSubjectId, classSubjects.id))
    .where(and(...conditions))
    .orderBy(asc(assessments.assessmentDate), asc(assessments.id));

  if (assessmentRows.length === 0) {
    return { assessments: [], grades: [] };
  }

  const ids = assessmentRows.map((a) => a.id);
  const gradeRows = await db
    .select()
    .from(grades)
    .where(inArray(grades.assessmentId, ids));

  return { assessments: assessmentRows, grades: gradeRows };
}

export async function findAccessibleStudentsForUser(
  userId: number,
  roleCodes: string[]
): Promise<
  Array<{
    id: number;
    matricule: string;
    firstName: string;
    lastName: string;
    classId: number | null;
    className: string | null;
    academicYearId: number | null;
  }>
> {
  const studentIdSet = new Set<number>();

  if (roleCodes.includes('STUDENT')) {
    const selfRows = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.userId, userId));
    for (const s of selfRows) studentIdSet.add(s.id);
  }

  if (roleCodes.includes('PARENT')) {
    const guardianRows = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(eq(guardians.userId, userId));
    if (guardianRows.length > 0) {
      const guardianIds = guardianRows.map((g) => g.id);
      const links = await db
        .select({ studentId: studentGuardians.studentId })
        .from(studentGuardians)
        .where(inArray(studentGuardians.guardianId, guardianIds));
      for (const link of links) studentIdSet.add(link.studentId);
    }
  }

  if (studentIdSet.size === 0) return [];

  const studentIds = Array.from(studentIdSet);
  const studentRows = await db
    .select()
    .from(students)
    .where(inArray(students.id, studentIds))
    .orderBy(asc(students.lastName), asc(students.firstName));

  const enrollRows = await db
    .select({
      studentId: enrollments.studentId,
      classId: enrollments.classId,
      className: classes.name,
      academicYearId: enrollments.academicYearId,
      yearStatus: academicYears.status,
    })
    .from(enrollments)
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .innerJoin(academicYears, eq(enrollments.academicYearId, academicYears.id))
    .where(and(inArray(enrollments.studentId, studentIds), eq(enrollments.status, 'ACTIVE')))
    .orderBy(desc(enrollments.id));

  const enrollMap = new Map<
    number,
    { classId: number; className: string; academicYearId: number }
  >();
  for (const er of enrollRows) {
    const prev = enrollMap.get(er.studentId);
    if (!prev || er.yearStatus === 'ACTIVE') {
      enrollMap.set(er.studentId, {
        classId: er.classId,
        className: er.className,
        academicYearId: er.academicYearId,
      });
    }
  }

  return studentRows.map((st) => {
    const en = enrollMap.get(st.id);
    return {
      id: st.id,
      matricule: st.matricule,
      firstName: st.firstName,
      lastName: st.lastName,
      classId: en?.classId ?? null,
      className: en?.className ?? null,
      academicYearId: en?.academicYearId ?? null,
    };
  });
}
