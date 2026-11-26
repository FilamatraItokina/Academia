import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import { updateSettingsSchema } from './settings.schema.ts';
import * as settingsService from './settings.service.ts';

export const settingsRouter = Router();

settingsRouter.get(
  '/',
  requireAuth,
  requirePermission('settings:read'),
  async (_req, res, next) => {
    try {
      const settings = await settingsService.getSchoolSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }
);

settingsRouter.patch(
  '/',
  requireAuth,
  requirePermission('settings:manage'),
  async (req, res, next) => {
    try {
      const parsed = updateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Paramètres invalides.', parsed.error.flatten());
      }
      const updated = await settingsService.updateSchoolSettings(parsed.data, {
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
