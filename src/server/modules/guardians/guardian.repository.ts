import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import { guardians, studentGuardians, students } from '../../../db/schema.ts';
import type {
  CreateGuardianInput,
  LinkStudentInput,
  ListGuardiansQuery,
  UpdateGuardianInput,
} from './guardian.schema.ts';
import type {
  GuardianItem,
  GuardianRelationship,
  LinkedStudentItem,
} from './guardian.types.ts';

async function hydrateGuardians(
  rows: Array<typeof guardians.$inferSelect>
): Promise<GuardianItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const linkRows = await db
    .select({
      guardianId: studentGuardians.guardianId,
      studentId: students.id,
      matricule: students.matricule,
      firstName: students.firstName,
      lastName: students.lastName,
      relationship: studentGuardians.relationship,
      isPrimaryContact: studentGuardians.isPrimaryContact,
      hasLegalCustody: studentGuardians.hasLegalCustody,
      canPickup: studentGuardians.canPickup,
    })
    .from(studentGuardians)
    .innerJoin(students, eq(studentGuardians.studentId, students.id))
    .where(inArray(studentGuardians.guardianId, ids));

  const studentsByGuardian = new Map<number, LinkedStudentItem[]>();
  for (const row of linkRows) {
    const arr = studentsByGuardian.get(row.guardianId) ?? [];
    arr.push({
      studentId: row.studentId,
      matricule: row.matricule,
      firstName: row.firstName,
      lastName: row.lastName,
      relationship: row.relationship as GuardianRelationship,
      isPrimaryContact: row.isPrimaryContact,
      hasLegalCustody: row.hasLegalCustody,
      canPickup: row.canPickup,
    });
    studentsByGuardian.set(row.guardianId, arr);
  }

  return rows.map((g) => ({
    id: g.id,
    userId: g.userId,
    firstName: g.firstName,
    lastName: g.lastName,
    email: g.email,
    phone: g.phone,
    secondaryPhone: g.secondaryPhone,
    address: g.address,
    profession: g.profession,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    students: studentsByGuardian.get(g.id) ?? [],
  }));
}

export async function findGuardians(
  query: ListGuardiansQuery
): Promise<{ items: GuardianItem[]; total: number }> {
  try {
    const conditions = [];
    if (query.search) {
      const p = `%${query.search}%`;
      conditions.push(
        or(
          ilike(guardians.firstName, p),
          ilike(guardians.lastName, p),
          ilike(guardians.phone, p),
          ilike(guardians.email, p)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(guardians)
        .where(whereClause)
        .orderBy(desc(guardians.createdAt), desc(guardians.id))
        .limit(query.limit)
        .offset(offset),
      db.select({ value: count() }).from(guardians).where(whereClause),
    ]);

    return {
      items: await hydrateGuardians(rows),
      total: Number(totalRows[0]?.value ?? 0),
    };
  } catch (error) {
    console.error('Database query failed in findGuardians:', error);
    throw new Error('Impossible de charger les parents et responsables légaux.', {
      cause: error,
    });
  }
}

export async function findGuardianById(id: number): Promise<GuardianItem | null> {
  try {
    const rows = await db.select().from(guardians).where(eq(guardians.id, id)).limit(1);
    if (rows.length === 0) return null;
    const hydrated = await hydrateGuardians(rows);
    return hydrated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findGuardianById:', error);
    throw new Error('Impossible de récupérer le dossier parent.', { cause: error });
  }
}

export async function createGuardianTransaction(
  input: CreateGuardianInput
): Promise<GuardianItem> {
  try {
    const createdId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(guardians)
        .values({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          secondaryPhone: input.secondaryPhone,
          address: input.address,
          profession: input.profession,
        })
        .returning();

      const guardian = inserted[0];
      if (input.initialStudentLink) {
        await tx.insert(studentGuardians).values({
          guardianId: guardian.id,
          studentId: input.initialStudentLink.studentId,
          relationship: input.initialStudentLink.relationship,
          isPrimaryContact: input.initialStudentLink.isPrimaryContact,
          hasLegalCustody: input.initialStudentLink.hasLegalCustody,
          canPickup: input.initialStudentLink.canPickup,
        });
      }
      return guardian.id;
    });

    const created = await findGuardianById(createdId);
    if (!created) throw new Error('Parent créé introuvable.');
    return created;
  } catch (error) {
    console.error('Database query failed in createGuardianTransaction:', error);
    throw new Error('Échec de la création du responsable légal.', { cause: error });
  }
}

export async function updateGuardianRecord(
  id: number,
  updates: UpdateGuardianInput
): Promise<GuardianItem> {
  try {
    await db
      .update(guardians)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(guardians.id, id));
    const updated = await findGuardianById(id);
    if (!updated) throw new Error('Parent introuvable.');
    return updated;
  } catch (error) {
    console.error('Database query failed in updateGuardianRecord:', error);
    throw new Error('Échec de la mise à jour du responsable légal.', { cause: error });
  }
}

export async function upsertStudentGuardianLink(
  guardianId: number,
  input: LinkStudentInput
): Promise<GuardianItem> {
  try {
    await db
      .insert(studentGuardians)
      .values({
        guardianId,
        studentId: input.studentId,
        relationship: input.relationship,
        isPrimaryContact: input.isPrimaryContact,
        hasLegalCustody: input.hasLegalCustody,
        canPickup: input.canPickup,
      })
      .onConflictDoUpdate({
        target: [studentGuardians.studentId, studentGuardians.guardianId],
        set: {
          relationship: input.relationship,
          isPrimaryContact: input.isPrimaryContact,
          hasLegalCustody: input.hasLegalCustody,
          canPickup: input.canPickup,
        },
      });

    const updated = await findGuardianById(guardianId);
    if (!updated) throw new Error('Parent introuvable.');
    return updated;
  } catch (error) {
    console.error('Database query failed in upsertStudentGuardianLink:', error);
    throw new Error('Échec de l’association élève-parent.', { cause: error });
  }
}

export async function deleteStudentGuardianLink(
  guardianId: number,
  studentId: number
): Promise<GuardianItem> {
  try {
    await db
      .delete(studentGuardians)
      .where(
        and(
          eq(studentGuardians.guardianId, guardianId),
          eq(studentGuardians.studentId, studentId)
        )
      );
    const updated = await findGuardianById(guardianId);
    if (!updated) throw new Error('Parent introuvable.');
    return updated;
  } catch (error) {
    console.error('Database query failed in deleteStudentGuardianLink:', error);
    throw new Error('Échec de la dissociation.', { cause: error });
  }
}
