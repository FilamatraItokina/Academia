import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import { findStudentsInClass } from '../students/student.repository.ts';
import {
  createClassSchema,
  createClassroomSchema,
  createLevelSchema,
  createSeriesSchema,
  listClassesQuerySchema,
  updateClassSchema,
  updateClassroomSchema,
  updateLevelSchema,
  updateSeriesSchema,
} from './class.schema.ts';
import * as service from './class.service.ts';

export const classesRouter = Router();

// --- Niveaux ---
classesRouter.get(
  '/levels',
  requireAuth,
  requirePermission('classes:read'),
  async (_req, res, next) => {
    try {
      const items = await service.listLevels();
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

classesRouter.post(
  '/levels',
  requireAuth,
  requirePermission('classes:manage'),
  async (req, res, next) => {
    try {
      const parsed = createLevelSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de niveau invalides.', parsed.error.flatten());
      }
      const created = await service.createLevel(parsed.data, {
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

classesRouter.post(
  '/levels/seed-defaults',
  requireAuth,
  requirePermission('classes:manage'),
  async (req, res, next) => {
    try {
      const items = await service.initializeDefaultLevels({
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        ipAddress: req.ip,
      });
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

classesRouter.patch(
  '/levels/:id',
  requireAuth,
  requirePermission('classes:manage'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const parsed = updateLevelSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données invalides.', parsed.error.flatten());
      }
      const updated = await service.updateLevel(id, parsed.data, {
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

// --- Séries ---
classesRouter.get(
  '/series',
  requireAuth,
  requirePermission('classes:read'),
  async (_req, res, next) => {
    try {
      const items = await service.listSeries();
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

classesRouter.post(
  '/series',
  requireAuth,
  requirePermission('classes:manage'),
  async (req, res, next) => {
    try {
      const parsed = createSeriesSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de série invalides.', parsed.error.flatten());
      }
      const created = await service.createSeries(parsed.data, {
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

classesRouter.post(
  '/series/seed-defaults',
  requireAuth,
  requirePermission('classes:manage'),
  async (req, res, next) => {
    try {
      const items = await service.initializeDefaultSeries({
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        ipAddress: req.ip,
      });
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

classesRouter.patch(
  '/series/:id',
  requireAuth,
  requirePermission('classes:manage'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const parsed = updateSeriesSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données invalides.', parsed.error.flatten());
      }
      const updated = await service.updateSeries(id, parsed.data, {
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

// --- Salles ---
classesRouter.get(
  '/classrooms',
  requireAuth,
  requirePermission('classes:read'),
  async (_req, res, next) => {
    try {
      const items = await service.listClassrooms();
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

classesRouter.post(
  '/classrooms',
  requireAuth,
  requirePermission('classes:manage'),
  async (req, res, next) => {
    try {
      const parsed = createClassroomSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de salle invalides.', parsed.error.flatten());
      }
      const created = await service.createClassroom(parsed.data, {
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

classesRouter.patch(
  '/classrooms/:id',
  requireAuth,
  requirePermission('classes:manage'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const parsed = updateClassroomSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données invalides.', parsed.error.flatten());
      }
      const updated = await service.updateClassroom(id, parsed.data, {
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

// --- Classes ---
classesRouter.get(
  '/',
  requireAuth,
  requirePermission('classes:read'),
  async (req, res, next) => {
    try {
      const parsed = listClassesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Filtres invalides.', parsed.error.flatten());
      }
      const result = await service.listClasses(parsed.data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

classesRouter.post(
  '/',
  requireAuth,
  requirePermission('classes:manage'),
  async (req, res, next) => {
    try {
      const parsed = createClassSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de classe invalides.', parsed.error.flatten());
      }
      const created = await service.createClass(parsed.data, {
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

classesRouter.get(
  '/:id',
  requireAuth,
  requirePermission('classes:read'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const cls = await service.getClassById(id);
      res.json(cls);
    } catch (error) {
      next(error);
    }
  }
);

classesRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('classes:manage'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const parsed = updateClassSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de mise à jour invalides.', parsed.error.flatten());
      }
      const updated = await service.updateClass(id, parsed.data, {
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

classesRouter.get(
  '/:id/students',
  requireAuth,
  requirePermission('classes:read'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const [classInfo, students] = await Promise.all([
        service.getClassById(id),
        findStudentsInClass(id),
      ]);
      res.json({
        classInfo,
        students,
      });
    } catch (error) {
      next(error);
    }
  }
);
