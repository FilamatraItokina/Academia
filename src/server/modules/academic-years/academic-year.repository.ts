import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import { academicYears, terms } from '../../../db/schema.ts';
import type {
  AcademicYearItem,
  AcademicYearStatus,
  TermItem,
  TermType,
} from './academic-year.types.ts';

function mapTermRow(row: typeof terms.$inferSelect): TermItem {
  return {
    id: row.id,
    academicYearId: row.academicYearId,
    name: row.name,
    termType: row.termType as TermType,
    orderIndex: row.orderIndex,
    startDate: row.startDate,
    endDate: row.endDate,
    isCurrent: row.isCurrent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function hydrateAcademicYears(
  yearRows: Array<typeof academicYears.$inferSelect>
): Promise<AcademicYearItem[]> {
  if (yearRows.length === 0) return [];
  const yearIds = yearRows.map((y) => y.id);
  const termRows = await db
    .select()
    .from(terms)
    .where(inArray(terms.academicYearId, yearIds))
    .orderBy(asc(terms.orderIndex));

  const termsByYear = new Map<number, TermItem[]>();
  for (const t of termRows) {
    const arr = termsByYear.get(t.academicYearId) ?? [];
    arr.push(mapTermRow(t));
    termsByYear.set(t.academicYearId, arr);
  }

  return yearRows.map((y) => ({
    id: y.id,
    name: y.name,
    startDate: y.startDate,
    endDate: y.endDate,
    status: y.status as AcademicYearStatus,
    closedAt: y.closedAt,
    createdAt: y.createdAt,
    updatedAt: y.updatedAt,
    terms: termsByYear.get(y.id) ?? [],
  }));
}

export async function findAllAcademicYears(): Promise<AcademicYearItem[]> {
  try {
    const rows = await db
      .select()
      .from(academicYears)
      .orderBy(desc(academicYears.startDate), desc(academicYears.id));
    return await hydrateAcademicYears(rows);
  } catch (error) {
    console.error('Database query failed in findAllAcademicYears:', error);
    throw new Error('Impossible de charger les années scolaires.', { cause: error });
  }
}

export async function findAcademicYearById(id: number): Promise<AcademicYearItem | null> {
  try {
    const rows = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    const hydrated = await hydrateAcademicYears(rows);
    return hydrated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findAcademicYearById:', error);
    throw new Error('Impossible de récupérer l’année scolaire.', { cause: error });
  }
}

export async function findAcademicYearByName(name: string): Promise<AcademicYearItem | null> {
  try {
    const rows = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.name, name))
      .limit(1);
    if (rows.length === 0) return null;
    const hydrated = await hydrateAcademicYears(rows);
    return hydrated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findAcademicYearByName:', error);
    throw new Error('Impossible de vérifier le nom de l’année scolaire.', { cause: error });
  }
}

export async function createAcademicYearWithTerms(input: {
  name: string;
  startDate: string;
  endDate: string;
  initialTerms: Array<{
    name: string;
    termType: TermType;
    orderIndex: number;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }>;
}): Promise<AcademicYearItem> {
  try {
    const createdId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(academicYears)
        .values({
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          status: 'DRAFT',
        })
        .returning();

      const year = inserted[0];
      if (input.initialTerms.length > 0) {
        await tx.insert(terms).values(
          input.initialTerms.map((t) => ({
            academicYearId: year.id,
            name: t.name,
            termType: t.termType,
            orderIndex: t.orderIndex,
            startDate: t.startDate,
            endDate: t.endDate,
            isCurrent: t.isCurrent,
          }))
        );
      }
      return year.id;
    });

    const created = await findAcademicYearById(createdId);
    if (!created) throw new Error('Année scolaire créée introuvable.');
    return created;
  } catch (error) {
    console.error('Database query failed in createAcademicYearWithTerms:', error);
    throw new Error('Échec de la création de l’année scolaire.', { cause: error });
  }
}

export async function updateAcademicYearRecord(
  id: number,
  updates: { name?: string; startDate?: string; endDate?: string }
): Promise<AcademicYearItem> {
  try {
    await db
      .update(academicYears)
      .set({
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.startDate !== undefined ? { startDate: updates.startDate } : {}),
        ...(updates.endDate !== undefined ? { endDate: updates.endDate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(academicYears.id, id));

    const updated = await findAcademicYearById(id);
    if (!updated) throw new Error('Année scolaire introuvable.');
    return updated;
  } catch (error) {
    console.error('Database query failed in updateAcademicYearRecord:', error);
    throw new Error('Échec de la mise à jour de l’année scolaire.', { cause: error });
  }
}

export async function activateAcademicYearTransaction(id: number): Promise<AcademicYearItem> {
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(academicYears)
        .set({
          status: 'CLOSED',
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(academicYears.status, 'ACTIVE'));

      await tx
        .update(academicYears)
        .set({
          status: 'ACTIVE',
          closedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(academicYears.id, id));
    });

    const activated = await findAcademicYearById(id);
    if (!activated) throw new Error('Année scolaire introuvable.');
    return activated;
  } catch (error) {
    console.error('Database query failed in activateAcademicYearTransaction:', error);
    throw new Error('Échec de l’activation de l’année scolaire.', { cause: error });
  }
}

export async function closeAcademicYearRecord(id: number): Promise<AcademicYearItem> {
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(academicYears)
        .set({
          status: 'CLOSED',
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(academicYears.id, id));

      await tx
        .update(terms)
        .set({ isCurrent: false, updatedAt: new Date() })
        .where(eq(terms.academicYearId, id));
    });

    const closed = await findAcademicYearById(id);
    if (!closed) throw new Error('Année scolaire introuvable.');
    return closed;
  } catch (error) {
    console.error('Database query failed in closeAcademicYearRecord:', error);
    throw new Error('Échec de la clôture de l’année scolaire.', { cause: error });
  }
}

export async function findTermById(termId: number): Promise<TermItem | null> {
  try {
    const rows = await db.select().from(terms).where(eq(terms.id, termId)).limit(1);
    return rows[0] ? mapTermRow(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findTermById:', error);
    throw new Error('Impossible de récupérer la période.', { cause: error });
  }
}

export async function insertTermRecord(input: {
  academicYearId: number;
  name: string;
  termType: TermType;
  orderIndex: number;
  startDate: string;
  endDate: string;
}): Promise<TermItem> {
  try {
    const rows = await db
      .insert(terms)
      .values({
        academicYearId: input.academicYearId,
        name: input.name,
        termType: input.termType,
        orderIndex: input.orderIndex,
        startDate: input.startDate,
        endDate: input.endDate,
        isCurrent: false,
      })
      .returning();
    return mapTermRow(rows[0]);
  } catch (error) {
    console.error('Database query failed in insertTermRecord:', error);
    throw new Error('Échec de la création de la période.', { cause: error });
  }
}

export async function updateTermRecord(
  termId: number,
  updates: { name?: string; startDate?: string; endDate?: string }
): Promise<TermItem> {
  try {
    const rows = await db
      .update(terms)
      .set({
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.startDate !== undefined ? { startDate: updates.startDate } : {}),
        ...(updates.endDate !== undefined ? { endDate: updates.endDate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(terms.id, termId))
      .returning();
    return mapTermRow(rows[0]);
  } catch (error) {
    console.error('Database query failed in updateTermRecord:', error);
    throw new Error('Échec de la mise à jour de la période.', { cause: error });
  }
}

export async function setCurrentTermTransaction(
  academicYearId: number,
  termId: number
): Promise<TermItem> {
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(terms)
        .set({ isCurrent: false, updatedAt: new Date() })
        .where(eq(terms.academicYearId, academicYearId));

      await tx
        .update(terms)
        .set({ isCurrent: true, updatedAt: new Date() })
        .where(eq(terms.id, termId));
    });
    const updated = await findTermById(termId);
    if (!updated) throw new Error('Période introuvable.');
    return updated;
  } catch (error) {
    console.error('Database query failed in setCurrentTermTransaction:', error);
    throw new Error('Échec de l’activation de la période.', { cause: error });
  }
}

export async function deleteTermRecord(termId: number): Promise<void> {
  try {
    await db.delete(terms).where(eq(terms.id, termId));
  } catch (error) {
    console.error('Database query failed in deleteTermRecord:', error);
    throw new Error('Échec de la suppression de la période.', { cause: error });
  }
}
