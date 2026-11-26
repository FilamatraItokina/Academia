import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination.ts';

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  roleCode: z.string().trim().max(40).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.'),
  firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
  lastName: z.string().trim().min(1, 'Nom requis.').max(80),
  phone: z.string().trim().max(30).optional().nullable(),
  isActive: z.boolean().default(true),
  roleCodes: z
    .array(z.string().trim().min(1))
    .min(1, 'Au moins un rôle doit être attribué.'),
});

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  isActive: z.boolean().optional(),
  roleCodes: z.array(z.string().trim().min(1)).min(1).optional(),
});

export const updateRolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string().trim().min(1)),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
