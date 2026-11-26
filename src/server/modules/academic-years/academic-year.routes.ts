import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import {
  createAcademicYearSchema,
  createTermSchema,
  updateAcademicYearSchema,
  updateTermSchema,
} from './academic-year.schema.ts';
import * as service from './academic-year.service.ts';

export const academicYearsRouter = Router();

academicYearsRouter.get(
  '/',
  requireAuth,
  requirePermission('academic_years:read'),
  async (_req, res, next) => {
    try {
      const items = await service.listAcademicYears();
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

academicYearsRouter.post(
  '/',
  requireAuth,
  requirePermission('academic_years:manage'),
  async (req, res, next) => {
    try {
      const parsed = createAcademicYearSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données invalides.', parsed.error.flatten());
      }
      const created = await service.createAcademicYear(parsed.data, {
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

academicYearsRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('academic_years:manage'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant invalide.');
      }
      const parsed = updateAcademicYearSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données invalides.', parsed.error.flatten());
      }
      const updated = await service.updateAcademicYear(id, parsed.data, {
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

academicYearsRouter.post(
  '/:id/activate',
  requireAuth,
  requirePermission('academic_years:manage'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant invalide.');
      }
      const updated = await service.activateAcademicYear(id, {
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

academicYearsRouter.post(
  '/:id/close',
  requireAuth,
  requirePermission('academic_years:manage'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant invalide.');
      }
      const updated = await service.closeAcademicYear(id, {
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

academicYearsRouter.post(
  '/:id/terms',
  requireAuth,
  requirePermission('academic_years:manage'),
  async (req, res, next) => {
    try {
      const yearId = Number(req.params.id);
      if (!Number.isInteger(yearId) || yearId <= 0) {
        throw new ValidationError('Identifiant d’année scolaire invalide.');
      }
      const parsed = createTermSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de période invalides.', parsed.error.flatten());
      }
      const created = await service.addTerm(yearId, parsed.data, {
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

academicYearsRouter.patch(
  '/terms/:termId',
  requireAuth,
  requirePermission('academic_years:manage'),
  async (req, res, next) => {
    try {
      const termId = Number(req.params.termId);
      if (!Number.isInteger(termId) || termId <= 0) {
        throw new ValidationError('Identifiant de période invalide.');
      }
      const parsed = updateTermSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données invalides.', parsed.error.flatten());
      }
      const updated = await service.updateTerm(termId, parsed.data, {
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

academicYearsRouter.post(
  '/terms/:termId/set-current',
  requireAuth,
  requirePermission('academic_years:manage'),
  async (req, res, next) => {
    try {
      const termId = Number(req.params.termId);
      if (!Number.isInteger(termId) || termId <= 0) {
        throw new ValidationError('Identifiant de période invalide.');
      }
      const updated = await service.setCurrentTerm(termId, {
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

academicYearsRouter.delete(
  '/terms/:termId',
  requireAuth,
  requirePermission('academic_years:manage'),
  async (req, res, next) => {
    try {
      const termId = Number(req.params.termId);
      if (!Number.isInteger(termId) || termId <= 0) {
        throw new ValidationError('Identifiant de période invalide.');
      }
      await service.deleteTerm(termId, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        ipAddress: req.ip,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
