import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination.ts';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const safePhotoUrlSchema = z
  .string()
  .trim()
  .max(400000, 'L’image est trop volumineuse (max 300 Ko).')
  .refine(
    (val) =>
      val === '' ||
      /^https?:\/\//i.test(val) ||
      /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(val),
    'Format de photo non autorisé (URL http/https ou image PNG/JPEG/WebP).'
  )
  .nullable()
  .optional();

export const listStudentsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  academicYearId: z.coerce.number().int().positive().optional(),
  classId: z.coerce.number().int().positive().optional(),
  levelId: z.coerce.number().int().positive().optional(),
  gender: z.enum(['M', 'F']).optional(),
  includeArchived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
});

export const createStudentSchema = z.object({
  matricule: z.string().trim().max(40).optional(),
  firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
  lastName: z.string().trim().min(1, 'Nom requis.').max(80),
  gender: z.enum(['M', 'F']),
  dateOfBirth: z.string().regex(isoDateRegex, 'Date de naissance invalide (AAAA-MM-JJ).'),
  placeOfBirth: z.string().trim().max(100).default(''),
  nationality: z.string().trim().max(80).default(''),
  address: z.string().trim().max(240).default(''),
  phone: z.string().trim().max(30).default(''),
  email: z.union([z.string().trim().email('E-mail invalide.'), z.literal('')]).default(''),
  photoUrl: safePhotoUrlSchema,
  medicalNotes: z.string().trim().max(500).default(''),
  initialEnrollment: z
    .object({
      academicYearId: z.number().int().positive(),
      classId: z.number().int().positive(),
      enrollmentDate: z.string().regex(isoDateRegex).optional(),
      notes: z.string().trim().max(300).default(''),
    })
    .optional(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  gender: z.enum(['M', 'F']).optional(),
  dateOfBirth: z.string().regex(isoDateRegex).optional(),
  placeOfBirth: z.string().trim().max(100).optional(),
  nationality: z.string().trim().max(80).optional(),
  address: z.string().trim().max(240).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.union([z.string().trim().email('E-mail invalide.'), z.literal('')]).optional(),
  photoUrl: safePhotoUrlSchema,
  medicalNotes: z.string().trim().max(500).optional(),
  isArchived: z.boolean().optional(),
});

export const createEnrollmentSchema = z.object({
  academicYearId: z.number().int().positive(),
  classId: z.number().int().positive(),
  enrollmentDate: z.string().regex(isoDateRegex).optional(),
  notes: z.string().trim().max(300).default(''),
});

export const updateEnrollmentSchema = z.object({
  classId: z.number().int().positive().optional(),
  status: z.enum(['ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'COMPLETED']).optional(),
  notes: z.string().trim().max(300).optional(),
});

export const importCsvStudentsSchema = z.object({
  csvContent: z.string().min(5, 'Contenu CSV vide.').max(1_500_000),
  academicYearId: z.number().int().positive().optional(),
  classId: z.number().int().positive().optional(),
});

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
export type ImportCsvStudentsInput = z.infer<typeof importCsvStudentsSchema>;
