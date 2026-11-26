import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import { onAttendanceChanged } from './attendance.events.ts';
import {
  bulkMarkAttendanceSchema,
  classRollQuerySchema,
  dailySummaryQuerySchema,
  updateAttendanceSchema,
} from './attendance.schema.ts';
import * as service from './attendance.service.ts';

export const attendanceRouter = Router();

attendanceRouter.get(
  '/stream',
  requireAuth,
  requirePermission('attendance:read'),
  requirePermission('students:read'),
  (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    const unsubscribe = onAttendanceChanged((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  }
);

attendanceRouter.get(
  '/daily-summary',
  requireAuth,
  requirePermission('attendance:read'),
  requirePermission('students:read'),
  async (req, res, next) => {
    try {
      const parsed = dailySummaryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Paramètres de suivi invalides.', parsed.error.flatten());
      }
      const summary = await service.getDailySummary(parsed.data);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
);

attendanceRouter.get(
  '/class-roll',
  requireAuth,
  requirePermission('attendance:read'),
  requirePermission('students:read'),
  async (req, res, next) => {
    try {
      const parsed = classRollQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Paramètres de feuille d’appel invalides.', parsed.error.flatten());
      }
      const roll = await service.getClassRoll(parsed.data);
      res.json(roll);
    } catch (error) {
      next(error);
    }
  }
);

attendanceRouter.post(
  '/bulk',
  requireAuth,
  requirePermission('attendance:write'),
  requirePermission('students:read'),
  async (req, res, next) => {
    try {
      const parsed = bulkMarkAttendanceSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données d’appel invalides.', parsed.error.flatten());
      }
      const result = await service.saveBulkAttendance(parsed.data, {
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

attendanceRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('attendance:write'),
  requirePermission('students:read'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant de présence invalide.');
      }
      const parsed = updateAttendanceSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Mise à jour invalide.', parsed.error.flatten());
      }
      const updated = await service.updateAttendance(id, parsed.data, {
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
