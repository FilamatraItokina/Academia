import { describe, expect, it } from 'vitest';
import {
  createAssessmentSchema,
  saveBulkScoresSchema,
} from '../src/server/modules/grades/grade.schema.ts';
import {
  assignClassRanks,
  computeWeightedGeneralAverage,
  computeWeightedSubjectAverage,
  normalizeScoreToScale,
} from '../src/server/modules/grades/grade.service.ts';

describe('Phase 2 Module 8 — Évaluations, Notes & Moyennes', () => {
  it('validates assessment creation and bulk scores schema', () => {
    const validAssessment = createAssessmentSchema.safeParse({
      classSubjectId: 1,
      termId: 2,
      title: 'Composition de Mathématiques',
      assessmentType: 'EXAM',
      assessmentDate: '2026-12-14',
      maxScore: 20,
      weight: 2,
      isPublished: false,
    });
    expect(validAssessment.success).toBe(true);

    const invalidScores = saveBulkScoresSchema.safeParse({
      entries: [{ studentId: 1, score: -2, isAbsent: false, comment: '' }],
    });
    expect(invalidScores.success).toBe(false);
  });

  it('normalizes scores on custom scales to /20 cleanly', () => {
    expect(normalizeScoreToScale(15, 20)).toBe(15);
    expect(normalizeScoreToScale(8.5, 10)).toBe(17);
    expect(normalizeScoreToScale(75, 100)).toBe(15);
  });

  it('computes weighted subject average while ignoring absent entries', () => {
    const avg = computeWeightedSubjectAverage([
      { score: 16, maxScore: 20, weight: 2, isAbsent: false }, // 16 * 2 = 32
      { score: 7, maxScore: 10, weight: 1, isAbsent: false },  // 14 * 1 = 14
      { score: null, maxScore: 20, weight: 1, isAbsent: true }, // ignored
    ]);
    // (32 + 14) / 3 = 15.33
    expect(avg).toBe(15.33);

    expect(
      computeWeightedSubjectAverage([{ score: null, maxScore: 20, weight: 1, isAbsent: true }])
    ).toBeNull();
  });

  it('computes weighted general average across subjects and assigns ties-aware class ranks', () => {
    const gAvg = computeWeightedGeneralAverage([
      { coefficient: 5, averageOn20: 14 }, // 70
      { coefficient: 3, averageOn20: 12 }, // 36
      { coefficient: 2, averageOn20: null }, // ignored
    ]);
    // 106 / 8 = 13.25
    expect(gAvg).toBe(13.25);

    const ranked = assignClassRanks([
      { studentId: 1, generalAverageOn20: 13.5 },
      { studentId: 2, generalAverageOn20: 16.0 },
      { studentId: 3, generalAverageOn20: 13.5 },
      { studentId: 4, generalAverageOn20: null },
    ]);

    expect(ranked.find((r) => r.studentId === 2)?.rank).toBe(1);
    expect(ranked.find((r) => r.studentId === 1)?.rank).toBe(2);
    expect(ranked.find((r) => r.studentId === 3)?.rank).toBe(2);
    expect(ranked.find((r) => r.studentId === 4)?.rank).toBeNull();
  });
});
