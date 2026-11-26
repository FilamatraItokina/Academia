import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import {
  assignClassSubjectSchema,
  copyCurriculumSchema,
  createSubjectSchema,
  listSubjectsQuerySchema,
  updateClassSubjectSchema,
  updateSubjectSchema,
} from './subject.schema.ts';
import * as service from './subject.service.ts';

export const subjectsRouter = Router();

subjectsRouter.get(
  '/',
  requireAuth,
  requirePermission('subjects:read'),
  async (req, res, next) => {
    try {
      const parsed = listSubjectsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Paramètres de recherche invalides.', parsed.error.flatten());
      }
      const items = await service.listSubjects(parsed.data);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

subjectsRouter.post(
  '/',
  requireAuth,
  requirePermission('subjects:write'),
  async (req, res, next) => {
    try {
      const parsed = createSubjectSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données matière invalides.', parsed.error.flatten());
      }
      const created = await service.createSubject(parsed.data, {
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

subjectsRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('subjects:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant matière invalide.');
      }
      const parsed = updateSubjectSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de mise à jour invalides.', parsed.error.flatten());
      }
      const updated = await service.updateSubject(id, parsed.data, {
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

subjectsRouter.get(
  '/classes/:classId',
  requireAuth,
  requirePermission('subjects:read'),
  async (req, res, next) => {
    try {
      const classId = Number(req.params.classId);
      if (!Number.isInteger(classId) || classId <= 0) {
        throw new ValidationError('Identifiant classe invalide.');
      }
      const data = await service.getClassCurriculum(classId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }
);

subjectsRouter.post(
  '/classes/:classId',
  requireAuth,
  requirePermission('subjects:write'),
  async (req, res, next) => {
    try {
      const classId = Number(req.params.classId);
      if (!Number.isInteger(classId) || classId <= 0) {
        throw new ValidationError('Identifiant classe invalide.');
      }
      const parsed = assignClassSubjectSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Affectation matière invalide.', parsed.error.flatten());
      }
      const created = await service.assignSubjectToClass(classId, parsed.data, {
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

subjectsRouter.post(
  '/classes/:classId/copy-from',
  requireAuth,
  requirePermission('subjects:write'),
  async (req, res, next) => {
    try {
      const classId = Number(req.params.classId);
      if (!Number.isInteger(classId) || classId <= 0) {
        throw new ValidationError('Identifiant classe cible invalide.');
      }
      const parsed = copyCurriculumSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Paramètres de copie invalides.', parsed.error.flatten());
      }
      const result = await service.copyCurriculumFromClass(classId, parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        ipAddress: req.ip,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

subjectsRouter.patch(
  '/class-subjects/:id',
  requireAuth,
  requirePermission('subjects:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant d’affectation invalide.');
      }
      const parsed = updateClassSubjectSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Mise à jour invalide.', parsed.error.flatten());
      }
      const updated = await service.updateClassSubject(id, parsed.data, {
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

subjectsRouter.delete(
  '/class-subjects/:id',
  requireAuth,
  requirePermission('subjects:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant d’affectation invalide.');
      }
      await service.removeClassSubject(id, {
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
