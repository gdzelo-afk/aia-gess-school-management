import { z } from 'zod';
import { dateOnly } from './stage1a.js';
import { occurrenceId } from './attendance.js';
import { assessmentPolicy, category, gradingMode, resultValue } from './gradebook/policy.js';
export * from './gradebook/policy.js';
const reason = z.string().trim().min(5).max(1000);
const revision = z.number().int().min(0);
export const gradebookScope = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('offering'), offeringId: z.uuid() }).strict(),
  z.object({ kind: z.literal('group'), versionId: z.uuid(), groupId: z.uuid() }).strict(),
]);
export type GradebookScope = z.infer<typeof gradebookScope>;
export const gradebookEntry = z.object({ studentId: z.uuid(), value: resultValue }).strict();
export type GradebookEntry = z.infer<typeof gradebookEntry>;
export interface AcademicPupilSnapshot {
  studentId: string;
  name: string;
  number: string;
  sectionId: string;
  section: string;
  offeringIds: string[];
}
export interface AcademicPolicySnapshot {
  policyId: string;
  offeringId: string;
  gradeLevel: number;
  semesterOrdinal: 1 | 2;
  mode: z.infer<typeof gradingMode>;
  categories: z.infer<typeof category>[];
  policy: z.infer<typeof assessmentPolicy>;
  requiredSummatives: number | null;
  requirementBasis: 'configured' | 'demo';
}
export const gradebookCommand = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('assessment.reconcile'),
      commandId: z.uuid(),
      id: z.uuid(),
      revision,
      rosterToken: z.string().length(64),
    })
    .strict(),
  z
    .object({
      action: z.literal('policy.revise'),
      commandId: z.uuid(),
      offeringId: z.uuid(),
      semesterId: z.uuid(),
      revision,
      policy: assessmentPolicy,
      offeringMode: z.enum(['policy_default', 'formative_only', 'pass_fail']),
      requiredSummatives: z.number().int().min(0).max(100).nullable(),
      requirementBasis: z.enum(['configured', 'demo']),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('criteria.revise'),
      commandId: z.uuid(),
      subjectId: z.uuid(),
      yearId: z.uuid(),
      revision,
      text: z.string().trim().min(5).max(12000),
      fileId: z.uuid().nullable(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('assessment.create'),
      commandId: z.uuid(),
      semesterId: z.uuid(),
      scope: gradebookScope,
      date: dateOnly,
      title: z.string().trim().min(2).max(180),
      category,
      formative: z.boolean().default(false),
      description: z.string().trim().max(2000).default(''),
      activity: z.string().trim().max(100).default(''),
      criteriaId: z.uuid().nullable(),
      occurrenceId: occurrenceId.nullable().default(null),
    })
    .strict(),
  z
    .object({
      action: z.literal('assessment.save'),
      commandId: z.uuid(),
      id: z.uuid(),
      revision,
      rosterToken: z.string().length(64),
      entries: z.array(gradebookEntry).min(1).max(400),
    })
    .strict(),
  z
    .object({
      action: z.literal('assessment.publish'),
      commandId: z.uuid(),
      id: z.uuid(),
      revision,
      rosterToken: z.string().length(64),
    })
    .strict(),
  z
    .object({
      action: z.literal('assessment.correct'),
      commandId: z.uuid(),
      id: z.uuid(),
      revision,
      entries: z.array(gradebookEntry).min(1).max(400),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('assessment.describe'),
      commandId: z.uuid(),
      id: z.uuid(),
      revision,
      title: z.string().trim().min(2).max(180),
      description: z.string().trim().max(2000),
      activity: z.string().trim().max(100),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('assessment.void'),
      commandId: z.uuid(),
      id: z.uuid(),
      revision,
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('recovery.request'),
      commandId: z.uuid(),
      assessmentId: z.uuid(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('recovery.decide'),
      commandId: z.uuid(),
      id: z.uuid(),
      revision,
      status: z.enum(['follow_up', 'review', 'approved', 'denied']),
      physicalFollowUp: z.boolean(),
      extendedUntil: dateOnly.nullable(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal('writing.save'),
      commandId: z.uuid(),
      id: z.uuid().optional(),
      revision,
      kind: z.enum(['narrative', 'guardian_note', 'homeroom_note']),
      yearId: z.uuid(),
      offeringId: z.uuid().nullable(),
      studentId: z.uuid(),
      body: z.string().trim().min(5).max(5000),
      reason: reason.optional(),
    })
    .strict(),
  z
    .object({ action: z.literal('writing.publish'), commandId: z.uuid(), id: z.uuid(), revision })
    .strict(),
]);
export type GradebookCommand = z.infer<typeof gradebookCommand>;
