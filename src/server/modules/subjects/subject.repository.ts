import { and, asc, count, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import { classes, classSubjects, subjects, teachers } from '../../../db/schema.ts';
import type { ListSubjectsQuery } from './subject.schema.ts';
import type { ClassSubjectItem, SubjectItem } from './subject.types.ts';

function mapSubjectRow(
  row: typeof subjects.$inferSelect,
  assignedClassCount: number
): SubjectItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    department: row.department,
    defaultCoefficient: Number(row.defaultCoefficient),
    description: row.description,
    isActive: row.isActive,
    assignedClassCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findAllSubjects(query: ListSubjectsQuery): Promise<SubjectItem[]> {
  try {
    const conditions = [];
    if (query.activeOnly) {
      conditions.push(eq(subjects.isActive, true));
    }
    if (query.department) {
      conditions.push(eq(subjects.department, query.department));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(subjects.code, pattern),
          ilike(subjects.name, pattern),
          ilike(subjects.department, pattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [subjectRows, countRows] = await Promise.all([
      db
        .select()
        .from(subjects)
        .where(whereClause)
        .orderBy(asc(subjects.department), asc(subjects.name)),
      db
        .select({
          subjectId: classSubjects.subjectId,
          value: count(),
        })
        .from(classSubjects)
        .groupBy(classSubjects.subjectId),
    ]);

    const countMap = new Map(countRows.map((c) => [c.subjectId, Number(c.value)]));
    return subjectRows.map((s) => mapSubjectRow(s, countMap.get(s.id) ?? 0));
  } catch (error) {
    console.error('Database query failed in findAllSubjects:', error);
    throw new Error('Impossible de charger le référentiel des matières.', { cause: error });
  }
}

export async function findSubjectById(id: number): Promise<SubjectItem | null> {
  try {
    const rows = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
    if (!rows[0]) return null;
    const countRows = await db
      .select({ value: count() })
      .from(classSubjects)
      .where(eq(classSubjects.subjectId, id));
    return mapSubjectRow(rows[0], Number(countRows[0]?.value ?? 0));
  } catch (error) {
    console.error('Database query failed in findSubjectById:', error);
    throw new Error('Impossible de récupérer la matière.', { cause: error });
  }
}

export async function findSubjectByCode(code: string): Promise<SubjectItem | null> {
  try {
    const rows = await db
      .select()
      .from(subjects)
      .where(eq(subjects.code, code.trim().toUpperCase()))
      .limit(1);
    if (!rows[0]) return null;
    return mapSubjectRow(rows[0], 0);
  } catch (error) {
    console.error('Database query failed in findSubjectByCode:', error);
    throw new Error('Impossible de vérifier le code matière.', { cause: error });
  }
}

export async function insertSubject(input: {
  code: string;
  name: string;
  department: string;
  defaultCoefficient: number;
  description: string;
}): Promise<SubjectItem> {
  try {
    const rows = await db
      .insert(subjects)
      .values({
        code: input.code.toUpperCase(),
        name: input.name,
        department: input.department,
        defaultCoefficient: input.defaultCoefficient.toFixed(1),
        description: input.description,
        isActive: true,
      })
      .returning();

    return mapSubjectRow(rows[0], 0);
  } catch (error) {
    console.error('Database query failed in insertSubject:', error);
    throw new Error('Échec de la création de la matière.', { cause: error });
  }
}

export async function updateSubjectRecord(
  id: number,
  updates: Partial<{
    code: string;
    name: string;
    department: string;
    defaultCoefficient: number;
    description: string;
    isActive: boolean;
  }>
): Promise<SubjectItem> {
  try {
    await db
      .update(subjects)
      .set({
        ...(updates.code !== undefined ? { code: updates.code.toUpperCase() } : {}),
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.department !== undefined ? { department: updates.department } : {}),
        ...(updates.defaultCoefficient !== undefined
          ? { defaultCoefficient: updates.defaultCoefficient.toFixed(1) }
          : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(subjects.id, id));

    const updated = await findSubjectById(id);
    if (!updated) throw new Error('Matière introuvable.');
    return updated;
  } catch (error) {
    console.error('Database query failed in updateSubjectRecord:', error);
    throw new Error('Échec de la mise à jour de la matière.', { cause: error });
  }
}

export async function findClassSubjectsByClassId(classId: number): Promise<ClassSubjectItem[]> {
  try {
    const rows = await db
      .select({
        cs: classSubjects,
        className: classes.name,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        subjectDepartment: subjects.department,
        subjectIsActive: subjects.isActive,
        teacherEmployeeCode: teachers.employeeCode,
        teacherFirstName: teachers.firstName,
        teacherLastName: teachers.lastName,
        teacherSpecialty: teachers.specialty,
      })
      .from(classSubjects)
      .innerJoin(classes, eq(classSubjects.classId, classes.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .leftJoin(teachers, eq(classSubjects.teacherId, teachers.id))
      .where(eq(classSubjects.classId, classId))
      .orderBy(asc(classSubjects.isOptional), asc(subjects.name));

    return rows.map((r) => ({
      id: r.cs.id,
      classId: r.cs.classId,
      className: r.className,
      subjectId: r.cs.subjectId,
      subjectCode: r.subjectCode,
      subjectName: r.subjectName,
      subjectDepartment: r.subjectDepartment,
      subjectIsActive: r.subjectIsActive,
      teacherId: r.cs.teacherId,
      teacherEmployeeCode: r.teacherEmployeeCode ?? null,
      teacherFullName:
        r.teacherFirstName && r.teacherLastName
          ? `${r.teacherLastName} ${r.teacherFirstName}`
          : null,
      teacherSpecialty: r.teacherSpecialty ?? null,
      coefficient: Number(r.cs.coefficient),
      weeklyHours: Number(r.cs.weeklyHours),
      isOptional: r.cs.isOptional,
      createdAt: r.cs.createdAt.toISOString(),
      updatedAt: r.cs.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error('Database query failed in findClassSubjectsByClassId:', error);
    throw new Error('Impossible de charger le programme de la classe.', { cause: error });
  }
}

export async function findClassSubjectById(id: number): Promise<ClassSubjectItem | null> {
  try {
    const rows = await db
      .select({
        cs: classSubjects,
        className: classes.name,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        subjectDepartment: subjects.department,
        subjectIsActive: subjects.isActive,
        teacherEmployeeCode: teachers.employeeCode,
        teacherFirstName: teachers.firstName,
        teacherLastName: teachers.lastName,
        teacherSpecialty: teachers.specialty,
      })
      .from(classSubjects)
      .innerJoin(classes, eq(classSubjects.classId, classes.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .leftJoin(teachers, eq(classSubjects.teacherId, teachers.id))
      .where(eq(classSubjects.id, id))
      .limit(1);

    const r = rows[0];
    if (!r) return null;

    return {
      id: r.cs.id,
      classId: r.cs.classId,
      className: r.className,
      subjectId: r.cs.subjectId,
      subjectCode: r.subjectCode,
      subjectName: r.subjectName,
      subjectDepartment: r.subjectDepartment,
      subjectIsActive: r.subjectIsActive,
      teacherId: r.cs.teacherId,
      teacherEmployeeCode: r.teacherEmployeeCode ?? null,
      teacherFullName:
        r.teacherFirstName && r.teacherLastName
          ? `${r.teacherLastName} ${r.teacherFirstName}`
          : null,
      teacherSpecialty: r.teacherSpecialty ?? null,
      coefficient: Number(r.cs.coefficient),
      weeklyHours: Number(r.cs.weeklyHours),
      isOptional: r.cs.isOptional,
      createdAt: r.cs.createdAt.toISOString(),
      updatedAt: r.cs.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in findClassSubjectById:', error);
    throw new Error('Impossible de récupérer l’affectation matière.', { cause: error });
  }
}

export async function findClassSubjectByPair(
  classId: number,
  subjectId: number
): Promise<ClassSubjectItem | null> {
  try {
    const rows = await db
      .select({ id: classSubjects.id })
      .from(classSubjects)
      .where(
        and(eq(classSubjects.classId, classId), eq(classSubjects.subjectId, subjectId))
      )
      .limit(1);
    if (!rows[0]) return null;
    return await findClassSubjectById(rows[0].id);
  } catch (error) {
    console.error('Database query failed in findClassSubjectByPair:', error);
    throw new Error('Impossible de vérifier le programme de la classe.', { cause: error });
  }
}

export async function insertClassSubject(input: {
  classId: number;
  subjectId: number;
  teacherId: number | null;
  coefficient: number;
  weeklyHours: number;
  isOptional: boolean;
}): Promise<ClassSubjectItem> {
  try {
    const inserted = await db
      .insert(classSubjects)
      .values({
        classId: input.classId,
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        coefficient: input.coefficient.toFixed(1),
        weeklyHours: input.weeklyHours.toFixed(1),
        isOptional: input.isOptional,
      })
      .returning();

    const created = await findClassSubjectById(inserted[0].id);
    if (!created) throw new Error('Affectation créée introuvable.');
    return created;
  } catch (error) {
    console.error('Database query failed in insertClassSubject:', error);
    throw new Error('Échec de l’ajout de la matière au programme.', { cause: error });
  }
}

export async function updateClassSubjectRecord(
  id: number,
  updates: Partial<{
    teacherId: number | null;
    coefficient: number;
    weeklyHours: number;
    isOptional: boolean;
  }>
): Promise<ClassSubjectItem> {
  try {
    await db
      .update(classSubjects)
      .set({
        ...(updates.teacherId !== undefined ? { teacherId: updates.teacherId } : {}),
        ...(updates.coefficient !== undefined
          ? { coefficient: updates.coefficient.toFixed(1) }
          : {}),
        ...(updates.weeklyHours !== undefined
          ? { weeklyHours: updates.weeklyHours.toFixed(1) }
          : {}),
        ...(updates.isOptional !== undefined ? { isOptional: updates.isOptional } : {}),
        updatedAt: new Date(),
      })
      .where(eq(classSubjects.id, id));

    const updated = await findClassSubjectById(id);
    if (!updated) throw new Error('Affectation matière introuvable.');
    return updated;
  } catch (error) {
    console.error('Database query failed in updateClassSubjectRecord:', error);
    throw new Error('Échec de la mise à jour de l’affectation.', { cause: error });
  }
}

export async function deleteClassSubjectRecord(id: number): Promise<void> {
  try {
    await db.delete(classSubjects).where(eq(classSubjects.id, id));
  } catch (error) {
    console.error('Database query failed in deleteClassSubjectRecord:', error);
    throw new Error('Échec de la suppression de la matière du programme.', { cause: error });
  }
}

export async function copyClassSubjectsBatch(
  targetClassId: number,
  entries: Array<{
    subjectId: number;
    teacherId: number | null;
    coefficient: number;
    weeklyHours: number;
    isOptional: boolean;
  }>
): Promise<number> {
  if (entries.length === 0) return 0;

  try {
    let insertedCount = 0;
    await db.transaction(async (tx) => {
      for (const entry of entries) {
        const res = await tx
          .insert(classSubjects)
          .values({
            classId: targetClassId,
            subjectId: entry.subjectId,
            teacherId: entry.teacherId,
            coefficient: entry.coefficient.toFixed(1),
            weeklyHours: entry.weeklyHours.toFixed(1),
            isOptional: entry.isOptional,
          })
          .onConflictDoNothing({
            target: [classSubjects.classId, classSubjects.subjectId],
          })
          .returning({ id: classSubjects.id });
        if (res.length > 0) insertedCount += 1;
      }
    });
    return insertedCount;
  } catch (error) {
    console.error('Database query failed in copyClassSubjectsBatch:', error);
    throw new Error('Échec de la copie du programme scolaire.', { cause: error });
  }
}
