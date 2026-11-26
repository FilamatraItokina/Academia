import { z } from 'zod';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createAcademicYearSchema = z
  .object({
    name: z.string().trim().min(4, 'Libellé requis (ex: 2026-2027).').max(40),
    startDate: z.string().regex(isoDateRegex, 'Date de début invalide (AAAA-MM-JJ).'),
    endDate: z.string().regex(isoDateRegex, 'Date de fin invalide (AAAA-MM-JJ).'),
    autoGeneratePeriods: z.enum(['TRIMESTER', 'SEMESTER', 'NONE']).default('TRIMESTER'),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: 'La date de fin doit être postérieure à la date de début.',
    path: ['endDate'],
  });

export const updateAcademicYearSchema = z
  .object({
    name: z.string().trim().min(4).max(40).optional(),
    startDate: z.string().regex(isoDateRegex).optional(),
    endDate: z.string().regex(isoDateRegex).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate < data.endDate;
      }
      return true;
    },
    {
      message: 'La date de fin doit être postérieure à la date de début.',
      path: ['endDate'],
    }
  );

export const createTermSchema = z
  .object({
    name: z.string().trim().min(2, 'Nom de période requis.').max(60),
    termType: z.enum(['TRIMESTER', 'SEMESTER']).default('TRIMESTER'),
    orderIndex: z.number().int().min(1).max(6),
    startDate: z.string().regex(isoDateRegex, 'Date de début invalide.'),
    endDate: z.string().regex(isoDateRegex, 'Date de fin invalide.'),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: 'La date de fin de la période doit être postérieure à la date de début.',
    path: ['endDate'],
  });

export const updateTermSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    startDate: z.string().regex(isoDateRegex).optional(),
    endDate: z.string().regex(isoDateRegex).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate < data.endDate;
      }
      return true;
    },
    {
      message: 'La date de fin de la période doit être postérieure à la date de début.',
      path: ['endDate'],
    }
  );

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
export type CreateTermInput = z.infer<typeof createTermSchema>;
export type UpdateTermInput = z.infer<typeof updateTermSchema>;
