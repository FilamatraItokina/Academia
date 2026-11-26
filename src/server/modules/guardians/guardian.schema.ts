import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination.ts';

export const listGuardiansQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
});

export const linkStudentSchema = z.object({
  studentId: z.number().int().positive(),
  relationship: z
    .enum(['FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'OTHER'])
    .default('LEGAL_GUARDIAN'),
  isPrimaryContact: z.boolean().default(false),
  hasLegalCustody: z.boolean().default(true),
  canPickup: z.boolean().default(true),
});

export const createGuardianSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
  lastName: z.string().trim().min(1, 'Nom requis.').max(80),
  email: z.union([z.string().trim().email('E-mail invalide.'), z.literal('')]).default(''),
  phone: z.string().trim().min(5, 'Téléphone requis.').max(30),
  secondaryPhone: z.string().trim().max(30).default(''),
  address: z.string().trim().max(240).default(''),
  profession: z.string().trim().max(100).default(''),
  initialStudentLink: linkStudentSchema.optional(),
});

export const updateGuardianSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  email: z.union([z.string().trim().email('E-mail invalide.'), z.literal('')]).optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  secondaryPhone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(240).optional(),
  profession: z.string().trim().max(100).optional(),
});

export type ListGuardiansQuery = z.infer<typeof listGuardiansQuerySchema>;
export type LinkStudentInput = z.infer<typeof linkStudentSchema>;
export type CreateGuardianInput = z.infer<typeof createGuardianSchema>;
export type UpdateGuardianInput = z.infer<typeof updateGuardianSchema>;
