import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import * as s from '../../db/schema.js';
import type { Viewer } from '../../../shared/contracts.js';
import { fail } from '../operations.js';
import { schoolReader } from './context.js';
import { journal, recoveryQueue } from './reads.js';

// Operational counts disclose no private draft title, roster, comment or score.
export async function academicOverview(
  v: Viewer,
  yearId: string,
  semesterId: string,
  now = new Date(),
) {
  if (!schoolReader(v)) fail('საერთო მიმოხილვა მიუწვდომელია.', 'FORBIDDEN', 403);
  const view = await journal(v, yearId, semesterId, undefined, undefined, now);
  const counts = await db
    .select({
      offeringIds: s.gradebookAssessment.offeringIds,
      status: s.gradebookAssessment.status,
    })
    .from(s.gradebookAssessment)
    .where(
      and(
        eq(s.gradebookAssessment.yearId, yearId),
        eq(s.gradebookAssessment.semesterId, semesterId),
      ),
    );
  const requests = await recoveryQueue(v, yearId, now);
  return {
    courses: view.offerings.map((o) => ({
      ...o,
      draft: counts.filter((a) => a.offeringIds.includes(o.id) && a.status === 'draft').length,
      published: counts.filter((a) => a.offeringIds.includes(o.id) && a.status === 'published')
        .length,
      unresolvedSummatives: view.items
        .filter(
          (a) =>
            a.offeringIds.includes(o.id) && a.status === 'published' && a.category === 'summative',
        )
        .reduce(
          (sum, a) =>
            sum +
            a.entries.filter((e) => e.value.kind === 'state' && e.value.state !== 'exempt').length,
          0,
        ),
    })),
    pendingRequests: requests.filter((r) =>
      ['submitted', 'follow_up', 'review'].includes(r.status),
    ),
    draft: counts.filter((a) => a.status === 'draft').length,
    published: counts.filter((a) => a.status === 'published').length,
  };
}

export async function gradebookPulse(v: Viewer, now = new Date()) {
  const { gradebookYears } = await import('./setup.js');
  const years = await gradebookYears(v),
    year = years.find((y) => y.status === 'active');
  if (!year) return null;
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const term = year.semesters.find((s) => s.startsOn <= date && date < s.endsOn);
  if (!term) return null;
  if (schoolReader(v)) {
    const overview = await academicOverview(v, year.id, term.id, now);
    return {
      draft: overview.draft,
      pending: overview.pendingRequests.length,
      published: overview.published,
      school: true,
    };
  }
  const view = await journal(v, year.id, term.id, undefined, undefined, now);
  const recovery = await recoveryQueue(v, year.id, now);
  return {
    draft: view.items.filter((i) => i.status === 'draft').length,
    pending: recovery.filter((r) =>
      ['submitted', 'follow_up', 'review', 'approved'].includes(r.status),
    ).length,
    published: view.items.filter((i) => i.status === 'published').length,
    school: false,
  };
}
