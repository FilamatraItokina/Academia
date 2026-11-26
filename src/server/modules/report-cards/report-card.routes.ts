import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import {
  classReportCardsQuerySchema,
  generateReportCardsSchema,
  updateReportCardSchema,
} from './report-card.schema.ts';
import * as service from './report-card.service.ts';

export const reportCardsRouter = Router();

reportCardsRouter.get(
  '/class',
  requireAuth,
  requirePermission('report_cards:read'),
  async (req, res, next) => {
    try {
      const parsed = classReportCardsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Paramètres de recherche invalides.', parsed.error.flatten());
      }
      const data = await service.listClassReportCards(parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        permissions: req.currentUser!.permissions,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  }
);

reportCardsRouter.post(
  '/generate',
  requireAuth,
  requirePermission('report_cards:manage'),
  async (req, res, next) => {
    try {
      const parsed = generateReportCardsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de génération invalides.', parsed.error.flatten());
      }
      const result = await service.generateClassReportCards(parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        permissions: req.currentUser!.permissions,
        ipAddress: req.ip,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

reportCardsRouter.post(
  '/class/validate-all',
  requireAuth,
  requirePermission('report_cards:manage'),
  async (req, res, next) => {
    try {
      const parsed = generateReportCardsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Paramètres invalides.', parsed.error.flatten());
      }
      const result = await service.validateAllClassCards(parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        permissions: req.currentUser!.permissions,
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

reportCardsRouter.get(
  '/my-cards',
  requireAuth,
  requirePermission('report_cards:read'),
  async (req, res, next) => {
    try {
      const data = await service.listMyValidatedReportCards({
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        permissions: req.currentUser!.permissions,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  }
);

reportCardsRouter.get(
  '/:id',
  requireAuth,
  requirePermission('report_cards:read'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant de bulletin invalide.');
      }
      const detail = await service.getReportCardDetail(id, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        permissions: req.currentUser!.permissions,
      });
      res.json(detail);
    } catch (error) {
      next(error);
    }
  }
);

reportCardsRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('report_cards:read'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant de bulletin invalide.');
      }
      const parsed = updateReportCardSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de mise à jour invalides.', parsed.error.flatten());
      }
      const updated = await service.updateReportCard(id, parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        permissions: req.currentUser!.permissions,
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

reportCardsRouter.post(
  '/:id/validate',
  requireAuth,
  requirePermission('report_cards:manage'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant de bulletin invalide.');
      }
      const updated = await service.validateReportCard(id, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        permissions: req.currentUser!.permissions,
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

reportCardsRouter.post(
  '/:id/reopen',
  requireAuth,
  requirePermission('report_cards:manage'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant de bulletin invalide.');
      }
      const updated = await service.reopenReportCard(id, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        permissions: req.currentUser!.permissions,
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

reportCardsRouter.get(
  '/:id/pdf',
  requireAuth,
  requirePermission('report_cards:read'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant de bulletin invalide.');
      }
      const { buffer, filename } = await service.generateReportCardPdf(id, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        permissions: req.currentUser!.permissions,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(buffer.length));
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
);
