import { z } from 'zod';

export const classReportCardsQuerySchema = z.object({
  classId: z.coerce.number().int().positive('Classe requise.'),
  termId: z.coerce.number().int().positive('Période requise.'),
});

export const generateReportCardsSchema = z.object({
  classId: z.number().int().positive('Classe requise.'),
  termId: z.number().int().positive('Période requise.'),
});

export const updateReportCardSchema = z.object({
  honorMention: z.string().trim().max(80).optional(),
  councilRemark: z.string().trim().max(1000).optional(),
  subjectRemarks: z
    .array(
      z.object({
        classSubjectId: z.number().int().positive(),
        teacherRemark: z.string().trim().max(400),
      })
    )
    .max(40)
    .optional(),
});

export type ClassReportCardsQuery = z.infer<typeof classReportCardsQuerySchema>;
export type GenerateReportCardsInput = z.infer<typeof generateReportCardsSchema>;
export type UpdateReportCardInput = z.infer<typeof updateReportCardSchema>;
