import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import {
  createSchoolEventSchema,
  listEventsQuerySchema,
  updateSchoolEventSchema,
} from './event.schema.ts';
import * as service from './event.service.ts';

export const eventsRouter = Router();

eventsRouter.get(
  '/upcoming',
  requireAuth,
  requirePermission('announcements:read'),
  async (req, res, next) => {
    try {
      const parsed = listEventsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Paramètres de recherche des événements invalides.', parsed.error.flatten());
      }
      const roleCodes = req.currentUser!.roles.map((r) => r.code);
      const data = await service.listUpcomingEvents(parsed.data, roleCodes);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }
);

eventsRouter.post(
  '/',
  requireAuth,
  requirePermission('announcements:write'),
  async (req, res, next) => {
    try {
      const parsed = createSchoolEventSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de l’événement invalides.', parsed.error.flatten());
      }
      const created = await service.createSchoolEvent(parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  }
);

eventsRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('announcements:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant d’événement invalide.');
      }
      const parsed = updateSchoolEventSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de mise à jour invalides.', parsed.error.flatten());
      }
      const updated = await service.updateSchoolEvent(id, parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

eventsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('announcements:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant d’événement invalide.');
      }
      await service.deleteSchoolEvent(id, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        ipAddress: req.ip,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
