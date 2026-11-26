import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import {
  createTeacherSchema,
  listTeachersQuerySchema,
  updateTeacherSchema,
} from './teacher.schema.ts';
import * as service from './teacher.service.ts';

export const teachersRouter = Router();

teachersRouter.get(
  '/',
  requireAuth,
  requirePermission('teachers:read'),
  async (req, res, next) => {
    try {
      const parsed = listTeachersQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Critères de recherche invalides.', parsed.error.flatten());
      }
      const result = await service.listTeachers(parsed.data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

teachersRouter.post(
  '/',
  requireAuth,
  requirePermission('teachers:write'),
  async (req, res, next) => {
    try {
      const parsed = createTeacherSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données enseignant invalides.', parsed.error.flatten());
      }
      const created = await service.createTeacher(parsed.data, {
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

teachersRouter.get(
  '/:id',
  requireAuth,
  requirePermission('teachers:read'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const teacher = await service.getTeacherById(id);
      res.json(teacher);
    } catch (error) {
      next(error);
    }
  }
);

teachersRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('teachers:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const parsed = updateTeacherSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données invalides.', parsed.error.flatten());
      }
      const updated = await service.updateTeacher(id, parsed.data, {
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
