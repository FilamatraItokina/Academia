import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { recordAuditEvent } from '../modules/audit/audit.service.ts';
import * as userRepo from '../modules/users/user.repository.ts';
import type { UserWithRoles } from '../modules/users/user.types.ts';
import { ForbiddenError, UnauthorizedError } from '../shared/errors.ts';

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: DecodedIdToken;
      currentUser?: UserWithRoles;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Jeton d’authentification manquant.');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedError('Jeton d’authentification invalide.');
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      throw new UnauthorizedError('Session expirée ou jeton invalide.');
    }

    if (!decoded.email) {
      throw new UnauthorizedError('Le compte authentifié doit disposer d’une adresse e-mail.');
    }

    const { user, isNewBootstrapAdmin } = await userRepo.syncFirebaseUser({
      uid: decoded.uid,
      email: decoded.email,
      displayName: decoded.name,
      avatarUrl: decoded.picture,
    });

    if (isNewBootstrapAdmin) {
      await recordAuditEvent({
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'BOOTSTRAP_ADMIN_ASSIGNED',
        entityType: 'user',
        entityId: user.id,
        details: { email: user.email },
        ipAddress: req.ip,
      });
    }

    if (!user.isActive) {
      throw new ForbiddenError(
        'Ce compte est désactivé ou en attente d’activation par un administrateur.'
      );
    }

    req.firebaseUser = decoded;
    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function hasPermission(user: UserWithRoles, permissionCode: string): boolean {
  return user.permissions.includes(permissionCode);
}

export function requirePermission(permissionCode: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.currentUser) {
      next(new UnauthorizedError());
      return;
    }
    if (!hasPermission(req.currentUser, permissionCode)) {
      next(
        new ForbiddenError(
          `Permission requise (${permissionCode}) pour effectuer cette action.`
        )
      );
      return;
    }
    next();
  };
}
