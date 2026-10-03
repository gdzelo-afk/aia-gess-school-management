import { criteriaVisible } from './setup.js';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import * as s from '../../db/schema.js';
import { db } from '../../db/client.js';
import { config } from '../../config.js';
import type { Viewer } from '../../../shared/contracts.js';
import { administration, audit, fail, found, requireCapability } from '../operations.js';
import { requireReader } from './context.js';

export const criteriaFileLimit = 3 * 1024 * 1024;
// Deliberately PDF-only in this slice. Always downloaded, never rendered as active application content.
export function validateCriteriaFile(input: Buffer, name: string, contentType: string) {
  if (contentType !== 'application/pdf' || !/\.pdf$/i.test(name))
    fail('დასაშვებია მხოლოდ PDF დოკუმენტი.', 'FILE_TYPE', 400);
  if (input.length < 16 || input.length > criteriaFileLimit)
    fail('ფაილის ზომა 3 მბ-ს არ უნდა აღემატებოდეს.', 'FILE_SIZE', 400);
  if (
    !/^%PDF-1\.[0-7]|^%PDF-2\.0/.test(input.subarray(0, 8).toString('ascii')) ||
    !/%%EOF\s*$/.test(input.subarray(-1024).toString('ascii'))
  )
    fail('PDF დოკუმენტის ფორმატი არასწორია.', 'FILE_CONTENT', 400);
  const safeName = name
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}/\\<>:"|?*]/gu, '_')
    .replace(/^\.+/, '')
    .slice(0, 160);
  return safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName || 'criteria'}.pdf`;
}
const directory = () => resolve(config.PRIVATE_STORAGE_DIR, 'criteria');
export async function uploadCriteria(
  v: Viewer,
  requestId: string,
  input: Buffer,
  name: string,
  contentType: string,
) {
  requireCapability(v, 'gradebook:policy');
  if (!v.personId) fail('იდენტობა მიუწვდომელია.', 'FORBIDDEN', 403);
  const originalName = validateCriteriaFile(input, name, contentType);
  const id = randomUUID(),
    objectKey = `criteria/${id}.pdf`,
    path = join(directory(), `${id}.pdf`);
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  await writeFile(path, input, { flag: 'wx', mode: 0o600 });
  try {
    await administration(async (tx) => {
      await tx.insert(s.fileMetadata).values({
        id,
        ownerPersonId: v.personId!,
        objectKey,
        originalName,
        contentType: 'application/pdf',
        sizeBytes: input.length,
        status: 'ready',
      });
      await audit(tx, v, requestId, 'gradebook.criteria.upload', 'file', id, {
        sizeBytes: input.length,
      });
    });
  } catch (error) {
    await unlink(path);
    throw error;
  }
  return { id, name: originalName, sizeBytes: input.length };
}
export async function downloadCriteria(v: Viewer, requestId: string, id: string, now = new Date()) {
  requireReader(v);
  const file = await db.transaction(async (tx) => {
    const file = found(
      (
        await tx
          .select()
          .from(s.fileMetadata)
          .where(and(eq(s.fileMetadata.id, id), eq(s.fileMetadata.status, 'ready')))
      )[0],
    );
    if (file.objectKey !== `criteria/${file.id}.pdf`) fail('ფაილი ვერ მოიძებნა.', 'NOT_FOUND', 404);
    let allowed = v.capabilities.includes('gradebook:policy') && file.ownerPersonId === v.personId;
    const criteria = await tx
      .select()
      .from(s.assessmentCriteriaVersion)
      .where(eq(s.assessmentCriteriaVersion.fileId, file.id));
    for (const c of criteria)
      if (await criteriaVisible(tx, v, c, now)) {
        allowed = true;
        break;
      }
    if (!allowed) fail('ფაილი ვერ მოიძებნა.', 'NOT_FOUND', 404);
    await audit(tx, v, requestId, 'gradebook.criteria.download', 'file', file.id);
    return file;
  });
  const data = await readFile(join(directory(), `${file.id}.pdf`));
  if (data.length !== file.sizeBytes) fail('ფაილი დროებით მიუწვდომელია.', 'FILE_STORAGE', 503);
  return { file, data };
}
