import { describe, expect, it } from 'vitest';
import {
  createAcademicYearSchema,
  createTermSchema,
} from '../src/server/modules/academic-years/academic-year.schema.ts';
import {
  generatePeriodsForYear,
  validateTermDates,
} from '../src/server/modules/academic-years/academic-year.service.ts';
import {
  createClassSchema,
  createClassroomSchema,
  createLevelSchema,
  createSeriesSchema,
} from '../src/server/modules/classes/class.schema.ts';

describe('Modules 2 & 3 — Années scolaires, Périodes, Niveaux & Classes', () => {
  it('génère 3 trimestres ordonnés inclus dans les bornes de l’année scolaire', () => {
    const periods = generatePeriodsForYear('2026-09-01', '2027-06-30', 'TRIMESTER');
    expect(periods).toHaveLength(3);
    expect(periods[0].name).toBe('Trimestre 1');
    expect(periods[0].isCurrent).toBe(true);
    expect(periods[1].isCurrent).toBe(false);
    expect(periods[0].startDate).toBe('2026-09-01');
    expect(periods[2].endDate).toBe('2027-06-30');
  });

  it('génère 2 semestres ordonnés', () => {
    const periods = generatePeriodsForYear('2026-09-01', '2027-06-30', 'SEMESTER');
    expect(periods).toHaveLength(2);
    expect(periods[0].name).toBe('Semestre 1');
    expect(periods[1].name).toBe('Semestre 2');
  });

  it('rejette une période hors des bornes de l’année scolaire ou qui chevauche une période existante', () => {
    const year = { startDate: '2026-09-01', endDate: '2027-06-30' };
    const existing = [
      {
        id: 1,
        academicYearId: 1,
        name: 'Trimestre 1',
        termType: 'TRIMESTER' as const,
        orderIndex: 1,
        startDate: '2026-09-01',
        endDate: '2026-12-15',
        isCurrent: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    expect(() =>
      validateTermDates(year, { startDate: '2026-08-15', endDate: '2026-10-01' }, existing)
    ).toThrow();

    expect(() =>
      validateTermDates(year, { startDate: '2026-12-10', endDate: '2027-03-01' }, existing)
    ).toThrow();

    expect(() =>
      validateTermDates(year, { startDate: '2026-12-16', endDate: '2027-03-20' }, existing)
    ).not.toThrow();
  });

  it('valide les schémas Zod des années scolaires et des périodes', () => {
    expect(
      createAcademicYearSchema.safeParse({
        name: '2026-2027',
        startDate: '2026-09-01',
        endDate: '2027-06-30',
        autoGeneratePeriods: 'TRIMESTER',
      }).success
    ).toBe(true);

    expect(
      createAcademicYearSchema.safeParse({
        name: '2026-2027',
        startDate: '2027-06-30',
        endDate: '2026-09-01',
      }).success
    ).toBe(false);

    expect(
      createTermSchema.safeParse({
        name: 'Trimestre 1',
        termType: 'TRIMESTER',
        orderIndex: 1,
        startDate: '2026-09-01',
        endDate: '2026-12-18',
      }).success
    ).toBe(true);
  });

  it('valide les schémas Zod de niveaux, séries, salles et classes', () => {
    const level = createLevelSchema.safeParse({
      code: '6e',
      name: 'Sixième (6e)',
      cycle: 'COLLEGE',
      orderIndex: 1,
    });
    expect(level.success).toBe(true);
    if (level.success) expect(level.data.code).toBe('6E');

    expect(
      createSeriesSchema.safeParse({
        code: 's',
        name: 'Scientifique (S)',
      }).success
    ).toBe(true);

    expect(
      createClassroomSchema.safeParse({
        code: 's-101',
        name: 'Salle 101',
        capacity: 35,
        roomType: 'CLASSROOM',
      }).success
    ).toBe(true);

    expect(
      createClassSchema.safeParse({
        name: '6e A',
        academicYearId: 1,
        levelId: 1,
        capacity: 32,
      }).success
    ).toBe(true);
  });
});
