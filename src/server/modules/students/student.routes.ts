import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import {
  createEnrollmentSchema,
  createStudentSchema,
  importCsvStudentsSchema,
  listStudentsQuerySchema,
  updateEnrollmentSchema,
  updateStudentSchema,
} from './student.schema.ts';
import * as service from './student.service.ts';

export const studentsRouter = Router();

studentsRouter.get(
  '/',
  requireAuth,
  requirePermission('students:read'),
  async (req, res, next) => {
    try {
      const parsed = listStudentsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Critères de recherche invalides.', parsed.error.flatten());
      }
      const result = await service.listStudents(parsed.data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

studentsRouter.get(
  '/export',
  requireAuth,
  requirePermission('students:read'),
  async (req, res, next) => {
    try {
      const parsed = listStudentsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Paramètres d’export invalides.', parsed.error.flatten());
      }
      const csv = await service.exportStudentsCsv(parsed.data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="eleves-academia.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);

studentsRouter.post(
  '/import',
  requireAuth,
  requirePermission('students:write'),
  async (req, res, next) => {
    try {
      const parsed = importCsvStudentsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Fichier CSV invalide.', parsed.error.flatten());
      }
      const summary = await service.importStudentsFromCsv(parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        ipAddress: req.ip,
      });
      res.status(201).json(summary);
    } catch (error) {
      next(error);
    }
  }
);

studentsRouter.post(
  '/',
  requireAuth,
  requirePermission('students:write'),
  async (req, res, next) => {
    try {
      const parsed = createStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données élève invalides.', parsed.error.flatten());
      }
      const created = await service.createStudent(parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  }
);

studentsRouter.get(
  '/:id',
  requireAuth,
  requirePermission('students:read'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const dossier = await service.getStudentDossier(id);
      res.json(dossier);
    } catch (error) {
      next(error);
    }
  }
);

studentsRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('students:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const parsed = updateStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de mise à jour invalides.', parsed.error.flatten());
      }
      const updated = await service.updateStudent(id, parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

studentsRouter.post(
  '/:id/enrollments',
  requireAuth,
  requirePermission('students:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const parsed = createEnrollmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données d’inscription invalides.', parsed.error.flatten());
      }
      const enrollment = await service.enrollStudent(id, parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        ipAddress: req.ip,
      });
      res.status(201).json(enrollment);
    } catch (error) {
      next(error);
    }
  }
);

studentsRouter.patch(
  '/enrollments/:enrollmentId',
  requireAuth,
  requirePermission('students:write'),
  async (req, res, next) => {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
        throw new ValidationError('Identifiant d’inscription invalide.');
      }
      const parsed = updateEnrollmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données invalides.', parsed.error.flatten());
      }
      const updated = await service.updateEnrollment(enrollmentId, parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);
