import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import {
  classSummaryQuerySchema,
  createAssessmentSchema,
  listAssessmentsQuerySchema,
  myGradesQuerySchema,
  saveBulkScoresSchema,
  updateAssessmentSchema,
} from './grade.schema.ts';
import * as service from './grade.service.ts';

export const gradesRouter = Router();

gradesRouter.get(
  '/assessments',
  requireAuth,
  requirePermission('grades:read'),
  async (req, res, next) => {
    try {
      const parsed = listAssessmentsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Paramètres de recherche invalides.', parsed.error.flatten());
      }
      const items = await service.listAssessments(parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
      });
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
);

gradesRouter.post(
  '/assessments',
  requireAuth,
  requirePermission('grades:write'),
  async (req, res, next) => {
    try {
      const parsed = createAssessmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de l’évaluation invalides.', parsed.error.flatten());
      }
      const created = await service.createAssessment(parsed.data, {
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

gradesRouter.patch(
  '/assessments/:id',
  requireAuth,
  requirePermission('grades:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant d’évaluation invalide.');
      }
      const parsed = updateAssessmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de mise à jour invalides.', parsed.error.flatten());
      }
      const updated = await service.updateAssessment(id, parsed.data, {
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

gradesRouter.delete(
  '/assessments/:id',
  requireAuth,
  requirePermission('grades:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant d’évaluation invalide.');
      }
      await service.deleteAssessment(id, {
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

gradesRouter.get(
  '/assessments/:id/sheet',
  requireAuth,
  requirePermission('grades:read'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant d’évaluation invalide.');
      }
      const sheet = await service.getAssessmentSheet(id, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
      });
      res.json(sheet);
    } catch (error) {
      next(error);
    }
  }
);

gradesRouter.put(
  '/assessments/:id/scores',
  requireAuth,
  requirePermission('grades:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant d’évaluation invalide.');
      }
      const parsed = saveBulkScoresSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Notes saisies invalides.', parsed.error.flatten());
      }
      const result = await service.saveAssessmentScores(id, parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

gradesRouter.get(
  '/class-summary',
  requireAuth,
  requirePermission('grades:read'),
  async (req, res, next) => {
    try {
      const parsed = classSummaryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Paramètres de synthèse invalides.', parsed.error.flatten());
      }
      const summary = await service.getClassTermSummary(parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
      });
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
);

gradesRouter.get(
  '/my-summary',
  requireAuth,
  requirePermission('grades:read'),
  async (req, res, next) => {
    try {
      const parsed = myGradesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Paramètres invalides.', parsed.error.flatten());
      }
      const data = await service.getMyPublishedGrades(parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        roleCodes: req.currentUser!.roles.map((r) => r.code),
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  }
);
