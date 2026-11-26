import { z } from 'zod';

export const ASSESSMENT_TYPES = ['QUIZ', 'TEST', 'EXAM', 'ORAL', 'PRACTICAL'] as const;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date doit respecter le format AAAA-MM-JJ.');

export const listAssessmentsQuerySchema = z.object({
  classId: z.coerce.number().int().positive().optional(),
  termId: z.coerce.number().int().positive().optional(),
  classSubjectId: z.coerce.number().int().positive().optional(),
});

export const createAssessmentSchema = z.object({
  classSubjectId: z.number().int().positive('Matière de classe invalide.'),
  termId: z.number().int().positive('Période invalide.'),
  title: z
    .string()
    .trim()
    .min(2, 'Le titre doit contenir au moins 2 caractères.')
    .max(120, '120 caractères maximum.'),
  assessmentType: z.enum(ASSESSMENT_TYPES).default('TEST'),
  assessmentDate: isoDateSchema,
  maxScore: z.number().min(1, 'Barème minimum 1.').max(200, 'Barème maximum 200.').default(20),
  weight: z.number().min(0.25, 'Coefficient minimum 0.25.').max(10, 'Maximum 10.').default(1),
  description: z.string().trim().max(500).default(''),
  isPublished: z.boolean().default(false),
});

export const updateAssessmentSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  assessmentType: z.enum(ASSESSMENT_TYPES).optional(),
  assessmentDate: isoDateSchema.optional(),
  maxScore: z.number().min(1).max(200).optional(),
  weight: z.number().min(0.25).max(10).optional(),
  description: z.string().trim().max(500).optional(),
  isPublished: z.boolean().optional(),
});

export const saveBulkScoresSchema = z.object({
  entries: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        score: z.number().min(0, 'Note négative interdite.').nullable(),
        isAbsent: z.boolean().default(false),
        comment: z.string().trim().max(300).default(''),
      })
    )
    .min(1, 'Au moins une ligne de note est requise.')
    .max(120),
});

export const classSummaryQuerySchema = z.object({
  classId: z.coerce.number().int().positive('Classe requise.'),
  termId: z.coerce.number().int().positive('Période requise.'),
});

export const myGradesQuerySchema = z.object({
  studentId: z.coerce.number().int().positive().optional(),
  termId: z.coerce.number().int().positive().optional(),
});

export type ListAssessmentsQuery = z.infer<typeof listAssessmentsQuerySchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;
export type SaveBulkScoresInput = z.infer<typeof saveBulkScoresSchema>;
export type ClassSummaryQuery = z.infer<typeof classSummaryQuerySchema>;
export type MyGradesQuery = z.infer<typeof myGradesQuerySchema>;
