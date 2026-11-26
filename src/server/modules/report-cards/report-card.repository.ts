import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  academicYears,
  classes,
  classSubjects,
  levels,
  reportCards,
  reportCardSubjectRemarks,
  schoolSettings,
  studentAttendances,
  students,
  subjects,
  teachers,
  terms,
} from '../../../db/schema.ts';
import type {
  ReportCardDetail,
  ReportCardItem,
  ReportCardStatus,
  ReportCardSubjectLine,
} from './report-card.types.ts';

export async function getSchoolHeaderSettings() {
  const rows = await db.select().from(schoolSettings).limit(1);
  return (
    rows[0] ?? {
      schoolName: 'Lycée Académia',
      address: '',
      phone: '',
      email: '',
    }
  );
}

export async function findStudentTermAttendanceCounts(
  classId: number,
  startDate: string,
  endDate: string
): Promise<Map<number, { absencesCount: number; latesCount: number }>> {
  const rows = await db
    .select({
      studentId: studentAttendances.studentId,
      status: studentAttendances.status,
    })
    .from(studentAttendances)
    .where(
      and(
        eq(studentAttendances.classId, classId),
        gte(studentAttendances.attendanceDate, startDate),
        lte(studentAttendances.attendanceDate, endDate)
      )
    );

  const map = new Map<number, { absencesCount: number; latesCount: number }>();
  for (const r of rows) {
    const curr = map.get(r.studentId) ?? { absencesCount: 0, latesCount: 0 };
    if (r.status === 'ABSENT' || r.status === 'EXCUSED') {
      curr.absencesCount += 1;
    } else if (r.status === 'LATE') {
      curr.latesCount += 1;
    }
    map.set(r.studentId, curr);
  }
  return map;
}

export async function findReportCardsByClassAndTerm(
  classId: number,
  termId: number
): Promise<ReportCardItem[]> {
  const rows = await db
    .select({
      rc: reportCards,
      st: students,
      cls: classes,
      lvl: levels,
      trm: terms,
      ay: academicYears,
    })
    .from(reportCards)
    .innerJoin(students, eq(reportCards.studentId, students.id))
    .innerJoin(classes, eq(reportCards.classId, classes.id))
    .innerJoin(levels, eq(classes.levelId, levels.id))
    .innerJoin(terms, eq(reportCards.termId, terms.id))
    .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id))
    .where(and(eq(reportCards.classId, classId), eq(reportCards.termId, termId)))
    .orderBy(asc(students.lastName), asc(students.firstName));

  return rows.map((r) => ({
    id: r.rc.id,
    studentId: r.rc.studentId,
    studentMatricule: r.st.matricule,
    studentFirstName: r.st.firstName,
    studentLastName: r.st.lastName,
    studentDateOfBirth: r.st.dateOfBirth,
    classId: r.rc.classId,
    className: r.cls.name,
    levelName: r.lvl.name,
    termId: r.rc.termId,
    termName: r.trm.name,
    academicYearId: r.ay.id,
    academicYearName: r.ay.name,
    academicYearStatus: r.ay.status,
    generalAverage: r.rc.generalAverage !== null ? Number(r.rc.generalAverage) : null,
    classAverage: r.rc.classAverage !== null ? Number(r.rc.classAverage) : null,
    rank: r.rc.rank,
    totalStudents: r.rc.totalStudents,
    absencesCount: r.rc.absencesCount,
    latesCount: r.rc.latesCount,
    honorMention: r.rc.honorMention,
    councilRemark: r.rc.councilRemark,
    status: r.rc.status as ReportCardStatus,
    validatedAt: r.rc.validatedAt ? r.rc.validatedAt.toISOString() : null,
    createdAt: r.rc.createdAt.toISOString(),
    updatedAt: r.rc.updatedAt.toISOString(),
  }));
}

export async function findValidatedReportCardsByStudentIds(
  studentIds: number[]
): Promise<ReportCardItem[]> {
  if (studentIds.length === 0) return [];

  const rows = await db
    .select({
      rc: reportCards,
      st: students,
      cls: classes,
      lvl: levels,
      trm: terms,
      ay: academicYears,
    })
    .from(reportCards)
    .innerJoin(students, eq(reportCards.studentId, students.id))
    .innerJoin(classes, eq(reportCards.classId, classes.id))
    .innerJoin(levels, eq(classes.levelId, levels.id))
    .innerJoin(terms, eq(reportCards.termId, terms.id))
    .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id))
    .where(
      and(inArray(reportCards.studentId, studentIds), eq(reportCards.status, 'VALIDATED'))
    )
    .orderBy(desc(academicYears.startDate), asc(terms.orderIndex));

  return rows.map((r) => ({
    id: r.rc.id,
    studentId: r.rc.studentId,
    studentMatricule: r.st.matricule,
    studentFirstName: r.st.firstName,
    studentLastName: r.st.lastName,
    studentDateOfBirth: r.st.dateOfBirth,
    classId: r.rc.classId,
    className: r.cls.name,
    levelName: r.lvl.name,
    termId: r.rc.termId,
    termName: r.trm.name,
    academicYearId: r.ay.id,
    academicYearName: r.ay.name,
    academicYearStatus: r.ay.status,
    generalAverage: r.rc.generalAverage !== null ? Number(r.rc.generalAverage) : null,
    classAverage: r.rc.classAverage !== null ? Number(r.rc.classAverage) : null,
    rank: r.rc.rank,
    totalStudents: r.rc.totalStudents,
    absencesCount: r.rc.absencesCount,
    latesCount: r.rc.latesCount,
    honorMention: r.rc.honorMention,
    councilRemark: r.rc.councilRemark,
    status: r.rc.status as ReportCardStatus,
    validatedAt: r.rc.validatedAt ? r.rc.validatedAt.toISOString() : null,
    createdAt: r.rc.createdAt.toISOString(),
    updatedAt: r.rc.updatedAt.toISOString(),
  }));
}

export async function findReportCardDetailById(
  id: number
): Promise<ReportCardDetail | null> {
  const rows = await db
    .select({
      rc: reportCards,
      st: students,
      cls: classes,
      lvl: levels,
      trm: terms,
      ay: academicYears,
    })
    .from(reportCards)
    .innerJoin(students, eq(reportCards.studentId, students.id))
    .innerJoin(classes, eq(reportCards.classId, classes.id))
    .innerJoin(levels, eq(classes.levelId, levels.id))
    .innerJoin(terms, eq(reportCards.termId, terms.id))
    .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id))
    .where(eq(reportCards.id, id))
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  const subjectRows = await db
    .select({
      rem: reportCardSubjectRemarks,
      cs: classSubjects,
      sub: subjects,
      tFirst: teachers.firstName,
      tLast: teachers.lastName,
    })
    .from(reportCardSubjectRemarks)
    .innerJoin(classSubjects, eq(reportCardSubjectRemarks.classSubjectId, classSubjects.id))
    .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .leftJoin(teachers, eq(classSubjects.teacherId, teachers.id))
    .where(eq(reportCardSubjectRemarks.reportCardId, id))
    .orderBy(asc(classSubjects.isOptional), asc(subjects.name));

  const subjectLines: ReportCardSubjectLine[] = subjectRows.map((sr) => ({
    id: sr.rem.id,
    classSubjectId: sr.rem.classSubjectId,
    subjectCode: sr.sub.code,
    subjectName: sr.sub.name,
    teacherFullName:
      sr.tFirst && sr.tLast ? `${sr.tLast} ${sr.tFirst}` : null,
    coefficient: Number(sr.rem.coefficient),
    subjectAverage:
      sr.rem.subjectAverage !== null ? Number(sr.rem.subjectAverage) : null,
    classSubjectAverage:
      sr.rem.classSubjectAverage !== null ? Number(sr.rem.classSubjectAverage) : null,
    teacherRemark: sr.rem.teacherRemark,
  }));

  return {
    id: r.rc.id,
    studentId: r.rc.studentId,
    studentMatricule: r.st.matricule,
    studentFirstName: r.st.firstName,
    studentLastName: r.st.lastName,
    studentDateOfBirth: r.st.dateOfBirth,
    classId: r.rc.classId,
    className: r.cls.name,
    levelName: r.lvl.name,
    termId: r.rc.termId,
    termName: r.trm.name,
    academicYearId: r.ay.id,
    academicYearName: r.ay.name,
    academicYearStatus: r.ay.status,
    generalAverage: r.rc.generalAverage !== null ? Number(r.rc.generalAverage) : null,
    classAverage: r.rc.classAverage !== null ? Number(r.rc.classAverage) : null,
    rank: r.rc.rank,
    totalStudents: r.rc.totalStudents,
    absencesCount: r.rc.absencesCount,
    latesCount: r.rc.latesCount,
    honorMention: r.rc.honorMention,
    councilRemark: r.rc.councilRemark,
    status: r.rc.status as ReportCardStatus,
    validatedAt: r.rc.validatedAt ? r.rc.validatedAt.toISOString() : null,
    createdAt: r.rc.createdAt.toISOString(),
    updatedAt: r.rc.updatedAt.toISOString(),
    subjects: subjectLines,
  };
}

export async function upsertGeneratedReportCards(params: {
  classId: number;
  termId: number;
  classAverage: number | null;
  totalStudents: number;
  cards: Array<{
    studentId: number;
    generalAverage: number | null;
    rank: number | null;
    absencesCount: number;
    latesCount: number;
    suggestedMention: string;
    subjectLines: Array<{
      classSubjectId: number;
      subjectAverage: number | null;
      classSubjectAverage: number | null;
      coefficient: number;
    }>;
  }>;
}): Promise<{ createdCount: number; updatedCount: number; skippedValidatedCount: number }> {
  let createdCount = 0;
  let updatedCount = 0;
  let skippedValidatedCount = 0;

  await db.transaction(async (tx) => {
    const existingCards = await tx
      .select()
      .from(reportCards)
      .where(
        and(eq(reportCards.classId, params.classId), eq(reportCards.termId, params.termId))
      );

    const existingByStudent = new Map(existingCards.map((c) => [c.studentId, c]));

    for (const card of params.cards) {
      const existing = existingByStudent.get(card.studentId);
      if (existing && existing.status === 'VALIDATED') {
        skippedValidatedCount += 1;
        continue;
      }

      let cardId: number;
      const genAvgStr =
        card.generalAverage !== null ? card.generalAverage.toFixed(2) : null;
      const clsAvgStr =
        params.classAverage !== null ? params.classAverage.toFixed(2) : null;

      if (existing) {
        await tx
          .update(reportCards)
          .set({
            generalAverage: genAvgStr,
            classAverage: clsAvgStr,
            rank: card.rank,
            totalStudents: params.totalStudents,
            absencesCount: card.absencesCount,
            latesCount: card.latesCount,
            honorMention: existing.honorMention || card.suggestedMention,
            updatedAt: new Date(),
          })
          .where(eq(reportCards.id, existing.id));
        cardId = existing.id;
        updatedCount += 1;
      } else {
        const inserted = await tx
          .insert(reportCards)
          .values({
            studentId: card.studentId,
            classId: params.classId,
            termId: params.termId,
            generalAverage: genAvgStr,
            classAverage: clsAvgStr,
            rank: card.rank,
            totalStudents: params.totalStudents,
            absencesCount: card.absencesCount,
            latesCount: card.latesCount,
            honorMention: card.suggestedMention,
            councilRemark: '',
            status: 'DRAFT',
          })
          .returning({ id: reportCards.id });
        cardId = inserted[0].id;
        createdCount += 1;
      }

      for (const line of card.subjectLines) {
        const subAvgStr =
          line.subjectAverage !== null ? line.subjectAverage.toFixed(2) : null;
        const clsSubAvgStr =
          line.classSubjectAverage !== null ? line.classSubjectAverage.toFixed(2) : null;

        await tx
          .insert(reportCardSubjectRemarks)
          .values({
            reportCardId: cardId,
            classSubjectId: line.classSubjectId,
            subjectAverage: subAvgStr,
            classSubjectAverage: clsSubAvgStr,
            coefficient: line.coefficient.toFixed(1),
            teacherRemark: '',
          })
          .onConflictDoUpdate({
            target: [
              reportCardSubjectRemarks.reportCardId,
              reportCardSubjectRemarks.classSubjectId,
            ],
            set: {
              subjectAverage: subAvgStr,
              classSubjectAverage: clsSubAvgStr,
              coefficient: line.coefficient.toFixed(1),
              updatedAt: new Date(),
            },
          });
      }
    }
  });

  return { createdCount, updatedCount, skippedValidatedCount };
}

export async function updateReportCardFieldsAndRemarks(
  id: number,
  updates: {
    honorMention?: string;
    councilRemark?: string;
    subjectRemarks?: Array<{ classSubjectId: number; teacherRemark: string }>;
  }
): Promise<void> {
  await db.transaction(async (tx) => {
    if (updates.honorMention !== undefined || updates.councilRemark !== undefined) {
      await tx
        .update(reportCards)
        .set({
          ...(updates.honorMention !== undefined
            ? { honorMention: updates.honorMention }
            : {}),
          ...(updates.councilRemark !== undefined
            ? { councilRemark: updates.councilRemark }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(reportCards.id, id));
    }

    if (updates.subjectRemarks && updates.subjectRemarks.length > 0) {
      for (const rem of updates.subjectRemarks) {
        await tx
          .update(reportCardSubjectRemarks)
          .set({
            teacherRemark: rem.teacherRemark,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(reportCardSubjectRemarks.reportCardId, id),
              eq(reportCardSubjectRemarks.classSubjectId, rem.classSubjectId)
            )
          );
      }
      await tx
        .update(reportCards)
        .set({ updatedAt: new Date() })
        .where(eq(reportCards.id, id));
    }
  });
}

export async function setReportCardStatus(
  id: number,
  status: ReportCardStatus,
  userId: number | null
): Promise<void> {
  await db
    .update(reportCards)
    .set({
      status,
      validatedByUserId: status === 'VALIDATED' ? userId : null,
      validatedAt: status === 'VALIDATED' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(reportCards.id, id));
}

export async function validateAllDraftCardsForClassTerm(
  classId: number,
  termId: number,
  userId: number
): Promise<number> {
  const updated = await db
    .update(reportCards)
    .set({
      status: 'VALIDATED',
      validatedByUserId: userId,
      validatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reportCards.classId, classId),
        eq(reportCards.termId, termId),
        eq(reportCards.status, 'DRAFT')
      )
    )
    .returning({ id: reportCards.id });

  return updated.length;
}
