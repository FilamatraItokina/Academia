import { recordAuditEvent } from '../audit/audit.service.ts';
import * as userRepo from '../users/user.repository.ts';
import type { UserWithRoles } from '../users/user.types.ts';
import type { UpdateProfileInput } from './auth.schema.ts';

export async function updateOwnProfile(
  userId: number,
  input: UpdateProfileInput,
  ipAddress?: string | null
): Promise<UserWithRoles> {
  const updated = await userRepo.updateUserWithRoles(userId, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone ?? null,
  });

  await recordAuditEvent({
    actorUserId: updated.id,
    actorEmail: updated.email,
    action: 'PROFILE_UPDATED',
    entityType: 'user',
    entityId: updated.id,
    details: { firstName: updated.firstName, lastName: updated.lastName },
    ipAddress,
  });

  return updated;
}

export async function logSessionEvent(
  user: UserWithRoles,
  action: 'AUTH_LOGIN' | 'AUTH_LOGOUT',
  ipAddress?: string | null
): Promise<void> {
  await recordAuditEvent({
    actorUserId: user.id,
    actorEmail: user.email,
    action,
    entityType: 'session',
    entityId: user.id,
    ipAddress,
  });
}
