import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import { teachers } from '../../../db/schema.ts';
import type {
  CreateTeacherInput,
  ListTeachersQuery,
  UpdateTeacherInput,
} from './teacher.schema.ts';
import type { ContractType, TeacherItem } from './teacher.types.ts';

function mapTeacher(row: typeof teachers.$inferSelect): TeacherItem {
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    specialty: row.specialty,
    qualification: row.qualification,
    contractType: row.contractType as ContractType,
    hireDate: row.hireDate,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function generateNextEmployeeCode(
  prefixYear = new Date().getFullYear()
): Promise<string> {
  try {
    const prefix = `ENS-${prefixYear}-`;
    const rows = await db
      .select({ employeeCode: teachers.employeeCode })
      .from(teachers)
      .where(ilike(teachers.employeeCode, `${prefix}%`))
      .orderBy(desc(teachers.id))
      .limit(50);

    let maxSeq = 0;
    for (const r of rows) {
      const num = Number.parseInt(r.employeeCode.slice(prefix.length), 10);
      if (Number.isFinite(num) && num > maxSeq) maxSeq = num;
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  } catch (error) {
    console.error('Database query failed in generateNextEmployeeCode:', error);
    throw new Error('Impossible de générer un matricule enseignant.', { cause: error });
  }
}

export async function findTeachers(
  query: ListTeachersQuery
): Promise<{ items: TeacherItem[]; total: number }> {
  try {
    const conditions = [];
    if (query.isActive !== undefined) {
      conditions.push(eq(teachers.isActive, query.isActive));
    }
    if (query.specialty) {
      conditions.push(ilike(teachers.specialty, `%${query.specialty}%`));
    }
    if (query.search) {
      const p = `%${query.search}%`;
      conditions.push(
        or(
          ilike(teachers.employeeCode, p),
          ilike(teachers.firstName, p),
          ilike(teachers.lastName, p),
          ilike(teachers.email, p),
          ilike(teachers.specialty, p)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(teachers)
        .where(whereClause)
        .orderBy(desc(teachers.createdAt), desc(teachers.id))
        .limit(query.limit)
        .offset(offset),
      db.select({ value: count() }).from(teachers).where(whereClause),
    ]);

    return { items: rows.map(mapTeacher), total: Number(totalRows[0]?.value ?? 0) };
  } catch (error) {
    console.error('Database query failed in findTeachers:', error);
    throw new Error('Impossible de charger les enseignants.', { cause: error });
  }
}

export async function findTeacherById(id: number): Promise<TeacherItem | null> {
  try {
    const rows = await db.select().from(teachers).where(eq(teachers.id, id)).limit(1);
    return rows[0] ? mapTeacher(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findTeacherById:', error);
    throw new Error('Impossible de récupérer le dossier enseignant.', { cause: error });
  }
}

export async function findTeacherByEmail(email: string): Promise<TeacherItem | null> {
  try {
    const rows = await db
      .select()
      .from(teachers)
      .where(eq(teachers.email, email.trim().toLowerCase()))
      .limit(1);
    return rows[0] ? mapTeacher(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findTeacherByEmail:', error);
    throw new Error('Impossible de vérifier l’e-mail enseignant.', { cause: error });
  }
}

export async function findTeacherByCode(code: string): Promise<TeacherItem | null> {
  try {
    const rows = await db
      .select()
      .from(teachers)
      .where(eq(teachers.employeeCode, code))
      .limit(1);
    return rows[0] ? mapTeacher(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findTeacherByCode:', error);
    throw new Error('Impossible de vérifier le matricule enseignant.', { cause: error });
  }
}

export async function insertTeacher(
  employeeCode: string,
  input: CreateTeacherInput
): Promise<TeacherItem> {
  try {
    const rows = await db
      .insert(teachers)
      .values({
        employeeCode,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.trim().toLowerCase(),
        phone: input.phone,
        specialty: input.specialty,
        qualification: input.qualification,
        contractType: input.contractType,
        hireDate: input.hireDate && input.hireDate !== '' ? input.hireDate : null,
        isActive: input.isActive,
      })
      .returning();
    return mapTeacher(rows[0]);
  } catch (error) {
    console.error('Database query failed in insertTeacher:', error);
    throw new Error('Échec de l’enregistrement de l’enseignant.', { cause: error });
  }
}

export async function updateTeacherRecord(
  id: number,
  updates: UpdateTeacherInput
): Promise<TeacherItem> {
  try {
    const setPayload: Partial<typeof teachers.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (updates.firstName !== undefined) setPayload.firstName = updates.firstName;
    if (updates.lastName !== undefined) setPayload.lastName = updates.lastName;
    if (updates.email !== undefined) setPayload.email = updates.email.trim().toLowerCase();
    if (updates.phone !== undefined) setPayload.phone = updates.phone;
    if (updates.specialty !== undefined) setPayload.specialty = updates.specialty;
    if (updates.qualification !== undefined) setPayload.qualification = updates.qualification;
    if (updates.contractType !== undefined) setPayload.contractType = updates.contractType;
    if (updates.hireDate !== undefined) {
      setPayload.hireDate = updates.hireDate && updates.hireDate !== '' ? updates.hireDate : null;
    }
    if (updates.isActive !== undefined) setPayload.isActive = updates.isActive;

    const rows = await db
      .update(teachers)
      .set(setPayload)
      .where(eq(teachers.id, id))
      .returning();
    return mapTeacher(rows[0]);
  } catch (error) {
    console.error('Database query failed in updateTeacherRecord:', error);
    throw new Error('Échec de la mise à jour de l’enseignant.', { cause: error });
  }
}
