import { z } from 'zod';

export const SUBJECT_DEPARTMENTS = [
  'Sciences',
  'Lettres & Langues',
  'Sciences Humaines',
  'Arts & Sport',
  'Technologie',
  'Général',
] as const;

export const listSubjectsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  department: z.string().trim().max(60).optional(),
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const createSubjectSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Le code doit contenir au moins 2 caractères.')
    .max(16, 'Le code ne peut pas dépasser 16 caractères.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Le code ne doit contenir que des lettres, chiffres, tirets ou underscores.')
    .transform((v) => v.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(2, 'L’intitulé de la matière doit contenir au moins 2 caractères.')
    .max(100, '100 caractères maximum.'),
  department: z.string().trim().min(2).max(60).default('Général'),
  defaultCoefficient: z.number().min(0.5, 'Minimum 0.5').max(20, 'Maximum 20').default(1),
  description: z.string().trim().max(500).default(''),
});

export const updateSubjectSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code matière invalide.')
    .transform((v) => v.toUpperCase())
    .optional(),
  name: z.string().trim().min(2).max(100).optional(),
  department: z.string().trim().min(2).max(60).optional(),
  defaultCoefficient: z.number().min(0.5).max(20).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const assignClassSubjectSchema = z.object({
  subjectId: z.number().int().positive('Matière invalide.'),
  teacherId: z.number().int().positive().nullable().optional(),
  coefficient: z.number().min(0.5, 'Minimum 0.5').max(20, 'Maximum 20'),
  weeklyHours: z.number().min(0.5, 'Minimum 0.5h').max(40, 'Maximum 40h'),
  isOptional: z.boolean().default(false),
});

export const updateClassSubjectSchema = z.object({
  teacherId: z.number().int().positive().nullable().optional(),
  coefficient: z.number().min(0.5).max(20).optional(),
  weeklyHours: z.number().min(0.5).max(40).optional(),
  isOptional: z.boolean().optional(),
});

export const copyCurriculumSchema = z.object({
  sourceClassId: z.number().int().positive('Classe source invalide.'),
  includeTeachers: z.boolean().default(true),
});

export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type AssignClassSubjectInput = z.infer<typeof assignClassSubjectSchema>;
export type UpdateClassSubjectInput = z.infer<typeof updateClassSubjectSchema>;
export type CopyCurriculumInput = z.infer<typeof copyCurriculumSchema>;
