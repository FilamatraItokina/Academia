import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import {
  createGuardianSchema,
  linkStudentSchema,
  listGuardiansQuerySchema,
  updateGuardianSchema,
} from './guardian.schema.ts';
import * as service from './guardian.service.ts';

export const guardiansRouter = Router();

guardiansRouter.get(
  '/',
  requireAuth,
  requirePermission('guardians:read'),
  async (req, res, next) => {
    try {
      const parsed = listGuardiansQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Critères de recherche invalides.', parsed.error.flatten());
      }
      const result = await service.listGuardians(parsed.data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

guardiansRouter.post(
  '/',
  requireAuth,
  requirePermission('guardians:write'),
  async (req, res, next) => {
    try {
      const parsed = createGuardianSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données parent invalides.', parsed.error.flatten());
      }
      const created = await service.createGuardian(parsed.data, {
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

guardiansRouter.get(
  '/:id',
  requireAuth,
  requirePermission('guardians:read'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const guardian = await service.getGuardianById(id);
      res.json(guardian);
    } catch (error) {
      next(error);
    }
  }
);

guardiansRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('guardians:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const parsed = updateGuardianSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données invalides.', parsed.error.flatten());
      }
      const updated = await service.updateGuardian(id, parsed.data, {
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

guardiansRouter.post(
  '/:id/students',
  requireAuth,
  requirePermission('guardians:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant invalide.');
      const parsed = linkStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données d’association invalides.', parsed.error.flatten());
      }
      const updated = await service.linkStudentToGuardian(id, parsed.data, {
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

guardiansRouter.delete(
  '/:id/students/:studentId',
  requireAuth,
  requirePermission('guardians:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const studentId = Number(req.params.studentId);
      if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(studentId) || studentId <= 0) {
        throw new ValidationError('Identifiant invalide.');
      }
      const updated = await service.unlinkStudentFromGuardian(id, studentId, {
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
