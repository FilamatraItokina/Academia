import type { RoleCode } from '../../config/rbac.ts';

export interface RoleSummary {
  id: number;
  code: RoleCode | string;
  name: string;
  description: string;
  isSystem: boolean;
}

export interface UserWithRoles {
  id: number;
  uid: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles: RoleSummary[];
  permissions: string[];
}

export interface RoleWithPermissions extends RoleSummary {
  permissionCodes: string[];
  userCount: number;
}

export interface PermissionItem {
  id: number;
  code: string;
  module: string;
  description: string;
}
