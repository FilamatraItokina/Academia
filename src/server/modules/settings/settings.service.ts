import { recordAuditEvent } from '../audit/audit.service.ts';
import * as settingsRepo from './settings.repository.ts';
import type { UpdateSettingsInput } from './settings.schema.ts';
import type { SchoolSettingsItem } from './settings.types.ts';

export async function getSchoolSettings(): Promise<SchoolSettingsItem> {
  return await settingsRepo.getSettings();
}

export async function updateSchoolSettings(
  input: UpdateSettingsInput,
  actor: { id: number; email: string; ipAddress?: string | null }
): Promise<SchoolSettingsItem> {
  const updated = await settingsRepo.updateSettings(input);

  await recordAuditEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: 'SETTINGS_UPDATED',
    entityType: 'school_settings',
    entityId: updated.id,
    details: {
      schoolName: updated.schoolName,
      academicSystem: updated.academicSystem,
      gradingScale: updated.gradingScale,
      currency: updated.currency,
    },
    ipAddress: actor.ipAddress,
  });

  return updated;
}
