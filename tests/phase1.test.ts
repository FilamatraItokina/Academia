import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_CODES,
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
} from '../src/server/config/rbac.ts';
import { updateSettingsSchema } from '../src/server/modules/settings/settings.schema.ts';
import {
  createUserSchema,
  updateRolePermissionsSchema,
  updateUserSchema,
} from '../src/server/modules/users/user.schema.ts';
import { buildPaginatedResult } from '../src/server/shared/pagination.ts';

describe('Phase 1 — RBAC & Fondations techniques', () => {
  it('définit exactement les 8 rôles scolaires attendus', () => {
    expect(SYSTEM_ROLES).toHaveLength(8);
    const codes = SYSTEM_ROLES.map((r) => r.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        ROLE_CODES.ADMIN,
        ROLE_CODES.PRINCIPAL,
        ROLE_CODES.SECRETARY,
        ROLE_CODES.TEACHER,
        ROLE_CODES.STUDENT,
        ROLE_CODES.PARENT,
        ROLE_CODES.ACCOUNTANT,
        ROLE_CODES.SUPERVISOR,
      ])
    );
  });

  it('attribue toutes les permissions système au rôle ADMIN et uniquement des permissions valides aux autres rôles', () => {
    const validCodes = new Set(SYSTEM_PERMISSIONS.map((p) => p.code));
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN.length).toBe(SYSTEM_PERMISSIONS.length);

    for (const [roleCode, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      expect(perms.length, `Le rôle ${roleCode} doit avoir au moins une permission`).toBeGreaterThan(0);
      for (const perm of perms) {
        expect(validCodes.has(perm), `Permission inconnue ${perm} pour ${roleCode}`).toBe(true);
      }
    }
  });

  it('valide les données de création d’utilisateur avec Zod', () => {
    const valid = createUserSchema.safeParse({
      email: '  Prof.Dupont@Lycee.fr ',
      firstName: 'Jean',
      lastName: 'Dupont',
      roleCodes: ['TEACHER'],
      isActive: true,
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.email).toBe('prof.dupont@lycee.fr');
    }

    const invalidNoRole = createUserSchema.safeParse({
      email: 'eleve@lycee.fr',
      firstName: 'Lina',
      lastName: 'Martin',
      roleCodes: [],
    });
    expect(invalidNoRole.success).toBe(false);
  });

  it('valide la mise à jour partielle des utilisateurs et des permissions', () => {
    expect(updateUserSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(
      updateRolePermissionsSchema.safeParse({
        permissionCodes: ['users:read', 'students:read'],
      }).success
    ).toBe(true);
  });

  it('valide les paramètres de l’établissement', () => {
    const res = updateSettingsSchema.safeParse({
      schoolName: 'Lycée Jean Jaurès',
      schoolType: 'LYCEE_COLLEGE',
      academicSystem: 'TRIMESTER',
      gradingScale: '20',
      currency: 'eur',
      address: '12 avenue de la République',
      phone: '+33 1 40 00 00 00',
      email: 'contact@lycee-jaures.fr',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.gradingScale).toBe(20);
      expect(res.data.currency).toBe('EUR');
    }
  });

  it('calcule correctement les métadonnées de pagination', () => {
    const page1 = buildPaginatedResult(['a', 'b'], 45, 1, 20);
    expect(page1.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
    const empty = buildPaginatedResult([], 0, 1, 20);
    expect(empty.pagination.totalPages).toBe(1);
  });
});
