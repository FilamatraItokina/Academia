import { and, asc, count, eq, ilike, inArray } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  academicYears,
  classes,
  classrooms,
  enrollments,
  levels,
  series,
} from '../../../db/schema.ts';
import type {
  CreateClassInput,
  CreateClassroomInput,
  CreateLevelInput,
  CreateSeriesInput,
  ListClassesQuery,
  UpdateClassInput,
  UpdateClassroomInput,
  UpdateLevelInput,
  UpdateSeriesInput,
} from './class.schema.ts';
import type {
  ClassItem,
  ClassroomItem,
  EducationCycle,
  LevelItem,
  RoomType,
  SeriesItem,
} from './class.types.ts';

function mapLevel(row: typeof levels.$inferSelect): LevelItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    cycle: row.cycle as EducationCycle,
    orderIndex: row.orderIndex,
  };
}

function mapClassroom(row: typeof classrooms.$inferSelect): ClassroomItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    building: row.building,
    capacity: row.capacity,
    roomType: row.roomType as RoomType,
    isActive: row.isActive,
  };
}

export async function findAllLevels(): Promise<LevelItem[]> {
  try {
    const rows = await db.select().from(levels).orderBy(asc(levels.orderIndex), asc(levels.id));
    return rows.map(mapLevel);
  } catch (error) {
    console.error('Database query failed in findAllLevels:', error);
    throw new Error('Impossible de charger les niveaux.', { cause: error });
  }
}

export async function findLevelById(id: number): Promise<LevelItem | null> {
  try {
    const rows = await db.select().from(levels).where(eq(levels.id, id)).limit(1);
    return rows[0] ? mapLevel(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findLevelById:', error);
    throw new Error('Impossible de récupérer le niveau.', { cause: error });
  }
}

export async function findLevelByCode(code: string): Promise<LevelItem | null> {
  try {
    const rows = await db.select().from(levels).where(eq(levels.code, code)).limit(1);
    return rows[0] ? mapLevel(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findLevelByCode:', error);
    throw new Error('Impossible de vérifier le code du niveau.', { cause: error });
  }
}

export async function insertLevel(input: CreateLevelInput): Promise<LevelItem> {
  try {
    const rows = await db.insert(levels).values(input).returning();
    return mapLevel(rows[0]);
  } catch (error) {
    console.error('Database query failed in insertLevel:', error);
    throw new Error('Échec de la création du niveau.', { cause: error });
  }
}

export async function updateLevelRecord(
  id: number,
  updates: UpdateLevelInput
): Promise<LevelItem> {
  try {
    const rows = await db
      .update(levels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(levels.id, id))
      .returning();
    return mapLevel(rows[0]);
  } catch (error) {
    console.error('Database query failed in updateLevelRecord:', error);
    throw new Error('Échec de la mise à jour du niveau.', { cause: error });
  }
}

export async function seedDefaultLevels(): Promise<LevelItem[]> {
  const defaults: CreateLevelInput[] = [
    { code: '6E', name: 'Sixième (6e)', cycle: 'COLLEGE', orderIndex: 1 },
    { code: '5E', name: 'Cinquième (5e)', cycle: 'COLLEGE', orderIndex: 2 },
    { code: '4E', name: 'Quatrième (4e)', cycle: 'COLLEGE', orderIndex: 3 },
    { code: '3E', name: 'Troisième (3e)', cycle: 'COLLEGE', orderIndex: 4 },
    { code: '2NDE', name: 'Seconde', cycle: 'LYCEE', orderIndex: 5 },
    { code: '1ERE', name: 'Première', cycle: 'LYCEE', orderIndex: 6 },
    { code: 'TLE', name: 'Terminale', cycle: 'LYCEE', orderIndex: 7 },
  ];
  try {
    for (const item of defaults) {
      await db.insert(levels).values(item).onConflictDoNothing({ target: levels.code });
    }
    return await findAllLevels();
  } catch (error) {
    console.error('Database query failed in seedDefaultLevels:', error);
    throw new Error('Échec de l’initialisation des niveaux.', { cause: error });
  }
}

export async function findAllSeries(): Promise<SeriesItem[]> {
  try {
    return await db.select().from(series).orderBy(asc(series.code));
  } catch (error) {
    console.error('Database query failed in findAllSeries:', error);
    throw new Error('Impossible de charger les séries.', { cause: error });
  }
}

export async function findSeriesById(id: number): Promise<SeriesItem | null> {
  try {
    const rows = await db.select().from(series).where(eq(series.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findSeriesById:', error);
    throw new Error('Impossible de récupérer la série.', { cause: error });
  }
}

export async function findSeriesByCode(code: string): Promise<SeriesItem | null> {
  try {
    const rows = await db.select().from(series).where(eq(series.code, code)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findSeriesByCode:', error);
    throw new Error('Impossible de vérifier la série.', { cause: error });
  }
}

export async function insertSeries(input: CreateSeriesInput): Promise<SeriesItem> {
  try {
    const rows = await db.insert(series).values(input).returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in insertSeries:', error);
    throw new Error('Échec de la création de la série.', { cause: error });
  }
}

export async function updateSeriesRecord(
  id: number,
  updates: UpdateSeriesInput
): Promise<SeriesItem> {
  try {
    const rows = await db
      .update(series)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(series.id, id))
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in updateSeriesRecord:', error);
    throw new Error('Échec de la mise à jour de la série.', { cause: error });
  }
}

export async function seedDefaultSeries(): Promise<SeriesItem[]> {
  const defaults: CreateSeriesInput[] = [
    { code: 'GEN', name: 'Générale', description: 'Tronc commun général (Collège & Seconde)' },
    { code: 'L', name: 'Littéraire (L)', description: 'Série littéraire, langues et sciences humaines' },
    { code: 'ES', name: 'Économique & Sociale (ES)', description: 'Sciences économiques, sociales et mathématiques' },
    { code: 'S', name: 'Scientifique (S)', description: 'Mathématiques, physique-chimie et sciences de la vie' },
  ];
  try {
    for (const item of defaults) {
      await db.insert(series).values(item).onConflictDoNothing({ target: series.code });
    }
    return await findAllSeries();
  } catch (error) {
    console.error('Database query failed in seedDefaultSeries:', error);
    throw new Error('Échec de l’initialisation des séries.', { cause: error });
  }
}

export async function findAllClassrooms(): Promise<ClassroomItem[]> {
  try {
    const rows = await db.select().from(classrooms).orderBy(asc(classrooms.code));
    return rows.map(mapClassroom);
  } catch (error) {
    console.error('Database query failed in findAllClassrooms:', error);
    throw new Error('Impossible de charger les salles.', { cause: error });
  }
}

export async function findClassroomById(id: number): Promise<ClassroomItem | null> {
  try {
    const rows = await db.select().from(classrooms).where(eq(classrooms.id, id)).limit(1);
    return rows[0] ? mapClassroom(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findClassroomById:', error);
    throw new Error('Impossible de récupérer la salle.', { cause: error });
  }
}

export async function findClassroomByCode(code: string): Promise<ClassroomItem | null> {
  try {
    const rows = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.code, code))
      .limit(1);
    return rows[0] ? mapClassroom(rows[0]) : null;
  } catch (error) {
    console.error('Database query failed in findClassroomByCode:', error);
    throw new Error('Impossible de vérifier le code de la salle.', { cause: error });
  }
}

export async function insertClassroom(input: CreateClassroomInput): Promise<ClassroomItem> {
  try {
    const rows = await db.insert(classrooms).values(input).returning();
    return mapClassroom(rows[0]);
  } catch (error) {
    console.error('Database query failed in insertClassroom:', error);
    throw new Error('Échec de la création de la salle.', { cause: error });
  }
}

export async function updateClassroomRecord(
  id: number,
  updates: UpdateClassroomInput
): Promise<ClassroomItem> {
  try {
    const rows = await db
      .update(classrooms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(classrooms.id, id))
      .returning();
    return mapClassroom(rows[0]);
  } catch (error) {
    console.error('Database query failed in updateClassroomRecord:', error);
    throw new Error('Échec de la mise à jour de la salle.', { cause: error });
  }
}

async function queryClassesWithJoins(
  whereClause?: ReturnType<typeof and>,
  limit?: number,
  offset?: number
): Promise<ClassItem[]> {
  const baseQuery = db
    .select({
      id: classes.id,
      name: classes.name,
      academicYearId: classes.academicYearId,
      academicYearName: academicYears.name,
      academicYearStatus: academicYears.status,
      levelId: classes.levelId,
      levelCode: levels.code,
      levelName: levels.name,
      levelCycle: levels.cycle,
      levelOrder: levels.orderIndex,
      seriesId: classes.seriesId,
      seriesCode: series.code,
      seriesName: series.name,
      classroomId: classes.classroomId,
      classroomCode: classrooms.code,
      classroomName: classrooms.name,
      classroomCapacity: classrooms.capacity,
      capacity: classes.capacity,
      isArchived: classes.isArchived,
      createdAt: classes.createdAt,
      updatedAt: classes.updatedAt,
    })
    .from(classes)
    .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id))
    .innerJoin(levels, eq(classes.levelId, levels.id))
    .leftJoin(series, eq(classes.seriesId, series.id))
    .leftJoin(classrooms, eq(classes.classroomId, classrooms.id))
    .where(whereClause)
    .orderBy(asc(levels.orderIndex), asc(classes.name));

  const rows =
    limit !== undefined && offset !== undefined
      ? await baseQuery.limit(limit).offset(offset)
      : await baseQuery;

  const classIds = rows.map((r) => r.id);
  const enrolledMap = new Map<number, number>();
  if (classIds.length > 0) {
    const enrollCounts = await db
      .select({
        classId: enrollments.classId,
        total: count(),
      })
      .from(enrollments)
      .where(and(inArray(enrollments.classId, classIds), eq(enrollments.status, 'ACTIVE')))
      .groupBy(enrollments.classId);

    for (const ec of enrollCounts) {
      enrolledMap.set(ec.classId, Number(ec.total));
    }
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    academicYearId: r.academicYearId,
    academicYearName: r.academicYearName,
    academicYearStatus: r.academicYearStatus,
    levelId: r.levelId,
    levelCode: r.levelCode,
    levelName: r.levelName,
    levelCycle: r.levelCycle as EducationCycle,
    seriesId: r.seriesId,
    seriesCode: r.seriesCode,
    seriesName: r.seriesName,
    classroomId: r.classroomId,
    classroomCode: r.classroomCode,
    classroomName: r.classroomName,
    classroomCapacity: r.classroomCapacity,
    capacity: r.capacity,
    enrolledCount: enrolledMap.get(r.id) ?? 0,
    isArchived: r.isArchived,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function findClasses(
  query: ListClassesQuery
): Promise<{ items: ClassItem[]; total: number }> {
  try {
    const conditions = [];
    if (query.academicYearId) {
      conditions.push(eq(classes.academicYearId, query.academicYearId));
    }
    if (query.levelId) {
      conditions.push(eq(classes.levelId, query.levelId));
    }
    if (!query.includeArchived) {
      conditions.push(eq(classes.isArchived, false));
    }
    if (query.search) {
      conditions.push(ilike(classes.name, `%${query.search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [items, totalRows] = await Promise.all([
      queryClassesWithJoins(whereClause, query.limit, offset),
      db.select({ value: count() }).from(classes).where(whereClause),
    ]);

    return { items, total: Number(totalRows[0]?.value ?? 0) };
  } catch (error) {
    console.error('Database query failed in findClasses:', error);
    throw new Error('Impossible de charger les classes.', { cause: error });
  }
}

export async function findClassById(id: number): Promise<ClassItem | null> {
  try {
    const items = await queryClassesWithJoins(and(eq(classes.id, id)));
    return items[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findClassById:', error);
    throw new Error('Impossible de récupérer la classe.', { cause: error });
  }
}

export async function findClassByYearAndName(
  academicYearId: number,
  name: string
): Promise<ClassItem | null> {
  try {
    const items = await queryClassesWithJoins(
      and(eq(classes.academicYearId, academicYearId), eq(classes.name, name))
    );
    return items[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findClassByYearAndName:', error);
    throw new Error('Impossible de vérifier le nom de la classe.', { cause: error });
  }
}

export async function insertClass(input: CreateClassInput): Promise<ClassItem> {
  try {
    const rows = await db
      .insert(classes)
      .values({
        name: input.name,
        academicYearId: input.academicYearId,
        levelId: input.levelId,
        seriesId: input.seriesId ?? null,
        classroomId: input.classroomId ?? null,
        capacity: input.capacity,
      })
      .returning();

    const created = await findClassById(rows[0].id);
    if (!created) throw new Error('Classe créée introuvable.');
    return created;
  } catch (error) {
    console.error('Database query failed in insertClass:', error);
    throw new Error('Échec de la création de la classe.', { cause: error });
  }
}

export async function updateClassRecord(
  id: number,
  updates: UpdateClassInput
): Promise<ClassItem> {
  try {
    await db
      .update(classes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(classes.id, id));

    const updated = await findClassById(id);
    if (!updated) throw new Error('Classe introuvable.');
    return updated;
  } catch (error) {
    console.error('Database query failed in updateClassRecord:', error);
    throw new Error('Échec de la mise à jour de la classe.', { cause: error });
  }
}
