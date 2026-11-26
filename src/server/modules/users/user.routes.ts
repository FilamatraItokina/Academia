import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.ts';
import { ValidationError } from '../../shared/errors.ts';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateRolePermissionsSchema,
  updateUserSchema,
} from './user.schema.ts';
import * as userService from './user.service.ts';

export const usersRouter = Router();
export const rolesRouter = Router();

usersRouter.get(
  '/',
  requireAuth,
  requirePermission('users:read'),
  async (req, res, next) => {
    try {
      const parsed = listUsersQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Paramètres de recherche invalides.', parsed.error.flatten());
      }
      const result = await userService.listUsers(parsed.data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.post(
  '/',
  requireAuth,
  requirePermission('users:write'),
  async (req, res, next) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données utilisateur invalides.', parsed.error.flatten());
      }
      const created = await userService.createUser(parsed.data, {
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

usersRouter.get(
  '/:id',
  requireAuth,
  requirePermission('users:read'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant utilisateur invalide.');
      }
      const user = await userService.getUserById(id);
      res.json(user);
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('users:write'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('Identifiant utilisateur invalide.');
      }
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Données de mise à jour invalides.', parsed.error.flatten());
      }
      const updated = await userService.updateUser(id, parsed.data, {
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

rolesRouter.get(
  '/',
  requireAuth,
  requirePermission('roles:read'),
  async (_req, res, next) => {
    try {
      const roles = await userService.listRoles();
      res.json({ items: roles });
    } catch (error) {
      next(error);
    }
  }
);

rolesRouter.get(
  '/permissions',
  requireAuth,
  requirePermission('roles:read'),
  async (_req, res, next) => {
    try {
      const perms = await userService.listPermissions();
      res.json({ items: perms });
    } catch (error) {
      next(error);
    }
  }
);

rolesRouter.put(
  '/:id/permissions',
  requireAuth,
  requirePermission('roles:manage'),
  async (req, res, next) => {
    try {
      const roleId = Number(req.params.id);
      if (!Number.isInteger(roleId) || roleId <= 0) {
        throw new ValidationError('Identifiant de rôle invalide.');
      }
      const parsed = updateRolePermissionsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Liste de permissions invalide.', parsed.error.flatten());
      }
      const permissions = await userService.updateRolePermissions(roleId, parsed.data, {
        id: req.currentUser!.id,
        email: req.currentUser!.email,
        ipAddress: req.ip,
      });
      res.json({ roleId, permissionCodes: permissions });
    } catch (error) {
      next(error);
    }
  }
);
