import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  academicYears,
  classes,
  enrollments,
  guardians,
  levels,
  studentAttendances,
  studentGuardians,
  students,
} from '../../../db/schema.ts';
import type {
  AttendanceStatus,
  ClassRollStudentItem,
  DailyAbsenteeItem,
  DailyAttendanceSummary,
} from './attendance.types.ts';

export async function getDailyAttendanceSummary(
  date: string,
  classId?: number
): Promise<DailyAttendanceSummary> {
  try {
    const activeYears = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.status, 'ACTIVE'))
      .limit(1);

    const activeYear = activeYears[0] ?? null;

    const enrollmentConditions = [
      eq(enrollments.status, 'ACTIVE'),
      eq(students.isArchived, false),
    ];
    if (activeYear) {
      enrollmentConditions.push(eq(enrollments.academicYearId, activeYear.id));
    }
    if (classId) {
      enrollmentConditions.push(eq(enrollments.classId, classId));
    }

    const attendanceConditions = [
      eq(studentAttendances.attendanceDate, date),
      eq(students.isArchived, false),
    ];
    if (activeYear) {
      attendanceConditions.push(eq(studentAttendances.academicYearId, activeYear.id));
    }
    if (classId) {
      attendanceConditions.push(eq(studentAttendances.classId, classId));
    }

    const [enrolledRows, attendanceRows] = await Promise.all([
      db
        .select({ value: count() })
        .from(enrollments)
        .innerJoin(students, eq(enrollments.studentId, students.id))
        .where(and(...enrollmentConditions)),
      db
        .select({
          attendanceId: studentAttendances.id,
          studentId: students.id,
          matricule: students.matricule,
          firstName: students.firstName,
          lastName: students.lastName,
          classId: classes.id,
          className: classes.name,
          levelName: levels.name,
          status: studentAttendances.status,
          isJustified: studentAttendances.isJustified,
          reason: studentAttendances.reason,
          updatedAt: studentAttendances.updatedAt,
        })
        .from(studentAttendances)
        .innerJoin(students, eq(studentAttendances.studentId, students.id))
        .innerJoin(classes, eq(studentAttendances.classId, classes.id))
        .innerJoin(levels, eq(classes.levelId, levels.id))
        .where(and(...attendanceConditions))
        .orderBy(asc(levels.orderIndex), asc(classes.name), asc(students.lastName), asc(students.firstName)),
    ]);

    const totalEnrolledStudents = Number(enrolledRows[0]?.value ?? 0);
    const recordedCount = attendanceRows.length;

    let presentCount = 0;
    let unjustifiedAbsentCount = 0;
    let excusedCount = 0;
    let lateCount = 0;

    const absentRows = attendanceRows.filter((row) => {
      if (row.status === 'PRESENT') presentCount++;
      else if (row.status === 'LATE') lateCount++;
      else if (row.status === 'ABSENT') {
        unjustifiedAbsentCount++;
        return true;
      } else if (row.status === 'EXCUSED') {
        excusedCount++;
        return true;
      }
      return false;
    });

    const absentCount = unjustifiedAbsentCount + excusedCount;
    const absenteeismRate =
      totalEnrolledStudents > 0
        ? Math.round((absentCount / totalEnrolledStudents) * 1000) / 10
        : 0;

    const absentStudentIds = absentRows.map((r) => r.studentId);
    const guardianMap = new Map<number, { name: string; phone: string }>();

    if (absentStudentIds.length > 0) {
      const guardianRows = await db
        .select({
          studentId: studentGuardians.studentId,
          firstName: guardians.firstName,
          lastName: guardians.lastName,
          phone: guardians.phone,
          isPrimaryContact: studentGuardians.isPrimaryContact,
        })
        .from(studentGuardians)
        .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
        .where(inArray(studentGuardians.studentId, absentStudentIds))
        .orderBy(desc(studentGuardians.isPrimaryContact));

      for (const g of guardianRows) {
        if (!guardianMap.has(g.studentId)) {
          guardianMap.set(g.studentId, {
            name: `${g.firstName} ${g.lastName}`,
            phone: g.phone,
          });
        }
      }
    }

    const absentees: DailyAbsenteeItem[] = absentRows.map((row) => {
      const guardian = guardianMap.get(row.studentId);
      return {
        attendanceId: row.attendanceId,
        studentId: row.studentId,
        matricule: row.matricule,
        firstName: row.firstName,
        lastName: row.lastName,
        classId: row.classId,
        className: row.className,
        levelName: row.levelName,
        status: row.status as 'ABSENT' | 'EXCUSED',
        isJustified: row.isJustified,
        reason: row.reason,
        primaryGuardianName: guardian?.name ?? null,
        primaryGuardianPhone: guardian?.phone ?? null,
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    return {
      date,
      academicYearId: activeYear?.id ?? null,
      academicYearName: activeYear?.name ?? null,
      totalEnrolledStudents,
      recordedCount,
      presentCount,
      absentCount,
      unjustifiedAbsentCount,
      excusedCount,
      lateCount,
      absenteeismRate,
      absentees,
      lastUpdatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in getDailyAttendanceSummary:', error);
    throw new Error('Impossible de calculer le suivi des présences du jour.', { cause: error });
  }
}

export async function getClassRoll(
  classId: number,
  date: string
): Promise<ClassRollStudentItem[]> {
  try {
    const [enrolledStudents, existingRecords] = await Promise.all([
      db
        .select({
          studentId: students.id,
          matricule: students.matricule,
          firstName: students.firstName,
          lastName: students.lastName,
          gender: students.gender,
        })
        .from(enrollments)
        .innerJoin(students, eq(enrollments.studentId, students.id))
        .where(
          and(
            eq(enrollments.classId, classId),
            eq(enrollments.status, 'ACTIVE'),
            eq(students.isArchived, false)
          )
        )
        .orderBy(asc(students.lastName), asc(students.firstName)),
      db
        .select()
        .from(studentAttendances)
        .where(
          and(
            eq(studentAttendances.classId, classId),
            eq(studentAttendances.attendanceDate, date)
          )
        ),
    ]);

    const recordMap = new Map(existingRecords.map((r) => [r.studentId, r]));

    return enrolledStudents.map((st) => {
      const rec = recordMap.get(st.studentId);
      return {
        studentId: st.studentId,
        matricule: st.matricule,
        firstName: st.firstName,
        lastName: st.lastName,
        gender: st.gender as 'M' | 'F',
        attendanceId: rec?.id ?? null,
        status: (rec?.status as AttendanceStatus) ?? null,
        isJustified: rec?.isJustified ?? false,
        reason: rec?.reason ?? '',
      };
    });
  } catch (error) {
    console.error('Database query failed in getClassRoll:', error);
    throw new Error('Impossible de charger la feuille d’appel de la classe.', { cause: error });
  }
}

export async function findActiveStudentIdsInClass(classId: number): Promise<number[]> {
  try {
    const rows = await db
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(
        and(
          eq(enrollments.classId, classId),
          eq(enrollments.status, 'ACTIVE'),
          eq(students.isArchived, false)
        )
      );
    return rows.map((r) => r.studentId);
  } catch (error) {
    console.error('Database query failed in findActiveStudentIdsInClass:', error);
    throw new Error('Impossible de vérifier les inscriptions de la classe.', { cause: error });
  }
}

export async function upsertBulkAttendance(params: {
  classId: number;
  academicYearId: number;
  date: string;
  recordedByUserId: number;
  entries: Array<{
    studentId: number;
    status: AttendanceStatus;
    reason: string;
    isJustified: boolean;
  }>;
}): Promise<number> {
  try {
    await db.transaction(async (tx) => {
      for (const entry of params.entries) {
        const isJustified =
          entry.status === 'EXCUSED' ? true : entry.status === 'PRESENT' ? false : entry.isJustified;

        await tx
          .insert(studentAttendances)
          .values({
            studentId: entry.studentId,
            classId: params.classId,
            academicYearId: params.academicYearId,
            attendanceDate: params.date,
            status: entry.status,
            reason: entry.reason,
            isJustified,
            recordedByUserId: params.recordedByUserId,
          })
          .onConflictDoUpdate({
            target: [studentAttendances.studentId, studentAttendances.attendanceDate],
            set: {
              classId: params.classId,
              academicYearId: params.academicYearId,
              status: entry.status,
              reason: entry.reason,
              isJustified,
              recordedByUserId: params.recordedByUserId,
              updatedAt: new Date(),
            },
          });
      }
    });
    return params.entries.length;
  } catch (error) {
    console.error('Database query failed in upsertBulkAttendance:', error);
    throw new Error('Échec de l’enregistrement de l’appel.', { cause: error });
  }
}

export async function findAttendanceById(
  id: number
): Promise<typeof studentAttendances.$inferSelect | null> {
  try {
    const rows = await db
      .select()
      .from(studentAttendances)
      .where(eq(studentAttendances.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findAttendanceById:', error);
    throw new Error('Impossible de récupérer la fiche de présence.', { cause: error });
  }
}

export async function updateAttendanceRecord(
  id: number,
  updates: {
    status?: AttendanceStatus;
    reason?: string;
    isJustified?: boolean;
    recordedByUserId: number;
  }
): Promise<typeof studentAttendances.$inferSelect> {
  try {
    const rows = await db
      .update(studentAttendances)
      .set({
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.reason !== undefined ? { reason: updates.reason } : {}),
        ...(updates.isJustified !== undefined ? { isJustified: updates.isJustified } : {}),
        recordedByUserId: updates.recordedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(studentAttendances.id, id))
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in updateAttendanceRecord:', error);
    throw new Error('Échec de la mise à jour de l’absence.', { cause: error });
  }
}
