import { eq } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import { schoolSettings } from '../../../db/schema.ts';
import { ensureFoundationSeeded } from '../../config/rbac.ts';
import type { UpdateSettingsInput } from './settings.schema.ts';
import type { SchoolSettingsItem } from './settings.types.ts';

export async function getSettings(): Promise<SchoolSettingsItem> {
  try {
    await ensureFoundationSeeded();
    const rows = await db.select().from(schoolSettings).limit(1);
    return rows[0];
  } catch (error) {
    console.error('Database query failed in getSettings:', error);
    throw new Error('Impossible de charger les paramètres de l’établissement.', {
      cause: error,
    });
  }
}

export async function updateSettings(
  input: UpdateSettingsInput
): Promise<SchoolSettingsItem> {
  try {
    await ensureFoundationSeeded();
    const current = await getSettings();
    const updated = await db
      .update(schoolSettings)
      .set({
        schoolName: input.schoolName,
        schoolType: input.schoolType,
        academicSystem: input.academicSystem,
        gradingScale: input.gradingScale,
        currency: input.currency,
        address: input.address,
        phone: input.phone,
        email: input.email,
        updatedAt: new Date(),
      })
      .where(eq(schoolSettings.id, current.id))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateSettings:', error);
    throw new Error('Échec de la mise à jour des paramètres.', { cause: error });
  }
}
