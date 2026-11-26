import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import { academicYears, schoolEvents } from '../../../db/schema.ts';
import type {
  EventTargetAudience,
  SchoolEventCategory,
  SchoolEventRecord,
} from './event.types.ts';

function mapEventRow(
  row: typeof schoolEvents.$inferSelect,
  academicYearName: string | null
): SchoolEventRecord {
  return {
    id: row.id,
    title: row.title,
    category: row.category as SchoolEventCategory,
    description: row.description,
    startDate: row.startDate,
    endDate: row.endDate,
    startTime: row.startTime,
    location: row.location,
    targetAudience: row.targetAudience as EventTargetAudience,
    academicYearId: row.academicYearId,
    academicYearName,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findVisibleEvents(params: {
  allowedAudiences: EventTargetAudience[];
  category?: SchoolEventCategory;
  includePast: boolean;
  limit: number;
}): Promise<SchoolEventRecord[]> {
  if (params.allowedAudiences.length === 0) return [];

  try {
    const conditions = [inArray(schoolEvents.targetAudience, params.allowedAudiences)];

    if (!params.includePast) {
      conditions.push(sql`COALESCE(${schoolEvents.endDate}, ${schoolEvents.startDate}) >= CURRENT_DATE`);
    }

    if (params.category) {
      conditions.push(eq(schoolEvents.category, params.category));
    }

    const rows = await db
      .select({
        event: schoolEvents,
        academicYearName: academicYears.name,
      })
      .from(schoolEvents)
      .leftJoin(academicYears, eq(schoolEvents.academicYearId, academicYears.id))
      .where(and(...conditions))
      .orderBy(asc(schoolEvents.startDate), asc(schoolEvents.startTime), asc(schoolEvents.id))
      .limit(params.limit);

    return rows.map((r) => mapEventRow(r.event, r.academicYearName ?? null));
  } catch (error) {
    console.error('Database query failed in findVisibleEvents:', error);
    throw new Error('Impossible de charger les événements scolaires.', { cause: error });
  }
}

export async function findAllUpcomingForSummary(
  allowedAudiences: EventTargetAudience[]
): Promise<SchoolEventRecord[]> {
  if (allowedAudiences.length === 0) return [];

  try {
    const rows = await db
      .select({
        event: schoolEvents,
        academicYearName: academicYears.name,
      })
      .from(schoolEvents)
      .leftJoin(academicYears, eq(schoolEvents.academicYearId, academicYears.id))
      .where(
        and(
          inArray(schoolEvents.targetAudience, allowedAudiences),
          sql`COALESCE(${schoolEvents.endDate}, ${schoolEvents.startDate}) >= CURRENT_DATE`
        )
      )
      .orderBy(asc(schoolEvents.startDate), asc(schoolEvents.id));

    return rows.map((r) => mapEventRow(r.event, r.academicYearName ?? null));
  } catch (error) {
    console.error('Database query failed in findAllUpcomingForSummary:', error);
    throw new Error('Impossible de calculer le résumé des événements.', { cause: error });
  }
}

export async function findEventById(id: number): Promise<SchoolEventRecord | null> {
  try {
    const rows = await db
      .select({
        event: schoolEvents,
        academicYearName: academicYears.name,
      })
      .from(schoolEvents)
      .leftJoin(academicYears, eq(schoolEvents.academicYearId, academicYears.id))
      .where(eq(schoolEvents.id, id))
      .limit(1);

    if (!rows[0]) return null;
    return mapEventRow(rows[0].event, rows[0].academicYearName ?? null);
  } catch (error) {
    console.error('Database query failed in findEventById:', error);
    throw new Error('Impossible de récupérer l’événement scolaire.', { cause: error });
  }
}

export async function insertSchoolEvent(input: {
  title: string;
  category: SchoolEventCategory;
  description: string;
  startDate: string;
  endDate: string | null;
  startTime: string;
  location: string;
  targetAudience: EventTargetAudience;
  academicYearId: number | null;
  createdByUserId: number;
}): Promise<SchoolEventRecord> {
  try {
    const inserted = await db
      .insert(schoolEvents)
      .values({
        title: input.title,
        category: input.category,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
        startTime: input.startTime,
        location: input.location,
        targetAudience: input.targetAudience,
        academicYearId: input.academicYearId,
        createdByUserId: input.createdByUserId,
      })
      .returning();

    const created = await findEventById(inserted[0].id);
    if (!created) throw new Error('Événement créé introuvable.');
    return created;
  } catch (error) {
    console.error('Database query failed in insertSchoolEvent:', error);
    throw new Error('Impossible de créer l’événement scolaire.', { cause: error });
  }
}

export async function updateSchoolEventRecord(
  id: number,
  updates: Partial<{
    title: string;
    category: SchoolEventCategory;
    description: string;
    startDate: string;
    endDate: string | null;
    startTime: string;
    location: string;
    targetAudience: EventTargetAudience;
    academicYearId: number | null;
  }>
): Promise<SchoolEventRecord> {
  try {
    await db
      .update(schoolEvents)
      .set({
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.category !== undefined ? { category: updates.category } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.startDate !== undefined ? { startDate: updates.startDate } : {}),
        ...(updates.endDate !== undefined ? { endDate: updates.endDate } : {}),
        ...(updates.startTime !== undefined ? { startTime: updates.startTime } : {}),
        ...(updates.location !== undefined ? { location: updates.location } : {}),
        ...(updates.targetAudience !== undefined ? { targetAudience: updates.targetAudience } : {}),
        ...(updates.academicYearId !== undefined ? { academicYearId: updates.academicYearId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schoolEvents.id, id));

    const updated = await findEventById(id);
    if (!updated) throw new Error('Événement scolaire introuvable.');
    return updated;
  } catch (error) {
    console.error('Database query failed in updateSchoolEventRecord:', error);
    throw new Error('Impossible de mettre à jour l’événement scolaire.', { cause: error });
  }
}

export async function deleteSchoolEventRecord(id: number): Promise<void> {
  try {
    await db.delete(schoolEvents).where(eq(schoolEvents.id, id));
  } catch (error) {
    console.error('Database query failed in deleteSchoolEventRecord:', error);
    throw new Error('Impossible de supprimer l’événement scolaire.', { cause: error });
  }
}
