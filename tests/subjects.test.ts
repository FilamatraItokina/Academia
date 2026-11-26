import { describe, expect, it } from 'vitest';
import {
  assignClassSubjectSchema,
  createSubjectSchema,
} from '../src/server/modules/subjects/subject.schema.ts';
import { computeCurriculumSummary } from '../src/server/modules/subjects/subject.service.ts';
import type { ClassSubjectItem } from '../src/server/modules/subjects/subject.types.ts';

describe('Phase 2 Module 7 — Matières, Coefficients & Affectations', () => {
  it('normalizes subject code to uppercase and validates coefficient bounds', () => {
    const valid = createSubjectSchema.safeParse({
      code: 'math_sp',
      name: 'Mathématiques Spécialité',
      department: 'Sciences',
      defaultCoefficient: 6,
      description: 'Programme de terminale',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.code).toBe('MATH_SP');
    }

    const invalidCoeff = createSubjectSchema.safeParse({
      code: 'EPS',
      name: 'Éducation Physique',
      defaultCoefficient: 0,
    });
    expect(invalidCoeff.success).toBe(false);
  });

  it('validates class subject assignment schema', () => {
    const valid = assignClassSubjectSchema.safeParse({
      subjectId: 3,
      teacherId: 12,
      coefficient: 4.5,
      weeklyHours: 5.5,
      isOptional: false,
    });
    expect(valid.success).toBe(true);

    const invalidHours = assignClassSubjectSchema.safeParse({
      subjectId: 3,
      coefficient: 2,
      weeklyHours: 55,
    });
    expect(invalidHours.success).toBe(false);
  });

  it('computes curriculum summary totals accurately', () => {
    const mockItems: ClassSubjectItem[] = [
      {
        id: 1,
        classId: 10,
        className: 'Terminale S1',
        subjectId: 1,
        subjectCode: 'MATH',
        subjectName: 'Mathématiques',
        subjectDepartment: 'Sciences',
        subjectIsActive: true,
        teacherId: 4,
        teacherEmployeeCode: 'ENS-2026-0001',
        teacherFullName: 'Dupont Jean',
        teacherSpecialty: 'Mathématiques',
        coefficient: 7,
        weeklyHours: 6,
        isOptional: false,
        createdAt: '2026-11-26T00:00:00Z',
        updatedAt: '2026-11-26T00:00:00Z',
      },
      {
        id: 2,
        classId: 10,
        className: 'Terminale S1',
        subjectId: 2,
        subjectCode: 'LAT',
        subjectName: 'Latin',
        subjectDepartment: 'Lettres & Langues',
        subjectIsActive: true,
        teacherId: null,
        teacherEmployeeCode: null,
        teacherFullName: null,
        teacherSpecialty: null,
        coefficient: 1.5,
        weeklyHours: 2,
        isOptional: true,
        createdAt: '2026-11-26T00:00:00Z',
        updatedAt: '2026-11-26T00:00:00Z',
      },
    ];

    const summary = computeCurriculumSummary(mockItems);
    expect(summary).toEqual({
      subjectCount: 2,
      mandatoryCount: 1,
      optionalCount: 1,
      totalCoefficient: 8.5,
      totalWeeklyHours: 8,
      assignedTeachersCount: 1,
      unassignedTeachersCount: 1,
    });
  });
});
