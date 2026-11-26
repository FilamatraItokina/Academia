import { ROLE_CODES } from '../../config/rbac.ts';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.ts';
import { buildPaginatedResult, type PaginatedResult } from '../../shared/pagination.ts';
import { recordAuditEvent } from '../audit/audit.service.ts';
import * as userRepo from './user.repository.ts';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateRolePermissionsInput,
  UpdateUserInput,
} from './user.schema.ts';
import type {
  PermissionItem,
  RoleWithPermissions,
  UserWithRoles,
} from './user.types.ts';

export async function listUsers(
  query: ListUsersQuery
): Promise<PaginatedResult<UserWithRoles>> {
  const { items, total } = await userRepo.findUsers(query);
  return buildPaginatedResult(items, total, query.page, query.limit);
}

export async function getUserById(userId: number): Promise<UserWithRoles> {
  const user = await userRepo.findUserById(userId);
  if (!user) {
    throw new NotFoundError('Utilisateur introuvable.');
  }
  return user;
}

export async function createUser(
  input: CreateUserInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<UserWithRoles> {
  const existing = await userRepo.findUserByEmail(input.email);
  if (existing) {
    throw new ConflictError('Un compte existe déjà avec cette adresse e-mail.');
  }

  const matchedRoles = await userRepo.findRolesByCodes(input.roleCodes);
  if (matchedRoles.length !== new Set(input.roleCodes).size) {
    throw new ValidationError('Un ou plusieurs codes de rôle sont invalides.');
  }

  const created = await userRepo.createUserWithRoles({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone ?? null,
    isActive: input.isActive,
    roleIds: matchedRoles.map((r) => r.id),
  });

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'USER_CREATED',
    entityType: 'user',
    entityId: created.id,
    details: {
      email: created.email,
      roles: created.roles.map((r) => r.code),
      isActive: created.isActive,
    },
    ipAddress: actor.ipAddress,
  });

  return created;
}

export async function updateUser(
  targetUserId: number,
  input: UpdateUserInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<UserWithRoles> {
  const target = await userRepo.findUserById(targetUserId);
  if (!target) {
    throw new NotFoundError('Utilisateur introuvable.');
  }

  if (actor.id === targetUserId && input.isActive === false) {
    throw new ForbiddenError('Vous ne pouvez pas désactiver votre propre compte.');
  }

  const targetWasAdmin = target.roles.some((r) => r.code === ROLE_CODES.ADMIN);
  const willStillBeAdmin =
    input.roleCodes === undefined
      ? targetWasAdmin
      : input.roleCodes.includes(ROLE_CODES.ADMIN);
  const willStillBeActive =
    input.isActive === undefined ? target.isActive : input.isActive;

  if (targetWasAdmin && target.isActive && (!willStillBeAdmin || !willStillBeActive)) {
    const remainingAdmins = await userRepo.countActiveAdmins(targetUserId);
    if (remainingAdmins === 0) {
      throw new ForbiddenError(
        'Impossible de retirer ou désactiver le dernier administrateur actif.'
      );
    }
  }

  let roleIds: number[] | undefined;
  if (input.roleCodes !== undefined) {
    const matchedRoles = await userRepo.findRolesByCodes(input.roleCodes);
    if (matchedRoles.length !== new Set(input.roleCodes).size) {
      throw new ValidationError('Un ou plusieurs codes de rôle sont invalides.');
    }
    roleIds = matchedRoles.map((r) => r.id);
  }

  const updated = await userRepo.updateUserWithRoles(targetUserId, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    isActive: input.isActive,
    roleIds,
  });

  const action =
    input.isActive !== undefined && input.isActive !== target.isActive
      ? 'USER_STATUS_CHANGED'
      : 'USER_UPDATED';

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action,
    entityType: 'user',
    entityId: updated.id,
    details: {
      email: updated.email,
      isActive: updated.isActive,
      roles: updated.roles.map((r) => r.code),
    },
    ipAddress: actor.ipAddress,
  });

  return updated;
}

export async function listRoles(): Promise<RoleWithPermissions[]> {
  return await userRepo.findAllRoles();
}

export async function listPermissions(): Promise<PermissionItem[]> {
  return await userRepo.findAllPermissions();
}

export async function updateRolePermissions(
  roleId: number,
  input: UpdateRolePermissionsInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<string[]> {
  const role = await userRepo.findRoleById(roleId);
  if (!role) {
    throw new NotFoundError('Rôle introuvable.');
  }

  const allPerms = await userRepo.findAllPermissions();
  const permByCode = new Map(allPerms.map((p) => [p.code, p.id]));

  const requestedCodes = Array.from(new Set(input.permissionCodes));
  if (role.code === ROLE_CODES.ADMIN && !requestedCodes.includes('roles:manage')) {
    throw new ForbiddenError(
      'Le rôle Administrateur doit conserver la permission roles:manage.'
    );
  }

  const permissionIds: number[] = [];
  for (const code of requestedCodes) {
    const id = permByCode.get(code);
    if (!id) {
      throw new ValidationError(`Permission inconnue : ${code}`);
    }
    permissionIds.push(id);
  }

  const updatedPerms = await userRepo.replaceRolePermissions(roleId, permissionIds);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'ROLE_PERMISSIONS_UPDATED',
    entityType: 'role',
    entityId: role.id,
    details: {
      roleCode: role.code,
      permissionCount: updatedPerms.length,
    },
    ipAddress: actor.ipAddress,
  });

  return updatedPerms;
}
