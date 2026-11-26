import { describe, expect, it } from 'vitest';
import {
  buildClassEnrollmentChartData,
  buildTeacherDistributionData,
  computeCapacitySummary,
} from '../src/client/features/dashboard/dashboardMetrics.ts';
import type { ClassItem, TeacherItem } from '../src/client/types/api.ts';

function makeClass(partial: Partial<ClassItem>): ClassItem {
  return {
    id: 1,
    name: '6e A',
    academicYearId: 10,
    academicYearName: '2026-2027',
    academicYearStatus: 'ACTIVE',
    levelId: 1,
    levelCode: '6E',
    levelName: '6e',
    levelCycle: 'COLLEGE',
    seriesId: null,
    seriesCode: null,
    seriesName: null,
    classroomId: null,
    classroomCode: null,
    classroomName: null,
    classroomCapacity: null,
    capacity: 35,
    enrolledCount: 28,
    isArchived: false,
    ...partial,
  };
}

function makeTeacher(partial: Partial<TeacherItem>): TeacherItem {
  return {
    id: 1,
    employeeCode: 'ENS-2026-0001',
    userId: null,
    firstName: 'Claire',
    lastName: 'Dupont',
    email: 'claire@academia.fr',
    phone: '',
    specialty: 'Mathématiques',
    qualification: 'Agrégée',
    contractType: 'PERMANENT',
    hireDate: '2024-09-01',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('Dashboard KPI Metrics (Effectifs par classe & Répartition enseignants)', () => {
  it('agrège les effectifs inscrits, places libres et taux d’occupation par classe', () => {
    const classes: ClassItem[] = [
      makeClass({ id: 1, name: '6e A', academicYearId: 10, enrolledCount: 28, capacity: 35 }),
      makeClass({ id: 2, name: '5e B', academicYearId: 10, enrolledCount: 30, capacity: 30 }),
      makeClass({ id: 3, name: '4e A (archivée)', academicYearId: 10, enrolledCount: 10, capacity: 30, isArchived: true }),
      makeClass({ id: 4, name: '6e A (2025)', academicYearId: 9, enrolledCount: 32, capacity: 35 }),
    ];

    const points = buildClassEnrollmentChartData(classes, 10);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ name: '6e A', inscrits: 28, placesLibres: 7, occupancyPct: 80 });
    expect(points[1]).toMatchObject({ name: '5e B', inscrits: 30, placesLibres: 0, occupancyPct: 100 });

    const summary = computeCapacitySummary(points);
    expect(summary).toEqual({
      totalEnrolled: 58,
      totalCapacity: 65,
      occupancyPct: 89,
      classCount: 2,
    });
  });

  it('calcule la répartition des enseignants par spécialité et par type de contrat', () => {
    const teachers: TeacherItem[] = [
      makeTeacher({ id: 1, specialty: 'Mathématiques', contractType: 'PERMANENT' }),
      makeTeacher({ id: 2, specialty: 'Mathématiques', contractType: 'CONTRACT' }),
      makeTeacher({ id: 3, specialty: 'Lettres modernes', contractType: 'PERMANENT' }),
      makeTeacher({ id: 4, specialty: 'Physique-Chimie', contractType: 'PART_TIME' }),
      makeTeacher({ id: 5, specialty: 'Histoire', contractType: 'PERMANENT', isActive: false }),
    ];

    const bySpecialty = buildTeacherDistributionData(teachers, 'specialty', true);
    expect(bySpecialty[0]).toMatchObject({ label: 'Mathématiques', count: 2, percentage: 50 });
    expect(bySpecialty).toHaveLength(3);

    const byContract = buildTeacherDistributionData(teachers, 'contract', true);
    expect(byContract[0]).toMatchObject({ label: 'Titulaires', count: 2, percentage: 50 });
    expect(byContract).toHaveLength(3);
  });
});
