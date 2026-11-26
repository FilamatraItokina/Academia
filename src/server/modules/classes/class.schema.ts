import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination.ts';

export const createLevelSchema = z.object({
  code: z.string().trim().min(1).max(20).toUpperCase(),
  name: z.string().trim().min(2).max(80),
  cycle: z.enum(['COLLEGE', 'LYCEE']),
  orderIndex: z.number().int().min(1).max(50),
});

export const updateLevelSchema = createLevelSchema.partial();

export const createSeriesSchema = z.object({
  code: z.string().trim().min(1).max(20).toUpperCase(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).default(''),
});

export const updateSeriesSchema = createSeriesSchema.partial();

export const createClassroomSchema = z.object({
  code: z.string().trim().min(1).max(30).toUpperCase(),
  name: z.string().trim().min(2).max(80),
  building: z.string().trim().min(1).max(80).default('Bâtiment principal'),
  capacity: z.number().int().min(1).max(500),
  roomType: z.enum(['CLASSROOM', 'LAB', 'IT_ROOM', 'EXAM_HALL']).default('CLASSROOM'),
  isActive: z.boolean().default(true),
});

export const updateClassroomSchema = createClassroomSchema.partial();

export const listClassesQuerySchema = paginationQuerySchema.extend({
  academicYearId: z.coerce.number().int().positive().optional(),
  levelId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(80).optional(),
  includeArchived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
});

export const createClassSchema = z.object({
  name: z.string().trim().min(2, 'Nom de classe requis (ex: 6e A).').max(60),
  academicYearId: z.number().int().positive(),
  levelId: z.number().int().positive(),
  seriesId: z.number().int().positive().nullable().optional(),
  classroomId: z.number().int().positive().nullable().optional(),
  capacity: z.number().int().min(1).max(200).default(35),
});

export const updateClassSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  levelId: z.number().int().positive().optional(),
  seriesId: z.number().int().positive().nullable().optional(),
  classroomId: z.number().int().positive().nullable().optional(),
  capacity: z.number().int().min(1).max(200).optional(),
  isArchived: z.boolean().optional(),
});

export type CreateLevelInput = z.infer<typeof createLevelSchema>;
export type UpdateLevelInput = z.infer<typeof updateLevelSchema>;
export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type UpdateSeriesInput = z.infer<typeof updateSeriesSchema>;
export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;
export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
