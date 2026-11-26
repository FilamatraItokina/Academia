import { describe, expect, it } from 'vitest';
import { buildReportCardPdfBuffer } from '../src/server/modules/report-cards/report-card.pdf.ts';
import { computeHonorMention } from '../src/server/modules/report-cards/report-card.service.ts';
import type { ReportCardDetail } from '../src/server/modules/report-cards/report-card.types.ts';

describe('Phase 2 Module 9 — Bulletins scolaires & PDFKit', () => {
  it('computes French secondary honor mentions accurately', () => {
    expect(computeHonorMention(16.5)).toBe('Félicitations du conseil');
    expect(computeHonorMention(14.2)).toBe('Tableau d’honneur');
    expect(computeHonorMention(12.0)).toBe('Encouragements');
    expect(computeHonorMention(10.5)).toBe('');
    expect(computeHonorMention(7.4)).toBe('Mise en garde travail');
    expect(computeHonorMention(null)).toBe('');
  });

  it('generates a valid PDFKit buffer starting with %PDF-', async () => {
    const mockDetail: ReportCardDetail = {
      id: 1,
      studentId: 10,
      studentMatricule: 'ELV-2026-0001',
      studentFirstName: 'Camille',
      studentLastName: 'Martin',
      studentDateOfBirth: '2009-05-14',
      classId: 3,
      className: 'Terminale S1',
      levelName: 'Terminale',
      termId: 1,
      termName: '1er Trimestre',
      academicYearId: 1,
      academicYearName: '2026-2027',
      academicYearStatus: 'ACTIVE',
      generalAverage: 15.25,
      classAverage: 12.8,
      rank: 2,
      totalStudents: 28,
      absencesCount: 1,
      latesCount: 0,
      honorMention: 'Tableau d’honneur',
      councilRemark: 'Excellent trimestre, travail sérieux et régulier.',
      status: 'VALIDATED',
      validatedAt: '2026-12-20T10:00:00.000Z',
      createdAt: '2026-12-19T10:00:00.000Z',
      updatedAt: '2026-12-20T10:00:00.000Z',
      subjects: [
        {
          id: 1,
          classSubjectId: 11,
          subjectCode: 'MATH',
          subjectName: 'Mathématiques',
          teacherFullName: 'Dupont Jean',
          coefficient: 7,
          subjectAverage: 16.0,
          classSubjectAverage: 12.4,
          teacherRemark: 'Très bonne maîtrise du raisonnement.',
        },
        {
          id: 2,
          classSubjectId: 12,
          subjectCode: 'PHYS',
          subjectName: 'Physique-Chimie',
          teacherFullName: 'Morel Sophie',
          coefficient: 6,
          subjectAverage: 14.38,
          classSubjectAverage: 13.1,
          teacherRemark: 'Participation active en travaux pratiques.',
        },
      ],
    };

    const buffer = await buildReportCardPdfBuffer(mockDetail, {
      schoolName: 'Lycée Académia',
      address: '12 Avenue de la République',
      phone: '01 40 00 00 00',
      email: 'contact@academia.edu',
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
