import { z } from 'zod';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const attendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

export const dailySummaryQuerySchema = z.object({
  date: z.string().regex(isoDateRegex, 'Date invalide (AAAA-MM-JJ).').optional(),
  classId: z.coerce.number().int().positive().optional(),
});

export const classRollQuerySchema = z.object({
  classId: z.coerce.number().int().positive('Identifiant de classe requis.'),
  date: z.string().regex(isoDateRegex, 'Date invalide (AAAA-MM-JJ).').optional(),
});

export const bulkMarkAttendanceSchema = z.object({
  classId: z.number().int().positive('Classe requise.'),
  date: z.string().regex(isoDateRegex, 'Date invalide (AAAA-MM-JJ).'),
  entries: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        status: attendanceStatusEnum,
        reason: z.string().trim().max(300).default(''),
        isJustified: z.boolean().default(false),
      })
    )
    .min(1, 'Au moins un élève est requis.')
    .max(200),
});

export const updateAttendanceSchema = z.object({
  status: attendanceStatusEnum.optional(),
  reason: z.string().trim().max(300).optional(),
  isJustified: z.boolean().optional(),
});

export type DailySummaryQuery = z.infer<typeof dailySummaryQuerySchema>;
export type ClassRollQuery = z.infer<typeof classRollQuerySchema>;
export type BulkMarkAttendanceInput = z.infer<typeof bulkMarkAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
