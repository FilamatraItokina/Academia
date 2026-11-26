import { z } from 'zod';

export const updateSettingsSchema = z.object({
  schoolName: z.string().trim().min(2, 'Nom d’établissement requis.').max(140),
  schoolType: z.enum(['COLLEGE', 'LYCEE', 'LYCEE_COLLEGE']),
  academicSystem: z.enum(['TRIMESTER', 'SEMESTER']),
  gradingScale: z.coerce.number().int().min(10).max(100),
  currency: z.string().trim().min(3).max(6).toUpperCase(),
  address: z.string().trim().max(250).default(''),
  phone: z.string().trim().max(40).default(''),
  email: z.union([z.string().trim().email('E-mail invalide.'), z.literal('')]).default(''),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
