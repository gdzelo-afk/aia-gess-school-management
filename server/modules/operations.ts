import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditEvent } from '../db/schema.js';
import type { Capability, Viewer } from '../../shared/contracts.js';
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class DomainError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function fail(message: string, code = 'CONFLICT', status = 409): never {
  throw new DomainError(status, code, message);
}
export function requireCapability(viewer: Viewer, cap: Capability) {
  if (!viewer.capabilities.includes(cap)) fail('ამ მოქმედების უფლება არ გაქვთ.', 'FORBIDDEN', 403);
}
export function found<T>(value: T | undefined): T {
  if (!value) fail('ჩანაწერი ვერ მოიძებნა.', 'NOT_FOUND', 404);
  return value;
}
export function expectVersion(actual: number, expected: number | undefined) {
  if (actual !== expected)
    fail('ჩანაწერი შეიცვალა. განაახლეთ გვერდი და სცადეთ ხელახლა.', 'STALE_VERSION');
}
export function validInterval(start: string, end: string | null) {
  if (end !== null && end <= start)
    fail('დასრულების თარიღი დაწყების შემდეგ უნდა იყოს.', 'INTERVAL', 400);
}
export function schoolToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export const schoolDateSql = sql`(current_timestamp at time zone 'Asia/Tbilisi')::date`;
export async function audit(
  tx: Transaction,
  viewer: Viewer,
  requestId: string,
  action: string,
  objectType: string,
  objectId: string,
  metadata: Record<string, unknown> = {},
) {
  await tx
    .insert(auditEvent)
    .values({ actorUserId: viewer.id, requestId, action, objectType, objectId, metadata });
}
// A single school has infrequent administrative writes. One transaction-scoped row lock
// serializes cross-aggregate changes; reads remain concurrent. No external lock service.
export async function administration<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from administration_lock where id=1 for update`);
    return work(tx);
  });
}
