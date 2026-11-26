import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
  lastName: z.string().trim().min(1, 'Nom requis.').max(80),
  phone: z.string().trim().max(30).optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
