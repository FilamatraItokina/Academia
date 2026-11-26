import { describe, expect, it } from 'vitest';
import { createSchoolEventSchema, updateSchoolEventSchema } from '../src/server/modules/events/event.schema.ts';
import {
  computeDaysUntil,
  resolveAllowedAudiences,
} from '../src/server/modules/events/event.service.ts';

describe('School Events & Dashboard Notifications', () => {
  it('validates createSchoolEventSchema with valid EXAM event', () => {
    const parsed = createSchoolEventSchema.safeParse({
      title: 'Baccalauréat blanc — Terminales',
      category: 'EXAM',
      description: 'Épreuves écrites sur 4 jours.',
      startDate: '2026-12-10',
      endDate: '2026-12-13',
      startTime: '08:00',
      location: 'Bâtiment A & Gymnase',
      targetAudience: 'ALL',
      academicYearId: 1,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects createSchoolEventSchema when endDate precedes startDate', () => {
    const parsed = createSchoolEventSchema.safeParse({
      title: 'Réunion parents-professeurs',
      category: 'MEETING',
      startDate: '2026-12-15',
      endDate: '2026-12-12',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid HH:MM startTime on create and update', () => {
    const createRes = createSchoolEventSchema.safeParse({
      title: 'Conseil pédagogique',
      category: 'MEETING',
      startDate: '2026-12-18',
      startTime: '25:99',
    });
    expect(createRes.success).toBe(false);

    const updateRes = updateSchoolEventSchema.safeParse({
      startTime: '8h30',
    });
    expect(updateRes.success).toBe(false);
  });

  it('computes exact UTC day countdowns without DST drift', () => {
    expect(computeDaysUntil('2026-11-26', '2026-11-26')).toBe(0);
    expect(computeDaysUntil('2026-11-27', '2026-11-26')).toBe(1);
    expect(computeDaysUntil('2026-12-03', '2026-11-26')).toBe(7);
    expect(computeDaysUntil('2026-11-24', '2026-11-26')).toBe(-2);
  });

  it('scopes visible target audiences strictly by user roles', () => {
    expect(resolveAllowedAudiences(['STUDENT'])).toEqual(['ALL', 'STUDENTS_PARENTS']);
    expect(resolveAllowedAudiences(['PARENT'])).toEqual(['ALL', 'STUDENTS_PARENTS']);
    expect(resolveAllowedAudiences(['TEACHER'])).toEqual(['ALL', 'STAFF', 'TEACHERS']);
    expect(resolveAllowedAudiences(['PRINCIPAL'])).toEqual([
      'ALL',
      'STAFF',
      'TEACHERS',
      'STUDENTS_PARENTS',
    ]);
    expect(resolveAllowedAudiences(['ADMIN'])).toEqual([
      'ALL',
      'STAFF',
      'TEACHERS',
      'STUDENTS_PARENTS',
    ]);
  });
});
