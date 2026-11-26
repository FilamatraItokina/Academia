import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  permissions,
  rolePermissions,
  roles,
  schoolSettings,
} from '../../db/schema.ts';

export const ROLE_CODES = {
  ADMIN: 'ADMIN',
  PRINCIPAL: 'PRINCIPAL',
  SECRETARY: 'SECRETARY',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
  ACCOUNTANT: 'ACCOUNTANT',
  SUPERVISOR: 'SUPERVISOR',
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export interface RoleDefinition {
  code: RoleCode;
  name: string;
  description: string;
}

export interface PermissionDefinition {
  code: string;
  module: string;
  description: string;
}

export const SYSTEM_ROLES: RoleDefinition[] = [
  {
    code: ROLE_CODES.ADMIN,
    name: 'Administrateur',
    description: 'Accès complet à la configuration système, aux comptes, rôles et journaux d’audit.',
  },
  {
    code: ROLE_CODES.PRINCIPAL,
    name: 'Directeur',
    description: 'Supervision générale de l’établissement, des années scolaires, bulletins et statistiques.',
  },
  {
    code: ROLE_CODES.SECRETARY,
    name: 'Secrétaire',
    description: 'Gestion administrative des inscriptions, dossiers élèves, parents et certificats.',
  },
  {
    code: ROLE_CODES.TEACHER,
    name: 'Enseignant',
    description: 'Saisie des notes, relevés de présences, appréciations et consultation des emplois du temps.',
  },
  {
    code: ROLE_CODES.STUDENT,
    name: 'Élève',
    description: 'Consultation personnelle de l’emploi du temps, des notes, bulletins et absences.',
  },
  {
    code: ROLE_CODES.PARENT,
    name: 'Parent',
    description: 'Suivi de la scolarité, des absences, bulletins et paiements des enfants rattachés.',
  },
  {
    code: ROLE_CODES.ACCOUNTANT,
    name: 'Comptable',
    description: 'Gestion des frais de scolarité, facturation, encaissements, reçus et impayés.',
  },
  {
    code: ROLE_CODES.SUPERVISOR,
    name: 'Surveillant',
    description: 'Suivi de la vie scolaire, absences, retards, justificatifs et surveillance des examens.',
  },
];

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  { code: 'users:read', module: 'Utilisateurs', description: 'Consulter la liste et les profils des utilisateurs' },
  { code: 'users:write', module: 'Utilisateurs', description: 'Créer, modifier, activer ou désactiver des comptes' },
  { code: 'roles:read', module: 'Rôles & Accès', description: 'Consulter les rôles et la matrice des permissions' },
  { code: 'roles:manage', module: 'Rôles & Accès', description: 'Modifier les permissions associées aux rôles' },
  { code: 'audit:read', module: 'Sécurité & Audit', description: 'Consulter le journal des opérations sensibles' },
  { code: 'settings:read', module: 'Établissement', description: 'Consulter les paramètres de l’établissement' },
  { code: 'settings:manage', module: 'Établissement', description: 'Modifier la configuration de l’établissement' },
  { code: 'academic_years:read', module: 'Années scolaires', description: 'Consulter les années et périodes scolaires' },
  { code: 'academic_years:manage', module: 'Années scolaires', description: 'Créer, activer et clôturer les années scolaires' },
  { code: 'classes:read', module: 'Classes & Niveaux', description: 'Consulter les niveaux, séries, classes et salles' },
  { code: 'classes:manage', module: 'Classes & Niveaux', description: 'Créer et organiser les classes et capacités' },
  { code: 'students:read', module: 'Élèves', description: 'Consulter les dossiers scolaires et inscriptions' },
  { code: 'students:write', module: 'Élèves', description: 'Inscrire, modifier et archiver des dossiers élèves' },
  { code: 'teachers:read', module: 'Enseignants', description: 'Consulter les dossiers et affectations enseignants' },
  { code: 'teachers:write', module: 'Enseignants', description: 'Gérer les enseignants et leurs affectations' },
  { code: 'guardians:read', module: 'Parents', description: 'Consulter les responsables légaux' },
  { code: 'guardians:write', module: 'Parents', description: 'Créer et associer les parents aux élèves' },
  { code: 'attendance:read', module: 'Vie scolaire', description: 'Consulter les présences, absences et retards' },
  { code: 'attendance:write', module: 'Vie scolaire', description: 'Saisir les présences et valider les justificatifs' },
  { code: 'subjects:read', module: 'Matières & Programmes', description: 'Consulter le référentiel des matières, coefficients et affectations' },
  { code: 'subjects:write', module: 'Matières & Programmes', description: 'Créer des matières et configurer les programmes par classe' },
  { code: 'grades:read', module: 'Évaluations & Notes', description: 'Consulter les notes et moyennes' },
  { code: 'grades:write', module: 'Évaluations & Notes', description: 'Créer des évaluations et saisir les notes' },
  { code: 'report_cards:read', module: 'Bulletins', description: 'Consulter et télécharger les bulletins scolaires' },
  { code: 'report_cards:manage', module: 'Bulletins', description: 'Générer et valider les bulletins trimestriels' },
  { code: 'timetables:read', module: 'Emplois du temps', description: 'Consulter les emplois du temps' },
  { code: 'timetables:manage', module: 'Emplois du temps', description: 'Planifier les créneaux et résoudre les conflits' },
  { code: 'finance:read', module: 'Finances', description: 'Consulter les factures, paiements et reçus' },
  { code: 'finance:manage', module: 'Finances', description: 'Émettre des factures et enregistrer des paiements' },
  { code: 'announcements:read', module: 'Communication', description: 'Consulter les annonces et notifications' },
  { code: 'announcements:write', module: 'Communication', description: 'Publier des annonces officielles' },
  { code: 'analytics:read', module: 'Statistiques', description: 'Consulter les indicateurs et tableaux de bord' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, string[]> = {
  ADMIN: SYSTEM_PERMISSIONS.map((p) => p.code),
  PRINCIPAL: [
    'users:read',
    'roles:read',
    'audit:read',
    'settings:read',
    'settings:manage',
    'academic_years:read',
    'academic_years:manage',
    'classes:read',
    'classes:manage',
    'students:read',
    'students:write',
    'teachers:read',
    'teachers:write',
    'guardians:read',
    'attendance:read',
    'subjects:read',
    'grades:read',
    'report_cards:read',
    'report_cards:manage',
    'timetables:read',
    'timetables:manage',
    'finance:read',
    'announcements:read',
    'announcements:write',
    'analytics:read',
    'subjects:write',
  ],
  SECRETARY: [
    'settings:read',
    'academic_years:read',
    'classes:read',
    'classes:manage',
    'students:read',
    'students:write',
    'teachers:read',
    'guardians:read',
    'guardians:write',
    'attendance:read',
    'subjects:read',
    'subjects:write',
    'report_cards:read',
    'timetables:read',
    'announcements:read',
    'announcements:write',
  ],
  TEACHER: [
    'academic_years:read',
    'classes:read',
    'students:read',
    'attendance:read',
    'attendance:write',
    'subjects:read',
    'grades:read',
    'grades:write',
    'report_cards:read',
    'timetables:read',
    'announcements:read',
  ],
  STUDENT: [
    'academic_years:read',
    'attendance:read',
    'subjects:read',
    'grades:read',
    'report_cards:read',
    'timetables:read',
    'announcements:read',
  ],
  PARENT: [
    'academic_years:read',
    'attendance:read',
    'subjects:read',
    'grades:read',
    'report_cards:read',
    'timetables:read',
    'finance:read',
    'announcements:read',
  ],
  ACCOUNTANT: [
    'settings:read',
    'academic_years:read',
    'students:read',
    'guardians:read',
    'finance:read',
    'finance:manage',
    'announcements:read',
    'analytics:read',
  ],
  SUPERVISOR: [
    'academic_years:read',
    'classes:read',
    'students:read',
    'guardians:read',
    'attendance:read',
    'attendance:write',
    'subjects:read',
    'timetables:read',
    'announcements:read',
    'announcements:write',
  ],
};

let seedPromise: Promise<void> | null = null;
let seeded = false;

export async function ensureFoundationSeeded(): Promise<void> {
  if (seeded) return;
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        for (const roleDef of SYSTEM_ROLES) {
          await db
            .insert(roles)
            .values({
              code: roleDef.code,
              name: roleDef.name,
              description: roleDef.description,
              isSystem: true,
            })
            .onConflictDoNothing({ target: roles.code });
        }

        const existingPerms = await db.select({ code: permissions.code }).from(permissions);
        const existingPermCodeSet = new Set(existingPerms.map((p) => p.code));
        const newlyInsertedPermCodes = new Set<string>();

        for (const permDef of SYSTEM_PERMISSIONS) {
          if (!existingPermCodeSet.has(permDef.code)) {
            newlyInsertedPermCodes.add(permDef.code);
          }
          await db
            .insert(permissions)
            .values({
              code: permDef.code,
              module: permDef.module,
              description: permDef.description,
            })
            .onConflictDoNothing({ target: permissions.code });
        }

        const existingRolePerms = await db.select().from(rolePermissions).limit(1);
        if (existingRolePerms.length === 0 || newlyInsertedPermCodes.size > 0) {
          const allRoles = await db.select().from(roles);
          const allPerms = await db.select().from(permissions);
          const roleByCode = new Map(allRoles.map((r) => [r.code, r.id]));
          const permByCode = new Map(allPerms.map((p) => [p.code, p.id]));

          const pairs: Array<{ roleId: number; permissionId: number }> = [];
          for (const [roleCode, permCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
            const roleId = roleByCode.get(roleCode);
            if (!roleId) continue;
            for (const pCode of permCodes) {
              if (existingRolePerms.length > 0 && !newlyInsertedPermCodes.has(pCode)) {
                continue;
              }
              const permissionId = permByCode.get(pCode);
              if (permissionId) {
                pairs.push({ roleId, permissionId });
              }
            }
          }
          if (pairs.length > 0) {
            await db.insert(rolePermissions).values(pairs).onConflictDoNothing();
          }
        }

        const existingSettings = await db.select().from(schoolSettings).limit(1);
        if (existingSettings.length === 0) {
          await db.insert(schoolSettings).values({
            schoolName: 'Lycée Académia',
            schoolType: 'LYCEE_COLLEGE',
            academicSystem: 'TRIMESTER',
            gradingScale: 20,
            currency: 'EUR',
            address: '',
            phone: '',
            email: '',
          });
        }

        seeded = true;
      } catch (err) {
        seedPromise = null;
        throw err;
      }
    })();
  }
  return seedPromise;
}

export async function getPermissionsForRoleIds(roleIds: number[]): Promise<string[]> {
  if (roleIds.length === 0) return [];
  const rows = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(inArray(rolePermissions.roleId, roleIds));

  return Array.from(new Set(rows.map((r) => r.code)));
}
