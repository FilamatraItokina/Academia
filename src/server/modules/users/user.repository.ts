import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from '../../../db/schema.ts';
import {
  ensureFoundationSeeded,
  getPermissionsForRoleIds,
  ROLE_CODES,
} from '../../config/rbac.ts';
import type { ListUsersQuery } from './user.schema.ts';
import type {
  PermissionItem,
  RoleSummary,
  RoleWithPermissions,
  UserWithRoles,
} from './user.types.ts';

async function hydrateUsers(
  userRows: Array<typeof users.$inferSelect>
): Promise<UserWithRoles[]> {
  if (userRows.length === 0) return [];
  const userIds = userRows.map((u) => u.id);

  const roleMappings = await db
    .select({
      userId: userRoles.userId,
      roleId: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(inArray(userRoles.userId, userIds));

  const allRoleIds = Array.from(new Set(roleMappings.map((m) => m.roleId)));
  const rolePermRows =
    allRoleIds.length > 0
      ? await db
          .select({
            roleId: rolePermissions.roleId,
            code: permissions.code,
          })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(inArray(rolePermissions.roleId, allRoleIds))
      : [];

  const permsByRoleId = new Map<number, string[]>();
  for (const rp of rolePermRows) {
    const list = permsByRoleId.get(rp.roleId) ?? [];
    list.push(rp.code);
    permsByRoleId.set(rp.roleId, list);
  }

  const rolesByUserId = new Map<number, RoleSummary[]>();
  const permsByUserId = new Map<number, Set<string>>();

  for (const m of roleMappings) {
    const rList = rolesByUserId.get(m.userId) ?? [];
    rList.push({
      id: m.roleId,
      code: m.code,
      name: m.name,
      description: m.description,
      isSystem: m.isSystem,
    });
    rolesByUserId.set(m.userId, rList);

    const pSet = permsByUserId.get(m.userId) ?? new Set<string>();
    for (const p of permsByRoleId.get(m.roleId) ?? []) {
      pSet.add(p);
    }
    permsByUserId.set(m.userId, pSet);
  }

  return userRows.map((u) => ({
    id: u.id,
    uid: u.uid,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    roles: rolesByUserId.get(u.id) ?? [],
    permissions: Array.from(permsByUserId.get(u.id) ?? []),
  }));
}

export async function findUserById(id: number): Promise<UserWithRoles | null> {
  try {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (rows.length === 0) return null;
    const hydrated = await hydrateUsers(rows);
    return hydrated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findUserById:', error);
    throw new Error('Impossible de récupérer le profil utilisateur.', { cause: error });
  }
}

export async function findUserByEmail(email: string): Promise<UserWithRoles | null> {
  try {
    const normalized = email.trim().toLowerCase();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);
    if (rows.length === 0) return null;
    const hydrated = await hydrateUsers(rows);
    return hydrated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findUserByEmail:', error);
    throw new Error('Impossible de vérifier l’adresse e-mail.', { cause: error });
  }
}

export async function syncFirebaseUser(params: {
  uid: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}): Promise<{ user: UserWithRoles; isNewBootstrapAdmin: boolean }> {
  try {
    await ensureFoundationSeeded();
    const normalizedEmail = params.email.trim().toLowerCase();
    const nameParts = (params.displayName ?? normalizedEmail.split('@')[0] ?? 'Utilisateur')
      .trim()
      .split(/\s+/);
    const firstName = nameParts[0] || 'Utilisateur';
    const lastName = nameParts.slice(1).join(' ') || 'Académia';

    let existing = await db
      .select()
      .from(users)
      .where(or(eq(users.uid, params.uid), eq(users.email, normalizedEmail)))
      .limit(1);

    let userRecord: typeof users.$inferSelect;
    let isNewBootstrapAdmin = false;

    if (existing.length > 0) {
      const current = existing[0];
      const updated = await db
        .update(users)
        .set({
          uid: params.uid,
          avatarUrl: params.avatarUrl ?? current.avatarUrl,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, current.id))
        .returning();
      userRecord = updated[0];
    } else {
      const adminRoleRow = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.code, ROLE_CODES.ADMIN))
        .limit(1);

      const existingAdminCount =
        adminRoleRow.length > 0
          ? await db
              .select({ value: count() })
              .from(userRoles)
              .where(eq(userRoles.roleId, adminRoleRow[0].id))
          : [{ value: 0 }];

      const hasAnyAdmin = Number(existingAdminCount[0]?.value ?? 0) > 0;
      isNewBootstrapAdmin = !hasAnyAdmin;

      const inserted = await db
        .insert(users)
        .values({
          uid: params.uid,
          email: normalizedEmail,
          firstName,
          lastName,
          avatarUrl: params.avatarUrl ?? null,
          isActive: !hasAnyAdmin,
          lastLoginAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            uid: params.uid,
            avatarUrl: params.avatarUrl ?? sql`${users.avatarUrl}`,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      userRecord = inserted[0];

      if (!hasAnyAdmin && adminRoleRow.length > 0) {
        await db
          .insert(userRoles)
          .values({
            userId: userRecord.id,
            roleId: adminRoleRow[0].id,
          })
          .onConflictDoNothing();
      }
    }

    const hydrated = await hydrateUsers([userRecord]);
    return {
      user: hydrated[0],
      isNewBootstrapAdmin,
    };
  } catch (error) {
    console.error('Database query failed in syncFirebaseUser:', error);
    throw new Error('Erreur lors de la synchronisation du compte utilisateur.', {
      cause: error,
    });
  }
}

export async function findUsers(
  query: ListUsersQuery
): Promise<{ items: UserWithRoles[]; total: number }> {
  try {
    const conditions = [];
    if (query.isActive !== undefined) {
      conditions.push(eq(users.isActive, query.isActive));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(users.email, pattern),
          ilike(users.firstName, pattern),
          ilike(users.lastName, pattern)
        )
      );
    }
    if (query.roleCode) {
      const userIdsWithRole = db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(roles.code, query.roleCode));
      conditions.push(inArray(users.id, userIdsWithRole));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(query.limit)
        .offset(offset),
      db.select({ value: count() }).from(users).where(whereClause),
    ]);

    const items = await hydrateUsers(rows);
    return { items, total: Number(totalRows[0]?.value ?? 0) };
  } catch (error) {
    console.error('Database query failed in findUsers:', error);
    throw new Error('Impossible de charger la liste des utilisateurs.', { cause: error });
  }
}

export async function createUserWithRoles(input: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive: boolean;
  roleIds: number[];
}): Promise<UserWithRoles> {
  try {
    const createdId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(users)
        .values({
          email: input.email.trim().toLowerCase(),
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone ?? null,
          isActive: input.isActive,
        })
        .returning();

      const newUser = inserted[0];
      await tx.insert(userRoles).values(
        input.roleIds.map((roleId) => ({
          userId: newUser.id,
          roleId,
        }))
      );
      return newUser.id;
    });

    const created = await findUserById(createdId);
    if (!created) {
      throw new Error('Utilisateur créé introuvable.');
    }
    return created;
  } catch (error) {
    console.error('Database query failed in createUserWithRoles:', error);
    throw new Error('Échec de la création du compte utilisateur.', { cause: error });
  }
}

export async function updateUserWithRoles(
  userId: number,
  updates: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    isActive?: boolean;
    roleIds?: number[];
  }
): Promise<UserWithRoles> {
  try {
    await db.transaction(async (tx) => {
      const setPayload: Partial<typeof users.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (updates.firstName !== undefined) setPayload.firstName = updates.firstName;
      if (updates.lastName !== undefined) setPayload.lastName = updates.lastName;
      if (updates.phone !== undefined) setPayload.phone = updates.phone;
      if (updates.isActive !== undefined) setPayload.isActive = updates.isActive;

      await tx.update(users).set(setPayload).where(eq(users.id, userId));

      if (updates.roleIds !== undefined) {
        await tx.delete(userRoles).where(eq(userRoles.userId, userId));
        if (updates.roleIds.length > 0) {
          await tx.insert(userRoles).values(
            updates.roleIds.map((roleId) => ({
              userId,
              roleId,
            }))
          );
        }
      }
    });

    const updated = await findUserById(userId);
    if (!updated) {
      throw new Error('Utilisateur mis à jour introuvable.');
    }
    return updated;
  } catch (error) {
    console.error('Database query failed in updateUserWithRoles:', error);
    throw new Error('Échec de la mise à jour du compte utilisateur.', { cause: error });
  }
}

export async function countActiveAdmins(excludeUserId?: number): Promise<number> {
  try {
    const conditions = [eq(roles.code, ROLE_CODES.ADMIN), eq(users.isActive, true)];
    if (excludeUserId !== undefined) {
      conditions.push(sql`${users.id} <> ${excludeUserId}`);
    }
    const rows = await db
      .select({ value: count() })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(...conditions));
    return Number(rows[0]?.value ?? 0);
  } catch (error) {
    console.error('Database query failed in countActiveAdmins:', error);
    throw new Error('Impossible de vérifier les administrateurs actifs.', { cause: error });
  }
}

export async function findAllRoles(): Promise<RoleWithPermissions[]> {
  try {
    await ensureFoundationSeeded();
    const [roleRows, rpRows, userCounts] = await Promise.all([
      db.select().from(roles).orderBy(roles.id),
      db
        .select({
          roleId: rolePermissions.roleId,
          code: permissions.code,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id)),
      db
        .select({
          roleId: userRoles.roleId,
          value: count(),
        })
        .from(userRoles)
        .groupBy(userRoles.roleId),
    ]);

    const permsByRole = new Map<number, string[]>();
    for (const row of rpRows) {
      const arr = permsByRole.get(row.roleId) ?? [];
      arr.push(row.code);
      permsByRole.set(row.roleId, arr);
    }

    const countByRole = new Map<number, number>();
    for (const row of userCounts) {
      countByRole.set(row.roleId, Number(row.value));
    }

    return roleRows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissionCodes: permsByRole.get(r.id) ?? [],
      userCount: countByRole.get(r.id) ?? 0,
    }));
  } catch (error) {
    console.error('Database query failed in findAllRoles:', error);
    throw new Error('Impossible de charger les rôles.', { cause: error });
  }
}

export async function findRolesByCodes(codes: string[]): Promise<RoleSummary[]> {
  try {
    if (codes.length === 0) return [];
    return await db.select().from(roles).where(inArray(roles.code, codes));
  } catch (error) {
    console.error('Database query failed in findRolesByCodes:', error);
    throw new Error('Impossible de valider les rôles.', { cause: error });
  }
}

export async function findRoleById(roleId: number): Promise<RoleSummary | null> {
  try {
    const rows = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findRoleById:', error);
    throw new Error('Impossible de trouver le rôle.', { cause: error });
  }
}

export async function findAllPermissions(): Promise<PermissionItem[]> {
  try {
    await ensureFoundationSeeded();
    return await db.select().from(permissions).orderBy(permissions.module, permissions.code);
  } catch (error) {
    console.error('Database query failed in findAllPermissions:', error);
    throw new Error('Impossible de charger les permissions.', { cause: error });
  }
}

export async function replaceRolePermissions(
  roleId: number,
  permissionIds: number[]
): Promise<string[]> {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      if (permissionIds.length > 0) {
        await tx.insert(rolePermissions).values(
          permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          }))
        );
      }
    });
    return await getPermissionsForRoleIds([roleId]);
  } catch (error) {
    console.error('Database query failed in replaceRolePermissions:', error);
    throw new Error('Échec de la mise à jour des permissions du rôle.', { cause: error });
  }
}
