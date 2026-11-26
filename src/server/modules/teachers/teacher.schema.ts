import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination.ts';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const listTeachersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  specialty: z.string().trim().max(80).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const createTeacherSchema = z.object({
  employeeCode: z.string().trim().max(40).optional(),
  firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
  lastName: z.string().trim().min(1, 'Nom requis.').max(80),
  email: z.string().trim().toLowerCase().email('Adresse e-mail valide requise.'),
  phone: z.string().trim().max(30).default(''),
  specialty: z.string().trim().min(2, 'Spécialité requise.').max(100),
  qualification: z.string().trim().max(100).default(''),
  contractType: z.enum(['PERMANENT', 'CONTRACT', 'PART_TIME']).default('PERMANENT'),
  hireDate: z.union([z.string().regex(isoDateRegex), z.literal('')]).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateTeacherSchema = createTeacherSchema.partial();

export type ListTeachersQuery = z.infer<typeof listTeachersQuerySchema>;
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
