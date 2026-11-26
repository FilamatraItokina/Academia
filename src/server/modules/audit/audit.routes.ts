import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import { listAuditLogsQuerySchema } from './audit.schema.ts';
import * as auditService from './audit.service.ts';

export const auditRouter = Router();

auditRouter.get(
  '/',
  requireAuth,
  requirePermission('audit:read'),
  async (req, res, next) => {
    try {
      const parsed = listAuditLogsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Paramètres de filtrage invalides.', parsed.error.flatten());
      }
      const result = await auditService.listAuditLogs(parsed.data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
