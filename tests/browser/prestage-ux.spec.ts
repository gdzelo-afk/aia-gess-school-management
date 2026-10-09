import { test, expect } from '@playwright/test';
import { signIn } from './sign-in';

test('Login retains typing across window focus but clears password on intentional reload', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await page.goto('/login');
  const email = page.getByLabel('ელფოსტა', { exact: true });
  const password = page.getByLabel('პაროლი', { exact: true });
  await email.fill('fictional@demo.aia.local');
  await password.fill('local-unsaved-password');
  let documentLoads = 0;
  page.on('load', () => documentLoads++);
  await page.waitForTimeout(31000);
  const other = await context.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  // FocusManager's browser event, with no file change or document navigation.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  const session = page.waitForResponse((r) => r.url().endsWith('/api/me'));
  await page.bringToFront();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await session;
  await expect(email).toHaveValue('fictional@demo.aia.local');
  await expect(password).toHaveValue('local-unsaved-password');
  expect(documentLoads).toBe(0);
  await page.reload();
  await expect(password).toHaveValue('');
  const storage = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]));
  expect(storage).not.toContain('local-unsaved-password');
  await other.close();
});

test('history keeps the same academic context pending and clears it on student change; precise interaction states', async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login');
  await signIn(page, 'დირექტორი');
  await page.goto('/attendance?date=2026-09-25');
  await page.getByRole('tab', { name: 'ისტორია', exact: true }).click();
  const history = page.locator('.att-history-data');
  await expect(history).toBeVisible();
  await expect(page.locator('.att-month header')).toContainText('2026-09');
  await history.evaluate((e) => e.setAttribute('data-retained', 'yes'));
  const before = await history.boundingBox();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/attendance/range?**', async (route) => {
    await held;
    await route.continue();
  });
  const requested = page.waitForRequest((r) => r.url().includes('from=2026-10-01'));
  await page.getByRole('combobox', { name: 'თვე', exact: true }).click();
  await page.getByRole('option', { name: 'ოქტომბერი 2026', exact: true }).click();
  await requested;
  await expect(history).toHaveAttribute('data-retained', 'yes');
  await expect(history).toHaveAttribute('inert', '');
  await expect(page.locator('.att-month header')).toContainText('2026-09');
  await expect(page.locator('.skeleton-group')).toHaveCount(0);
  const pending = await history.boundingBox();
  expect(pending!.height).toBeCloseTo(before!.height, 0);
  expect(pending!.y).toBeCloseTo(before!.y, 0);
  await expect(page.locator('.att-history-pending')).toContainText('იტვირთება');
  release();
  await expect(page.locator('.att-month header')).toContainText('2026-10');
  await expect(history).not.toHaveAttribute('inert', '');
  await page.unroute('**/api/attendance/range?**');
  // Rapid uncached months cannot let an older response overwrite the last choice.
  const releases = new Map<string, () => void>();
  await page.route('**/api/attendance/range?**', async (route) => {
    const from = new URL(route.request().url()).searchParams.get('from')!;
    await new Promise<void>((resolve) => releases.set(from, resolve));
    await route.continue();
  });
  const dateControl = page.getByLabel('დასწრების თარიღი', { exact: true });
  await dateControl.fill('2026-11-01');
  await expect.poll(() => releases.has('2026-11-01')).toBe(true);
  await dateControl.fill('2026-12-01');
  await expect.poll(() => releases.has('2026-12-01')).toBe(true);
  await expect(page.locator('.att-month header')).toContainText('2026-10');
  const latestResponse = page.waitForResponse((r) => r.url().includes('from=2026-12-01'));
  releases.get('2026-12-01')!();
  await latestResponse;
  await expect(page.locator('.att-month header')).toContainText('2026-12');
  const obsoleteResponse = page.waitForResponse((r) => r.url().includes('from=2026-11-01'));
  releases.get('2026-11-01')!();
  await obsoleteResponse;
  await expect(page.locator('.att-month header')).toContainText('2026-12');
  await page.unroute('**/api/attendance/range?**');
  await dateControl.fill('2026-10-01');
  await expect(page.locator('.att-month header')).toContainText('2026-10');
  // A different pupil is NOT a safe date-only transition.
  let releaseChild!: () => void;
  const childHeld = new Promise<void>((resolve) => {
    releaseChild = resolve;
  });
  await page.route('**/api/attendance/range?**', async (route) => {
    await childHeld;
    await route.continue();
  });
  await page.getByRole('combobox', { name: 'მოსწავლე', exact: true }).click();
  await page.getByRole('option').nth(1).click();
  await expect(history).toHaveCount(0);
  await expect(page.locator('.skeleton-group')).toBeVisible();
  releaseChild();
  await expect(history).toBeVisible();
  await page.unroute('**/api/attendance/range?**');
  // Tabs remain text + indicator controls in both themes, with keyboard feedback.
  await page.goto('/academics');
  const courses = page.getByRole('button', { name: 'კურსები', exact: true });
  await expect(courses).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
    await courses.hover();
    await expect(courses).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await courses.focus();
    await expect(courses).toHaveCSS('text-decoration-line', 'underline');
    await page.screenshot({ path: `.local/prestage-ux/academics-${theme}.png` });
  }
  await page.goto('/gradebook');
  await page
    .getByRole('navigation', { name: 'ჟურნალის სამუშაო არეები' })
    .getByRole('button', { name: 'ჟურნალი', exact: true })
    .click();
  const course = page.getByRole('combobox', { name: 'საგნის კურსი', exact: true });
  await course.click();
  await page.getByRole('option', { name: /VIII ბ.*ქართული/ }).click();
  const cell = page.locator('[data-gb-cell]').first();
  await expect(cell).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
    await cell.hover();
    await expect(cell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await cell.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(cell).toHaveCSS('box-shadow', /inset/);
    await cell.click();
    await expect(page.locator('.gb-table td.is-selected').first()).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await page.screenshot({ path: `.local/prestage-ux/gradebook-${theme}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
