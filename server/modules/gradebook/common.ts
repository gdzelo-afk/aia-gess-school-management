import type { Viewer } from '../../../shared/contracts.js';
import * as s from '../../db/schema.js';
import type { Transaction } from '../operations.js';

// Canonicalize request/value meaning without depending on PostgreSQL JSONB key order.
export function semantic(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(semantic).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${semantic(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export async function history(
  tx: Transaction,
  v: Viewer,
  kind: 'assessment' | 'writing' | 'recovery',
  objectId: string,
  revision: number,
  action: string,
  reason: string | null,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
) {
  await tx
    .insert(s.gradebookRevision)
    .values({ kind, objectId, revision, action, actorId: v.id, reason, before, after });
}
export async function notify(
  tx: Transaction,
  kind: string,
  id: string,
  revision: number,
  studentIds: string[],
) {
  for (const studentId of new Set(studentIds))
    await tx
      .insert(s.outboxJob)
      .values({
        kind: `gradebook.${kind}`,
        deduplicationKey: `gradebook:${kind}:${id}:${revision}:${studentId}`,
        payload: { objectId: id, revision, studentId },
      })
      .onConflictDoNothing({ target: s.outboxJob.deduplicationKey });
}
