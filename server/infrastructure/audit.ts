import { db } from '../db/client.js';
import { auditEvent } from '../db/schema.js';
export async function recordAudit(event: typeof auditEvent.$inferInsert) {
  await db.insert(auditEvent).values(event);
}
