import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  academicYears,
  classes,
  enrollments,
  guardians,
  levels,
  series,
  studentGuardians,
  students,
} from '../../../db/schema.ts';
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput } from './student.schema.ts';
import type {
  EnrollmentItem,
  EnrollmentStatus,
  Gender,
  StudentDossier,
  StudentGuardianSummary,
  StudentItem,
} from './student.types.ts';

async function fetchEnrollmentsForStudents(
  studentIds: number[]
): Promise<Map<number, EnrollmentItem[]>> {
  const map = new Map<number, EnrollmentItem[]>();
  if (studentIds.length === 0) return map;

  const rows = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      academicYearId: enrollments.academicYearId,
      academicYearName: academicYears.name,
      academicYearStatus: academicYears.status,
      classId: enrollments.classId,
      className: classes.name,
      levelName: levels.name,
      seriesName: series.name,
      enrollmentDate: enrollments.enrollmentDate,
      status: enrollments.status,
      notes: enrollments.notes,
    })
    .from(enrollments)
    .innerJoin(academicYears, eq(enrollments.academicYearId, academicYears.id))
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .innerJoin(levels, eq(classes.levelId, levels.id))
    .leftJoin(series, eq(classes.seriesId, series.id))
    .where(inArray(enrollments.studentId, studentIds))
    .orderBy(desc(academicYears.startDate), desc(enrollments.id));

  for (const r of rows) {
    const arr = map.get(r.studentId) ?? [];
    arr.push({
      id: r.id,
      studentId: r.studentId,
      academicYearId: r.academicYearId,
      academicYearName: r.academicYearName,
      academicYearStatus: r.academicYearStatus,
      classId: r.classId,
      className: r.className,
      levelName: r.levelName,
      seriesName: r.seriesName,
      enrollmentDate: r.enrollmentDate,
      status: r.status as EnrollmentStatus,
      notes: r.notes,
    });
    map.set(r.studentId, arr);
  }
  return map;
}

function mapStudentRow(
  row: typeof students.$inferSelect,
  studentEnrollments: EnrollmentItem[]
): StudentItem {
  const current =
    studentEnrollments.find((e) => e.academicYearStatus === 'ACTIVE') ??
    studentEnrollments[0] ??
    null;

  return {
    id: row.id,
    matricule: row.matricule,
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    gender: row.gender as Gender,
    dateOfBirth: row.dateOfBirth,
    placeOfBirth: row.placeOfBirth,
    nationality: row.nationality,
    address: row.address,
    phone: row.phone,
    email: row.email,
    photoUrl: row.photoUrl,
    medicalNotes: row.medicalNotes,
    isArchived: row.isArchived,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    currentEnrollment: current,
  };
}

export async function generateNextMatricule(prefixYear = new Date().getFullYear()): Promise<string> {
  try {
    const prefix = `ETU-${prefixYear}-`;
    const rows = await db
      .select({ matricule: students.matricule })
      .from(students)
      .where(ilike(students.matricule, `${prefix}%`))
      .orderBy(desc(students.id))
      .limit(50);

    let maxSeq = 0;
    for (const r of rows) {
      const suffix = r.matricule.slice(prefix.length);
      const num = Number.parseInt(suffix, 10);
      if (Number.isFinite(num) && num > maxSeq) maxSeq = num;
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  } catch (error) {
    console.error('Database query failed in generateNextMatricule:', error);
    throw new Error('Impossible de générer un matricule élève.', { cause: error });
  }
}

export async function findStudents(
  query: ListStudentsQuery
): Promise<{ items: StudentItem[]; total: number }> {
  try {
    const conditions = [];
    if (!query.includeArchived) {
      conditions.push(eq(students.isArchived, false));
    }
    if (query.gender) {
      conditions.push(eq(students.gender, query.gender));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(students.matricule, pattern),
          ilike(students.firstName, pattern),
          ilike(students.lastName, pattern),
          ilike(students.email, pattern)
        )
      );
    }

    if (query.academicYearId || query.classId || query.levelId) {
      const enrollConditions = [];
      if (query.academicYearId) {
        enrollConditions.push(eq(enrollments.academicYearId, query.academicYearId));
      }
      if (query.classId) {
        enrollConditions.push(eq(enrollments.classId, query.classId));
      }
      if (query.levelId) {
        const classIdsForLevel = db
          .select({ id: classes.id })
          .from(classes)
          .where(eq(classes.levelId, query.levelId));
        enrollConditions.push(inArray(enrollments.classId, classIdsForLevel));
      }

      const matchingStudentIds = db
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(and(...enrollConditions));

      conditions.push(inArray(students.id, matchingStudentIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(students)
        .where(whereClause)
        .orderBy(desc(students.createdAt), desc(students.id))
        .limit(query.limit)
        .offset(offset),
      db.select({ value: count() }).from(students).where(whereClause),
    ]);

    const enrollMap = await fetchEnrollmentsForStudents(rows.map((r) => r.id));
    const items = rows.map((r) => mapStudentRow(r, enrollMap.get(r.id) ?? []));

    return { items, total: Number(totalRows[0]?.value ?? 0) };
  } catch (error) {
    console.error('Database query failed in findStudents:', error);
    throw new Error('Impossible de charger la liste des élèves.', { cause: error });
  }
}

export async function findStudentDossierById(id: number): Promise<StudentDossier | null> {
  try {
    const rows = await db.select().from(students).where(eq(students.id, id)).limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];

    const [enrollMap, guardianRows] = await Promise.all([
      fetchEnrollmentsForStudents([row.id]),
      db
        .select({
          guardianId: guardians.id,
          firstName: guardians.firstName,
          lastName: guardians.lastName,
          phone: guardians.phone,
          email: guardians.email,
          relationship: studentGuardians.relationship,
          isPrimaryContact: studentGuardians.isPrimaryContact,
          hasLegalCustody: studentGuardians.hasLegalCustody,
          canPickup: studentGuardians.canPickup,
        })
        .from(studentGuardians)
        .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
        .where(eq(studentGuardians.studentId, row.id)),
    ]);

    const studentEnrollments = enrollMap.get(row.id) ?? [];
    const base = mapStudentRow(row, studentEnrollments);
    const linkedGuardians: StudentGuardianSummary[] = guardianRows.map((g) => ({
      guardianId: g.guardianId,
      firstName: g.firstName,
      lastName: g.lastName,
      phone: g.phone,
      email: g.email,
      relationship: g.relationship,
      isPrimaryContact: g.isPrimaryContact,
      hasLegalCustody: g.hasLegalCustody,
      canPickup: g.canPickup,
    }));

    return {
      ...base,
      enrollments: studentEnrollments,
      guardians: linkedGuardians,
    };
  } catch (error) {
    console.error('Database query failed in findStudentDossierById:', error);
    throw new Error('Impossible de récupérer le dossier de l’élève.', { cause: error });
  }
}

export async function findStudentByMatricule(matricule: string): Promise<typeof students.$inferSelect | null> {
  try {
    const rows = await db
      .select()
      .from(students)
      .where(eq(students.matricule, matricule))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findStudentByMatricule:', error);
    throw new Error('Impossible de vérifier le matricule.', { cause: error });
  }
}

export async function createStudentTransaction(params: {
  matricule: string;
  input: CreateStudentInput;
  enrollmentDate?: string;
}): Promise<StudentDossier> {
  try {
    const createdId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(students)
        .values({
          matricule: params.matricule,
          firstName: params.input.firstName,
          lastName: params.input.lastName,
          gender: params.input.gender,
          dateOfBirth: params.input.dateOfBirth,
          placeOfBirth: params.input.placeOfBirth,
          nationality: params.input.nationality,
          address: params.input.address,
          phone: params.input.phone,
          email: params.input.email,
          photoUrl: params.input.photoUrl || null,
          medicalNotes: params.input.medicalNotes,
        })
        .returning();

      const student = inserted[0];

      if (params.input.initialEnrollment) {
        await tx.insert(enrollments).values({
          studentId: student.id,
          academicYearId: params.input.initialEnrollment.academicYearId,
          classId: params.input.initialEnrollment.classId,
          enrollmentDate:
            params.input.initialEnrollment.enrollmentDate ??
            params.enrollmentDate ??
            new Date().toISOString().slice(0, 10),
          status: 'ACTIVE',
          notes: params.input.initialEnrollment.notes ?? '',
        });
      }

      return student.id;
    });

    const dossier = await findStudentDossierById(createdId);
    if (!dossier) throw new Error('Dossier élève créé introuvable.');
    return dossier;
  } catch (error) {
    console.error('Database query failed in createStudentTransaction:', error);
    throw new Error('Échec de l’enregistrement de l’élève.', { cause: error });
  }
}

export async function updateStudentRecord(
  id: number,
  updates: UpdateStudentInput
): Promise<StudentDossier> {
  try {
    const setPayload: Partial<typeof students.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (updates.firstName !== undefined) setPayload.firstName = updates.firstName;
    if (updates.lastName !== undefined) setPayload.lastName = updates.lastName;
    if (updates.gender !== undefined) setPayload.gender = updates.gender;
    if (updates.dateOfBirth !== undefined) setPayload.dateOfBirth = updates.dateOfBirth;
    if (updates.placeOfBirth !== undefined) setPayload.placeOfBirth = updates.placeOfBirth;
    if (updates.nationality !== undefined) setPayload.nationality = updates.nationality;
    if (updates.address !== undefined) setPayload.address = updates.address;
    if (updates.phone !== undefined) setPayload.phone = updates.phone;
    if (updates.email !== undefined) setPayload.email = updates.email;
    if (updates.photoUrl !== undefined) setPayload.photoUrl = updates.photoUrl || null;
    if (updates.medicalNotes !== undefined) setPayload.medicalNotes = updates.medicalNotes;
    if (updates.isArchived !== undefined) {
      setPayload.isArchived = updates.isArchived;
      setPayload.archivedAt = updates.isArchived ? new Date() : null;
    }

    await db.update(students).set(setPayload).where(eq(students.id, id));
    const dossier = await findStudentDossierById(id);
    if (!dossier) throw new Error('Élève introuvable.');
    return dossier;
  } catch (error) {
    console.error('Database query failed in updateStudentRecord:', error);
    throw new Error('Échec de la mise à jour du dossier élève.', { cause: error });
  }
}

export async function countActiveEnrollmentsInClass(classId: number): Promise<number> {
  try {
    const rows = await db
      .select({ value: count() })
      .from(enrollments)
      .where(and(eq(enrollments.classId, classId), eq(enrollments.status, 'ACTIVE')));
    return Number(rows[0]?.value ?? 0);
  } catch (error) {
    console.error('Database query failed in countActiveEnrollmentsInClass:', error);
    throw new Error('Impossible de vérifier l’effectif de la classe.', { cause: error });
  }
}

export async function findEnrollmentByStudentAndYear(
  studentId: number,
  academicYearId: number
): Promise<typeof enrollments.$inferSelect | null> {
  try {
    const rows = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.academicYearId, academicYearId)
        )
      )
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findEnrollmentByStudentAndYear:', error);
    throw new Error('Impossible de vérifier l’inscription existante.', { cause: error });
  }
}

export async function findEnrollmentById(
  enrollmentId: number
): Promise<typeof enrollments.$inferSelect | null> {
  try {
    const rows = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, enrollmentId))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findEnrollmentById:', error);
    throw new Error('Impossible de récupérer l’inscription.', { cause: error });
  }
}

export async function insertEnrollment(input: {
  studentId: number;
  academicYearId: number;
  classId: number;
  enrollmentDate: string;
  notes: string;
}): Promise<EnrollmentItem> {
  try {
    const rows = await db
      .insert(enrollments)
      .values({
        studentId: input.studentId,
        academicYearId: input.academicYearId,
        classId: input.classId,
        enrollmentDate: input.enrollmentDate,
        status: 'ACTIVE',
        notes: input.notes,
      })
      .returning();

    const map = await fetchEnrollmentsForStudents([input.studentId]);
    const match = (map.get(input.studentId) ?? []).find((e) => e.id === rows[0].id);
    if (!match) throw new Error('Inscription créée introuvable.');
    return match;
  } catch (error) {
    console.error('Database query failed in insertEnrollment:', error);
    throw new Error('Échec de l’inscription de l’élève.', { cause: error });
  }
}

export async function updateEnrollmentRecord(
  enrollmentId: number,
  studentId: number,
  updates: { classId?: number; status?: EnrollmentStatus; notes?: string }
): Promise<EnrollmentItem> {
  try {
    await db
      .update(enrollments)
      .set({
        ...(updates.classId !== undefined ? { classId: updates.classId } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(enrollments.id, enrollmentId));

    const map = await fetchEnrollmentsForStudents([studentId]);
    const match = (map.get(studentId) ?? []).find((e) => e.id === enrollmentId);
    if (!match) throw new Error('Inscription introuvable.');
    return match;
  } catch (error) {
    console.error('Database query failed in updateEnrollmentRecord:', error);
    throw new Error('Échec de la mise à jour de l’inscription.', { cause: error });
  }
}

export async function findStudentsInClass(classId: number): Promise<
  Array<{
    enrollmentId: number;
    studentId: number;
    matricule: string;
    firstName: string;
    lastName: string;
    gender: Gender;
    dateOfBirth: string;
    enrollmentDate: string;
    status: EnrollmentStatus;
  }>
> {
  try {
    const rows = await db
      .select({
        enrollmentId: enrollments.id,
        studentId: students.id,
        matricule: students.matricule,
        firstName: students.firstName,
        lastName: students.lastName,
        gender: students.gender,
        dateOfBirth: students.dateOfBirth,
        enrollmentDate: enrollments.enrollmentDate,
        status: enrollments.status,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(and(eq(enrollments.classId, classId), eq(students.isArchived, false)))
      .orderBy(students.lastName, students.firstName);

    return rows.map((r) => ({
      ...r,
      gender: r.gender as Gender,
      status: r.status as EnrollmentStatus,
    }));
  } catch (error) {
    console.error('Database query failed in findStudentsInClass:', error);
    throw new Error('Impossible de charger la liste des élèves de la classe.', {
      cause: error,
    });
  }
}
