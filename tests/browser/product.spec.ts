import { test, expect, type Page } from '@playwright/test';

async function openLogin(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'თქვენი სამუშაო სივრცე.' })).toBeVisible();
}
async function enter(page: Page, role = 'დირექტორი') {
  await openLogin(page);
  await page.getByRole('button', { name: role, exact: true }).click();
  await expect(page.locator('.overview-heading')).toBeVisible();
}

test('canonical login keeps validation, password controls and real authentication', async ({
  page,
}) => {
  await openLogin(page);
  await page.getByRole('button', { name: 'სივრცეში შესვლა', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('სწორი ელფოსტა');
  await page.getByLabel('ელფოსტა', { exact: true }).fill('director@demo.aia.local');
  await page.getByLabel('პაროლი', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'პაროლის ჩვენება', exact: true }).click();
  await expect(page.getByLabel('პაროლი', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'პაროლის დამალვა', exact: true }).click();
  await page.getByRole('button', { name: 'სივრცეში შესვლა', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('შესვლა ვერ მოხერხდა');
  await page.getByLabel('ელფოსტის დამახსოვრება', { exact: true }).check();
  await page.getByLabel('პაროლი', { exact: true }).fill('AiaDemo-2026!');
  const signedIn = page.waitForResponse(
    (r) => r.url().includes('/api/auth/sign-in/email') && r.ok(),
  );
  await page.getByRole('button', { name: 'სივრცეში შესვლა', exact: true }).click();
  await signedIn;
  await expect(page.locator('.overview-signals')).toContainText('44');
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('aia-login-email'))).toBe(
    'director@demo.aia.local',
  );
  const session = await page.context().cookies();
  await page.context().clearCookies();
  await openLogin(page);
  await expect(page.getByLabel('ელფოსტა', { exact: true })).toHaveValue('director@demo.aia.local');
  await expect(page.getByLabel('პაროლი', { exact: true })).toHaveValue('');
  await expect(page.getByRole('link', { name: 'პაროლის აღდგენა' })).toHaveAttribute(
    'href',
    '/recovery',
  );
  await page.getByLabel('ელფოსტის დამახსოვრება').uncheck();
  expect(await page.evaluate(() => localStorage.getItem('aia-login-email'))).toBeNull();
  await page.context().addCookies(session);
  await page.goto('/');
  await page.reload();
  await expect(page.locator('.overview-heading')).toBeVisible();
});

test('command palette supports Meta/Ctrl K, keyboard traversal, scope, focus return and recovery', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await enter(page, 'მშობელი');
  const trigger = page.locator('.search-trigger');
  await trigger.click();
  const search = page.getByRole('combobox', { name: 'საძიებო სიტყვა' });
  await expect(search).toBeFocused();
  const firstSelection = await page.getByRole('option', { selected: true }).getAttribute('id');
  await search.press('ArrowDown');
  const nextSelection = await page.getByRole('option', { selected: true }).getAttribute('id');
  expect(nextSelection).not.toBe(firstSelection);
  await expect(search).toHaveAttribute('aria-activedescendant', nextSelection!);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Meta+k');
  await expect(search).toBeFocused();
  await search.fill('მაისურაძე');
  await expect(page.getByRole('option')).toHaveCount(2);
  await expect(page.locator('.command-preview')).toContainText('VII');
  await search.fill('ბერიძე');
  await expect(page.getByRole('heading', { name: 'შედეგი ვერ მოიძებნა' })).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(0);
  await page.route('**/api/foundation/students?**', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'test outage' } }),
    });
  });
  await search.fill('ელენე');
  await expect(page.getByRole('alert')).toContainText('ძიება ვერ შესრულდა');
  await page.unroute('**/api/foundation/students?**');
  await page.getByRole('button', { name: 'ხელახლა ცდა' }).click();
  await expect(page.getByRole('option')).toHaveCount(1);
  await search.press('Enter');
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'ელენე მაისურაძე', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await expect(search).toBeFocused();
  await search.fill('მუქი რეჟიმი');
  await search.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('login uses Tbilisi date and restrained pausable/reduced motion', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T19:59:30Z') });
  await openLogin(page);
  await expect(page.locator('.entrance-date time')).toHaveAttribute('datetime', '2026-09-27');
  await page.clock.fastForward(60_000);
  await expect(page.locator('.entrance-date time')).toHaveAttribute('datetime', '2026-09-28');
  await page.getByRole('button', { name: 'ანიმაციის შეჩერება' }).click();
  expect(
    await page
      .locator('.entrance-lens')
      .first()
      .evaluate((el) => getComputedStyle(el).animationPlayState),
  ).toBe('paused');
  await page.getByRole('button', { name: 'ანიმაციის გაგრძელება' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('.entrance-lens')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
  ).toBeLessThan(0.01);
  await page.getByRole('button', { name: 'დირექტორი', exact: true }).click();
  await expect(page.locator('.presence-cursor')).toBeVisible();
  expect(
    await page
      .locator('.presence-cursor')
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
  ).toBeLessThan(0.01);
});

test('main login, dashboard and command render in both themes at desktop, tablet and mobile sizes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let sessionCookies: import('@playwright/test').Cookie[] | undefined;
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const theme of ['light', 'dark']) {
      await openLogin(page);
      await page.evaluate((t) => localStorage.setItem('aia-theme', t), theme);
      await page.reload();
      await expect(page.locator('.product-login')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `test-results/product/login-${width}-${theme}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (sessionCookies) {
        await page.context().addCookies(sessionCookies);
        await page.goto('/');
      } else {
        await page.getByRole('button', { name: 'დირექტორი', exact: true }).click();
      }
      await expect(page.locator('.overview-signals')).toBeVisible();
      sessionCookies ??= await page.context().cookies();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `test-results/product/dashboard-${width}-${theme}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.keyboard.press('Control+k');
      await expect(page.getByRole('combobox')).toBeFocused();
      await page.screenshot({
        path: `test-results/product/command-${width}-${theme}.png`,
        animations: 'disabled',
      });
      const box = await page.getByRole('dialog').boundingBox();
      expect(box!.width).toBeLessThanOrEqual(width);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      await page.keyboard.press('Escape');
      // Reuse one real session across the visual matrix; logout is covered by shell workflows.
      await page.context().clearCookies();
      await page.goto('/login');
      await expect(page.locator('.product-login')).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test('login distinguishes throttling from invalid credentials without weakening authentication', async ({
  page,
}) => {
  await openLogin(page);
  await page.route('**/api/auth/sign-in/email', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'limited' } }),
    }),
  );
  await page.getByRole('button', { name: 'დირექტორი', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('მოიცადეთ ერთი წუთი');
  await expect(page.locator('.product-login')).toBeVisible();
});

test('dashboard live date, today route and persistent accessible icon rail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install({ time: new Date('2026-10-02T07:59:30Z') });
  await enter(page);
  await expect(page.locator('.greeting')).toContainText('დილა მშვიდობისა, თამარ.');
  await expect(page.locator('.overview-heading time')).toHaveText('პარასკევი, 2 ოქტომბერი');
  await page.clock.fastForward(60_000);
  await expect(page.locator('.greeting')).toContainText('შუადღე მშვიდობისა, თამარ.');
  await expect(page.locator('.overview-context, .overview-date')).toHaveCount(0);
  const nav = page.locator('.sidebar nav');
  const count = await nav.getByRole('link').count();
  const toggle = page.getByRole('button', { name: 'ნავიგაციის შეკეცვა' });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'ნავიგაციის გაშლა' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(await nav.getByRole('link').count()).toBe(count);
  const students = nav.getByRole('link', { name: 'მოსწავლეები', exact: true });
  await page.setViewportSize({ width: 1440, height: 540 });
  await nav.getByRole('link', { name: 'პარამეტრები', exact: true }).scrollIntoViewIfNeeded();
  await nav.getByRole('link', { name: 'პარამეტრები', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  const tip = await page.getByRole('tooltip').boundingBox();
  expect(tip!.y + tip!.height).toBeLessThanOrEqual(540);
  await page.setViewportSize({ width: 1440, height: 900 });
  await students.scrollIntoViewIfNeeded();
  await students.focus();
  await expect(page.getByRole('tooltip')).toHaveText('მოსწავლეები');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await students.press('Enter');
  await expect(students).toHaveAttribute('aria-current', 'page');
  await page.reload();
  await expect(page.locator('.product-shell')).toHaveClass(/sidebar-collapsed/);
  await nav.getByRole('link', { name: 'მიმოხილვა', exact: true }).click();
  await page.getByRole('link', { name: 'დღის განრიგი', exact: true }).click();
  await expect(page).toHaveURL(/timetable\?date=2026-10-02/);
  await expect(page.locator('.tt-matrix')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 667 });
  await expect(page.getByRole('button', { name: 'პარ', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'მენიუს გახსნა' }).click();
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'მოსწავლეები', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'მენიუს გახსნა' })).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'ნავიგაციის გაშლა' }).click();
  await expect(page.locator('.sidebar-term')).toBeVisible();
});
