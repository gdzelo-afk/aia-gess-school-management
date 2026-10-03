import { describe, expect, it } from 'vitest';
import {
  annualProjection,
  assessmentPolicy,
  category,
  currentAssessmentPolicy as policy,
  rationalMean,
  recoveryDeadline,
  resolveAssessmentPolicy,
  resultValue,
  semesterProjection,
  validateResult,
  type CalculationItem,
} from '../shared/gradebook/policy.js';
const item = (score: number, i = 0): CalculationItem => ({
  id: String(i),
  category: 'classwork',
  published: true,
  voided: false,
  value: { kind: 'numeric', score },
});
describe('confirmed assessment policy', () => {
  it.each([
    [1, 1],
    [4, 2],
    [5, 1],
  ] as const)(
    'grade %i term %i is formative, including configured pass/fail subjects',
    (grade, term) => {
      for (const mode of ['policy_default', 'pass_fail'] as const) {
        const p = resolveAssessmentPolicy(policy, grade, term, mode);
        expect(p.mode).toBe('formative_only');
        expect(() => validateResult(p, 'classwork', { kind: 'numeric', score: 8 })).toThrow();
        expect(() =>
          validateResult(p, 'summative', { kind: 'formative', text: 'პროგრესი მკაფიოა.' }),
        ).not.toThrow();
      }
    },
  );
  it.each([
    [5, 2],
    [6, 1],
    [7, 1],
    [12, 2],
  ] as const)('grade %i term %i supports numeric classwork/summative', (grade, term) => {
    const p = resolveAssessmentPolicy(policy, grade, term);
    expect(p.mode).toBe('numeric_10');
    expect(p.categories.includes('homework')).toBe(grade >= 7);
    for (const c of ['classwork', 'summative'] as const)
      expect(validateResult(p, c, { kind: 'numeric', score: 1 })).toEqual({
        kind: 'numeric',
        score: 1,
      });
  });
  it('rejects homework numerically below VII and arbitrary categories on the server-shared boundary', () => {
    expect(() =>
      validateResult(resolveAssessmentPolicy(policy, 6, 2), 'homework', {
        kind: 'numeric',
        score: 10,
      }),
    ).toThrow();
    expect(category.safeParse('teacher_weighted_category').success).toBe(false);
    expect(assessmentPolicy.safeParse({ ...policy, weights: { homework: 2 } }).success).toBe(false);
  });
  it.each([0, 11, 7.5, NaN, Infinity])('rejects invalid numeric score %s', (score) => {
    expect(resultValue.safeParse({ kind: 'numeric', score }).success).toBe(false);
  });
  it('accepts scale boundaries and explicit pass/fail without subject-name inference', () => {
    for (const score of [1, 10])
      expect(resultValue.parse({ kind: 'numeric', score })).toEqual({ kind: 'numeric', score });
    const p = resolveAssessmentPolicy(policy, 7, 1, 'pass_fail');
    expect(validateResult(p, 'summative', { kind: 'pass_fail', passed: false })).toEqual({
      kind: 'pass_fail',
      passed: false,
    });
    expect(() => validateResult(p, 'summative', { kind: 'numeric', score: 10 })).toThrow();
    expect(() =>
      validateResult(resolveAssessmentPolicy(policy, 7, 1), 'summative', {
        kind: 'pass_fail',
        passed: true,
      }),
    ).toThrow();
  });
  it('keeps non-grade states separate, with recovery confined to summatives', () => {
    const p = resolveAssessmentPolicy(policy, 7, 1);
    expect(() =>
      validateResult(p, 'classwork', { kind: 'state', state: 'recovery_required' }),
    ).toThrow();
    expect(validateResult(p, 'summative', { kind: 'state', state: 'recovery_required' })).toEqual({
      kind: 'state',
      state: 'recovery_required',
    });
    expect(resultValue.safeParse({ kind: 'state', state: 'absent', score: 0 }).success).toBe(false);
  });
  it('adds calendar dates across month/year/leap boundaries, independently of the machine timezone', () => {
    expect(recoveryDeadline('2026-09-28')).toBe('2026-10-08');
    expect(recoveryDeadline('2026-12-28')).toBe('2027-01-07');
    expect(recoveryDeadline('2028-02-23')).toBe('2028-03-04');
    expect(() => recoveryDeadline('2026-02-30')).toThrow();
  });
});
describe('provisional calculations, never official finals', () => {
  it.each([
    [615, 100, 6],
    [749, 100, 7],
    [85, 10, 9],
    [7499, 1000, 7],
  ] as const)('rounds %i/%i half-up without double rounding', (sum, n, expected) => {
    expect(rationalMean(sum, n).rounded).toBe(expected);
  });
  it('retains exact rational meaning alongside a readable decimal', () => {
    expect(rationalMean(22, 3)).toEqual({
      numerator: 22,
      denominator: 3,
      display: '7.33',
      rounded: 7,
    });
    expect(rationalMean(7499, 1000)).toEqual({
      numerator: 7499,
      denominator: 1000,
      display: '7.50',
      rounded: 7,
    });
  });
  it('weights every published numeric mark equally, never its category', () => {
    const x = semesterProjection(
      [
        item(4, 1),
        { ...item(10, 2), category: 'summative' },
        { ...item(8, 3), category: 'homework' },
      ],
      1,
    );
    expect(x.mean).toEqual(rationalMean(22, 3));
    expect(x.incomplete).toBe(false);
    expect(x.official).toBe(false);
  });
  it('does not include drafts, voids or ordinary missing marks in the denominator', () => {
    const x = semesterProjection(
      [
        item(8),
        { ...item(1, 1), published: false },
        { ...item(1, 2), voided: true },
        { ...item(1, 3), value: { kind: 'state', state: 'absent' } },
      ],
      0,
    );
    expect(x.scoreCount).toBe(1);
    expect(x.mean?.rounded).toBe(8);
    expect(x.unresolved).toBe(1);
  });
  it('keeps unresolved required summatives incomplete without a penalty grade or denominator', () => {
    const pending: CalculationItem = {
      ...item(1, 1),
      category: 'summative',
      value: { kind: 'state', state: 'recovery_required' },
    };
    const before = semesterProjection([item(8), pending], 1);
    expect(before.missingRequired).toBe(1);
    expect(before.mean?.denominator).toBe(1);
    expect(before.incomplete).toBe(true);
    const after = semesterProjection(
      [item(8), { ...pending, value: { kind: 'numeric', score: 10 } }],
      1,
    );
    expect(after.scoreCount).toBe(2);
    expect(after.mean?.rounded).toBe(9);
    expect(after.incomplete).toBe(false);
    expect(() => semesterProjection([pending, pending], 1)).toThrow();
  });
  it('exposes unknown/unconfigured requirements and empty journals explicitly', () => {
    expect(semesterProjection([item(8)], null)).toMatchObject({
      incomplete: true,
      missingRequired: null,
    });
    expect(semesterProjection([], 0)).toMatchObject({ mean: null, incomplete: true });
  });
  it('uses rounded semester projections for a non-official annual projection; Grade V uses only II', () => {
    const first = semesterProjection([item(6), item(7, 1)], 0),
      second = semesterProjection([item(8), item(9, 1)], 0);
    expect(annualProjection(policy, 7, first, second)).toEqual({
      mean: rationalMean(16, 2),
      incomplete: false,
      official: false,
      excludesExams: true,
    });
    expect(annualProjection(policy, 5, null, second).mean?.rounded).toBe(9);
    expect(annualProjection(policy, 7, null, second)).toMatchObject({
      mean: null,
      incomplete: true,
    });
  });
});
it('does not count a formative comment as completion of a required numeric summative', () => {
  const result = semesterProjection(
    [
      {
        id: 'comment',
        category: 'summative',
        published: true,
        voided: false,
        value: { kind: 'formative', text: 'კარგი წინსვლაა' },
      },
    ],
    1,
    'numeric_10',
  );
  expect(result.completedSummatives).toBe(0);
  expect(result.missingRequired).toBe(1);
  expect(result.mean).toBeNull();
});
