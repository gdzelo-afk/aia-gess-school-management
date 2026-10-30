import { expect, test, type Page } from '@playwright/test';
import type { GradebookEntry } from '../../shared/gradebook';
import { signIn } from './sign-in';
import { choose } from './choose';

const courseUrl = '/gradebook?course=00000000-0000-4000-8000-000000016000';
async function openJournal(page: Page) {
  // Use the isolated browser runtime and respect its real authentication budget.
  const health = await page.request.get('/api/health');
  if (health.status() === 429 || Number(health.headers()['x-ratelimit-remaining']) < 100)
    await page.waitForTimeout(
      (Number(health.headers()['retry-after'] ?? health.headers()['x-ratelimit-reset'] ?? 60) + 1) *
        1000,
    );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await signIn(page, 'მასწავლებელი');
  await page.goto(courseUrl);
  await expect(page.locator('.gb-table tbody tr')).toHaveCount(20);
}

test('Gradebook groups assessments, keeps pupil context in compact details and supports a short mobile sheet', async ({
  page,
}, testInfo) => {
  test.setTimeout(150000);
  await openJournal(page);

  const table = page.locator('.gb-table');
  const rows = table.locator('tbody tr');
  const panel = page.getByRole('complementary', { name: 'შეფასების დეტალები', exact: true });
  const layout = page.locator('.gb-layout');
  await expect(rows).toHaveCount(20);
  for (const category of ['საკლასო', 'საშინაო', 'შემაჯამებელი'])
    await expect(table.locator('.gb-category-heading').filter({ hasText: category })).toHaveCount(
      1,
    );
  for (const heading of await table.locator('.gb-date-row button').all()) {
    // Compact dates retain the full assessment name and state for assistive technology.
    const fullTitle = await heading.getAttribute('title');
    expect(fullTitle).toBeTruthy();
    await expect(heading).toHaveAttribute('aria-label', fullTitle!);
    await expect(heading).toHaveText(/^\d{2}\s*\/\s*\d{2}$/);
  }

  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
    const cell = rows.nth(9).locator('[data-gb-cell]').first();
    const previousCell = rows.nth(8).locator('[data-gb-cell]').first();
    const selectedPupil = (await cell.getAttribute('aria-label'))!.split(' · ')[0]!;
    await cell.focus();
    await cell.press('ArrowUp');
    await expect(previousCell).toBeFocused();
    await previousCell.press('ArrowDown');
    await expect(cell).toBeFocused();
    await cell.press('Enter');

    await expect(panel).toHaveClass(/is-single-pupil/);
    await expect(panel.locator('.gb-entry-row')).toHaveCount(1);
    const selectedRow = panel.locator('.gb-entry-row.is-current');
    await expect(selectedRow).toHaveCount(1);
    await expect(selectedRow).toContainText(selectedPupil);
    await expect(selectedRow).toHaveAttribute('data-student-id', /.+/);
    await expect(selectedRow).toBeFocused();
    await expect(selectedRow).toBeInViewport();
    await expect(page.locator('.gb-detail-slot .gb-detail-content')).toBeVisible();
    expect((await panel.boundingBox())!.width).toBeLessThanOrEqual(301);
    await expect
      .poll(() =>
        page
          .locator('.gb-scroll')
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      )
      .toBe(true);
    expect(
      await rows
        .locator('th > span:last-child')
        .evaluateAll((elements) =>
          elements.every((element) => element.scrollWidth <= element.clientWidth + 1),
        ),
    ).toBe(true);
    await expect
      .poll(() =>
        selectedRow.evaluate((row) => {
          const inspector = row.closest('.gb-inspector')!;
          const bounds = row.getBoundingClientRect();
          const header = inspector.querySelector('header')!.getBoundingClientRect();
          return bounds.top >= header.bottom - 1;
        }),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`gradebook-compact-${theme}.png`) });
    await panel.getByRole('button', { name: 'მთელი შეფასების ნახვა', exact: true }).click();
    await expect(panel.locator('.gb-entry-row')).toHaveCount(20);
    await expect(panel).not.toHaveClass(/is-single-pupil/);
    await expect(panel.locator(`.gb-entry-row`).filter({ hasText: selectedPupil })).toBeFocused();
    await panel.getByRole('button', { name: 'ჟურნალში დაბრუნება', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(cell).toBeFocused();
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const cell = rows.nth(9).locator('[data-gb-cell]').first();
  await cell.click();
  await expect(panel.locator('.gb-entry-row.is-current')).toBeFocused();
  expect(
    await layout.evaluate((element) =>
      getComputedStyle(element)
        .transitionDuration.split(',')
        .every((duration) => parseFloat(duration) === 0),
    ),
  ).toBe(true);
  await expect(page.locator('.gb-detail-content')).toHaveCSS('animation-name', 'none');
  await panel.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(cell).toBeFocused();

  await page.setViewportSize({ width: 390, height: 560 });
  const mobileDraft = page
    .locator('.gb-mobile-assessments > button')
    .filter({ hasText: 'მონახაზი' })
    .first();
  await mobileDraft.click();
  const sheet = page.getByRole('dialog', { name: 'შეფასების დეტალები', exact: true });
  await expect(sheet).toBeVisible();
  await expect(panel.locator('.gb-entry-row')).toHaveCount(20);
  expect((await sheet.boundingBox())!.height).toBeLessThanOrEqual(561);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel
    .getByRole('button', { name: 'მონახაზის შენახვა', exact: true })
    .click({ trial: true });
  await panel.getByRole('button', { name: 'გამოქვეყნება', exact: true }).click({ trial: true });
  const back = panel.getByRole('button', { name: 'ჟურნალში დაბრუნება', exact: true });
  await back.focus();
  await back.press('Shift+Tab');
  expect(await sheet.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('gradebook-short-mobile-sheet.png') });
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(mobileDraft).toBeFocused();

  // The formative course gets its own non-score grouping, not a numeric category label.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/gradebook?course=00000000-0000-4000-8000-000000016100');
  await expect(table.locator('.gb-category-heading')).toHaveText([
    'განმავითარებელი · ქულის გარეშე',
  ]);
});

test('compact Gradebook drafts retain whole-roster edits and distinguish same-day assessments', async ({
  page,
}) => {
  test.setTimeout(150000);
  await openJournal(page);
  const panel = page.getByRole('complementary', { name: 'შეფასების დეტალები', exact: true });
  const firstTitle = 'სატესტო შეფასება · ერთი დღის პირველი';
  const secondTitle = 'სატესტო შეფასება · ერთი დღის მეორე';
  async function createDraft(title: string) {
    await page.getByRole('button', { name: 'შეფასება', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'ახალი შეფასება', exact: true });
    await dialog.getByLabel('დასახელება', { exact: true }).fill(title);
    await dialog.getByLabel('თარიღი', { exact: true }).fill('2026-09-30');
    await dialog.getByRole('button', { name: 'მონახაზის შექმნა', exact: true }).click();
    await expect(panel.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(panel.locator('.gb-entry-row')).toHaveCount(20);
    const id = new URL(page.url()).searchParams.get('assessment')!;
    await panel.getByRole('button', { name: 'ჟურნალში დაბრუნება', exact: true }).click();
    await expect(panel).toHaveCount(0);
    return id;
  }
  const assessmentId = await createDraft(firstTitle);
  const before = (await (
    await page.request.get(`/api/gradebook/assessments/${assessmentId}`)
  ).json()) as { entries: GradebookEntry[] };
  await createDraft(secondTitle);
  const headers = page.locator('.gb-date-row button');
  const sameDay = headers.filter({
    has: page.locator('.gb-assessment-date', { hasText: '30 / 09' }),
  });
  await expect(sameDay).toHaveCount(2);
  await expect(sameDay.locator('.gb-date-sequence')).toHaveText(['1', '2']);
  // The full accessible title is on the button, while visible context stays compact.
  for (const heading of await sameDay.all()) {
    const label = await heading.getAttribute('aria-label');
    expect(label).toContain('სატესტო შეფასება');
    await expect(heading).toHaveAttribute('title', label!);
  }
  const firstAssessmentHeader = page.locator('.gb-date-row').getByRole('button', {
    name: new RegExp(`^${firstTitle}`),
  });
  const secondAssessmentHeader = page.locator('.gb-date-row').getByRole('button', {
    name: new RegExp(`^${secondTitle}`),
  });
  const column = await firstAssessmentHeader.evaluate((button) =>
    Array.from(button.closest('tr')!.querySelectorAll('button')).indexOf(
      button as HTMLButtonElement,
    ),
  );
  const rows = page.locator('.gb-table tbody tr');
  const pupilA = rows.nth(0).locator('[data-gb-cell]').nth(column);
  const pupilB = rows.nth(1).locator('[data-gb-cell]').nth(column);
  await pupilA.click();
  await expect(panel.locator('.gb-entry-row')).toHaveCount(1);
  await expect(panel.getByRole('heading', { name: firstTitle, exact: true })).toBeVisible();
  const pupilAId = (await panel.locator('.gb-entry-row').getAttribute('data-student-id'))!;
  await choose(panel.locator('.gb-result-control [role="combobox"]'), 'numeric');
  await panel.getByRole('spinbutton').fill('9');
  await expect(panel.getByRole('button', { name: 'გამოქვეყნება', exact: true })).toHaveCount(0);
  await pupilB.click();
  const pupilBId = (await panel.locator('.gb-entry-row').getAttribute('data-student-id'))!;
  expect(pupilBId).not.toBe(pupilAId);
  await choose(panel.locator('.gb-result-control [role="combobox"]'), 'numeric');
  await panel.getByRole('spinbutton').fill('7');
  await pupilA.click();
  await expect(panel.getByRole('spinbutton')).toHaveValue('9');
  await page.setViewportSize({ width: 390, height: 560 });
  await expect(page.getByRole('dialog', { name: 'შეფასების დეტალები', exact: true })).toBeVisible();
  await expect(panel.getByRole('spinbutton')).toHaveValue('9');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(panel.getByRole('spinbutton')).toHaveValue('9');
  page.once('dialog', (dialog) => dialog.dismiss());
  await secondAssessmentHeader.click();
  expect(new URL(page.url()).searchParams.get('assessment')).toBe(assessmentId);
  await expect(panel.getByRole('spinbutton')).toHaveValue('9');
  page.once('dialog', (dialog) => dialog.dismiss());
  await panel.getByRole('button', { name: 'ჟურნალში დაბრუნება', exact: true }).click();
  await expect(panel.locator('.gb-entry-row')).toHaveAttribute('data-student-id', pupilAId);
  await panel.getByRole('button', { name: 'მთელი შეფასების ნახვა', exact: true }).click();
  await expect(panel.locator('.gb-entry-row')).toHaveCount(20);
  await expect(
    panel.locator(`[data-student-id="${pupilAId}"]`).getByRole('spinbutton'),
  ).toHaveValue('9');
  await expect(
    panel.locator(`[data-student-id="${pupilBId}"]`).getByRole('spinbutton'),
  ).toHaveValue('7');
  const expectedEntries = before.entries.map((entry) => ({
    ...entry,
    value:
      entry.studentId === pupilAId
        ? { kind: 'numeric', score: 9 }
        : entry.studentId === pupilBId
          ? { kind: 'numeric', score: 7 }
          : entry.value,
  }));
  const saved = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/gradebook/actions') &&
      request.method() === 'POST' &&
      request.postDataJSON().action === 'assessment.save',
  );
  await panel.getByRole('button', { name: 'მონახაზის შენახვა', exact: true }).click();
  const payload = (await saved).postDataJSON() as { entries: GradebookEntry[] };
  expect(payload.entries).toEqual(expectedEntries);
  expect(new Set(payload.entries.map((entry) => entry.studentId)).size).toBe(20);
  await expect(panel.getByText('შეუნახავია', { exact: true })).toHaveCount(0);
  const stored = await (
    await page.request.get(`/api/gradebook/assessments/${assessmentId}`)
  ).json();
  expect(stored.entries).toEqual(expectedEntries);
  await panel.getByRole('button', { name: 'გამოქვეყნება', exact: true }).click();
  await expect(panel.getByRole('region', { name: 'გამოქვეყნების გადახედვა' })).toContainText(
    '2 შეფასებული · 18 ჯერ შესავსები',
  );
  await pupilA.click();
  await expect(panel.getByRole('region', { name: 'გამოქვეყნების გადახედვა' })).toHaveCount(0);
  await panel.getByRole('button', { name: 'მთელი შეფასების ნახვა', exact: true }).click();
  await expect(panel.getByRole('region', { name: 'გამოქვეყნების გადახედვა' })).toContainText(
    '2 შეფასებული · 18 ჯერ შესავსები',
  );
  await panel.getByRole('button', { name: 'დადასტურება და გამოქვეყნება', exact: true }).click();
  await expect(panel.getByText('გამოქვეყნებული', { exact: true })).toBeVisible();
  const published = await (
    await page.request.get(`/api/gradebook/assessments/${assessmentId}`)
  ).json();
  expect(published.status).toBe('published');
  expect(published.entries).toEqual(expectedEntries);
});

test('Gradebook details retain their frame through loading and finish or cancel their exit coherently', async ({
  page,
}) => {
  test.setTimeout(150000);
  await openJournal(page);
  const panel = page.getByRole('complementary', { name: 'შეფასების დეტალები', exact: true });
  const cell = page.locator('[data-gb-cell="0:0"]');
  await cell.click();
  await expect(panel.locator('.gb-entry-row')).toHaveCount(1);
  const frame = page.locator('.gb-detail-content');
  await frame.evaluate((element) => element.setAttribute('data-test-retained', 'yes'));
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/gradebook/assessments/*', async (route) => {
    await held;
    await route.continue();
  });
  const nextAssessment = page.locator('.gb-date-row button').nth(1);
  await nextAssessment.click();
  await expect(panel.locator('.skeleton-group')).toBeVisible();
  await expect(frame).toHaveAttribute('data-test-retained', 'yes');
  await expect(frame).toHaveCount(1);
  await expect(panel.locator('.gb-entry-row')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'შესწორება', exact: true })).toHaveCount(0);
  release();
  await expect(panel.locator('.gb-entry-row')).toHaveCount(20);
  await expect(frame).toHaveAttribute('data-test-retained', 'yes');
  await page.unroute('**/api/gradebook/assessments/*');

  // Sample actual animation frames: the outgoing content survives until its exit finishes.
  const outgoing = await panel.locator('.gb-back').evaluate(async (button) => {
    (button as HTMLButtonElement).click();
    const samples: { closing: boolean; content: boolean }[] = [];
    const started = performance.now();
    while (performance.now() - started < 600) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      samples.push({
        closing: !!document.querySelector('.gradebook-workspace.is-detail-closing'),
        content: !!document.querySelector('.gb-detail-content .gb-inspector'),
      });
    }
    return samples;
  });
  expect(outgoing.some((sample) => sample.closing && sample.content)).toBe(true);
  expect(outgoing.at(-1)).toEqual({ closing: false, content: false });
  await expect(panel).toHaveCount(0);
  await expect(nextAssessment).toBeFocused();

  await cell.click();
  await expect(panel.locator('.gb-entry-row')).toHaveCount(1);
  const reopened = await panel.locator('.gb-back').evaluate(async (button) => {
    (button as HTMLButtonElement).click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const wasClosing = !!document.querySelector('.gradebook-workspace.is-detail-closing');
    document.querySelector<HTMLButtonElement>('[data-gb-cell="1:0"]')!.click();
    const started = performance.now();
    while (performance.now() - started < 500)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return {
      wasClosing,
      stillOpen: !!document.querySelector('.gb-inspector'),
      stillClosing: !!document.querySelector('.gradebook-workspace.is-detail-closing'),
    };
  });
  expect(reopened).toEqual({ wasClosing: true, stillOpen: true, stillClosing: false });
  await expect(panel.locator('.gb-entry-row')).toHaveCount(1);
  const selectedPupil = (await page
    .locator('[data-gb-cell="1:0"]')
    .getAttribute('aria-label'))!.split(' · ')[0]!;
  await expect(panel.locator('.gb-entry-row')).toContainText(selectedPupil);
  await panel.getByRole('button', { name: 'ჟურნალში დაბრუნება', exact: true }).click();
  await expect(panel).toHaveCount(0);
});
