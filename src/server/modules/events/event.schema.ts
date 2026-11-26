import { z } from 'zod';

export const SCHOOL_EVENT_CATEGORIES = ['EXAM', 'MEETING', 'HOLIDAY', 'OTHER'] as const;
export const EVENT_TARGET_AUDIENCES = ['ALL', 'STAFF', 'TEACHERS', 'STUDENTS_PARENTS'] as const;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date doit respecter le format AAAA-MM-JJ.');

const timeSchema = z
  .string()
  .trim()
  .refine(
    (val) => val === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(val),
    'L’heure doit respecter le format HH:MM (ex: 08:30).'
  );

export const listEventsQuerySchema = z.object({
  category: z.enum(SCHOOL_EVENT_CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  includePast: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const createSchoolEventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Le titre doit contenir au moins 3 caractères.')
      .max(140, 'Le titre ne peut pas dépasser 140 caractères.'),
    category: z.enum(SCHOOL_EVENT_CATEGORIES),
    description: z.string().trim().max(1000, 'La description est trop longue.').default(''),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable().optional(),
    startTime: timeSchema.default(''),
    location: z.string().trim().max(120, 'Le lieu ne peut pas dépasser 120 caractères.').default(''),
    targetAudience: z.enum(EVENT_TARGET_AUDIENCES).default('ALL'),
    academicYearId: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (data) => {
      if (!data.endDate) return true;
      return data.endDate >= data.startDate;
    },
    {
      message: 'La date de fin doit être postérieure ou égale à la date de début.',
      path: ['endDate'],
    }
  );

export const updateSchoolEventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Le titre doit contenir au moins 3 caractères.')
      .max(140, 'Le titre ne peut pas dépasser 140 caractères.')
      .optional(),
    category: z.enum(SCHOOL_EVENT_CATEGORIES).optional(),
    description: z.string().trim().max(1000, 'La description est trop longue.').optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.nullable().optional(),
    startTime: timeSchema.optional(),
    location: z.string().trim().max(120, 'Le lieu ne peut pas dépasser 120 caractères.').optional(),
    targetAudience: z.enum(EVENT_TARGET_AUDIENCES).optional(),
    academicYearId: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return data.endDate >= data.startDate;
    },
    {
      message: 'La date de fin doit être postérieure ou égale à la date de début.',
      path: ['endDate'],
    }
  );

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type CreateSchoolEventInput = z.infer<typeof createSchoolEventSchema>;
export type UpdateSchoolEventInput = z.infer<typeof updateSchoolEventSchema>;
