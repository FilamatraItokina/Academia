import { describe, expect, it } from 'vitest';
import {
  bulkMarkAttendanceSchema,
  dailySummaryQuerySchema,
  updateAttendanceSchema,
} from '../src/server/modules/attendance/attendance.schema.ts';
import { computeAbsenteeismRate } from '../src/server/modules/attendance/attendance.service.ts';

describe('Module Temps Réel — Absentéisme & Absents du jour', () => {
  it('calcule avec précision le taux d’absentéisme en pourcentage à une décimale', () => {
    expect(computeAbsenteeismRate(0, 100)).toBe(0);
    expect(computeAbsenteeismRate(3, 0)).toBe(0);
    expect(computeAbsenteeismRate(3, 72)).toBe(4.2);
    expect(computeAbsenteeismRate(12, 120)).toBe(10);
  });

  it('valide les requêtes de suivi journalier et de saisie d’appel en masse', () => {
    expect(dailySummaryQuerySchema.safeParse({ date: '2026-11-26' }).success).toBe(true);
    expect(dailySummaryQuerySchema.safeParse({ date: '26/11/2026' }).success).toBe(false);

    const bulkValid = bulkMarkAttendanceSchema.safeParse({
      classId: 2,
      date: '2026-11-26',
      entries: [
        { studentId: 10, status: 'PRESENT', reason: '', isJustified: false },
        { studentId: 11, status: 'ABSENT', reason: 'Non signalé', isJustified: false },
      ],
    });
    expect(bulkValid.success).toBe(true);

    const bulkEmpty = bulkMarkAttendanceSchema.safeParse({
      classId: 2,
      date: '2026-11-26',
      entries: [],
    });
    expect(bulkEmpty.success).toBe(false);

    const justifyValid = updateAttendanceSchema.safeParse({
      status: 'EXCUSED',
      isJustified: true,
      reason: 'Certificat médical reçu',
    });
    expect(justifyValid.success).toBe(true);
  });
});
