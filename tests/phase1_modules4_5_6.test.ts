import { describe, expect, it } from 'vitest';
import {
  createGuardianSchema,
  linkStudentSchema,
} from '../src/server/modules/guardians/guardian.schema.ts';
import {
  createEnrollmentSchema,
  createStudentSchema,
  importCsvStudentsSchema,
} from '../src/server/modules/students/student.schema.ts';
import {
  parseCsvLines,
  serializeStudentsCsv,
} from '../src/server/modules/students/student.service.ts';
import { createTeacherSchema } from '../src/server/modules/teachers/teacher.schema.ts';
import type { StudentItem } from '../src/server/modules/students/student.types.ts';

describe('Phase 1 — Modules 4, 5 & 6 (Élèves, Enseignants, Parents)', () => {
  it('valide la création d’un élève avec photo sécurisée et bloque les schémas dangereux', () => {
    const valid = createStudentSchema.safeParse({
      firstName: 'Camille',
      lastName: 'Durand',
      gender: 'F',
      dateOfBirth: '2011-04-12',
      photoUrl: 'data:image/jpeg;base64,AAAA',
    });
    expect(valid.success).toBe(true);

    const xssPhoto = createStudentSchema.safeParse({
      firstName: 'Camille',
      lastName: 'Durand',
      gender: 'F',
      dateOfBirth: '2011-04-12',
      photoUrl: 'javascript:alert(1)',
    });
    expect(xssPhoto.success).toBe(false);

    const htmlDataPhoto = createStudentSchema.safeParse({
      firstName: 'Camille',
      lastName: 'Durand',
      gender: 'F',
      dateOfBirth: '2011-04-12',
      photoUrl: 'data:text/html;base64,PHNjcmlwdD4=',
    });
    expect(htmlDataPhoto.success).toBe(false);
  });

  it('valide les inscriptions annuelles et l’import CSV', () => {
    const enrollOk = createEnrollmentSchema.safeParse({
      academicYearId: 1,
      classId: 3,
      notes: 'Passage en classe supérieure',
    });
    expect(enrollOk.success).toBe(true);

    const csvOk = importCsvStudentsSchema.safeParse({
      csvContent: 'firstName;lastName;gender;dateOfBirth\nA;B;F;2010-01-01',
    });
    expect(csvOk.success).toBe(true);
  });

  it('parse correctement les fichiers CSV avec séparateur point-virgule ou virgule', () => {
    const parsedSemicolon = parseCsvLines(
      'firstName;lastName;gender;dateOfBirth\n"Camille";Durand;F;2011-04-12\nLucas;Morel;M;2010-09-23'
    );
    expect(parsedSemicolon).toHaveLength(3);
    expect(parsedSemicolon[0]).toEqual(['firstName', 'lastName', 'gender', 'dateOfBirth']);
    expect(parsedSemicolon[1]).toEqual(['Camille', 'Durand', 'F', '2011-04-12']);
    expect(parsedSemicolon[2]).toEqual(['Lucas', 'Morel', 'M', '2010-09-23']);
  });

  it('neutralise les injections de formules Excel lors de l’export CSV', () => {
    const sampleStudent: StudentItem = {
      id: 1,
      matricule: 'ETU-2026-0001',
      userId: null,
      firstName: '=CMD()',
      lastName: '+SUM(A1:A2)',
      gender: 'M',
      dateOfBirth: '2010-05-01',
      placeOfBirth: 'Paris',
      nationality: 'Française',
      address: '@12 rue',
      phone: '-1234',
      email: 'test@exemple.fr',
      photoUrl: null,
      medicalNotes: '',
      isArchived: false,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentEnrollment: null,
    };

    const csv = serializeStudentsCsv([sampleStudent]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("\"'=CMD()\"");
    expect(csv).toContain("\"'+SUM(A1:A2)\"");
    expect(csv).toContain("\"'@12 rue\"");
    expect(csv).toContain("\"'-1234\"");
  });

  it('valide les fiches enseignants et responsables légaux', () => {
    const teacher = createTeacherSchema.safeParse({
      firstName: 'Hélène',
      lastName: 'Martin',
      email: 'helene.martin@academia.fr',
      specialty: 'Mathématiques',
      contractType: 'PERMANENT',
    });
    expect(teacher.success).toBe(true);

    const guardian = createGuardianSchema.safeParse({
      firstName: 'Marc',
      lastName: 'Durand',
      phone: '0612345678',
      email: 'marc.durand@exemple.fr',
    });
    expect(guardian.success).toBe(true);

    const link = linkStudentSchema.safeParse({
      studentId: 12,
      relationship: 'FATHER',
      isPrimaryContact: true,
      hasLegalCustody: true,
      canPickup: true,
    });
    expect(link.success).toBe(true);
  });
});
