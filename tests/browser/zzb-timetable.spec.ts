import { test, expect, type Page } from '@playwright/test';
const fixture = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function reviewed(page: Page) {
  await page.getByRole('button', { name: 'გადახედვა', exact: true }).click();
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: 'დადასტურება და შენახვა', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}
async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: role, exact: true }).click();
  await expect(page.locator('.overview-heading')).toBeVisible();
}
test('timetable draft editing, conflicts, publication, requests and role-scoped mobile views', async ({
  page,
  browser,
}) => {
  test.setTimeout(300000);
  // The preceding suites share localhost's real authentication budget.
  await page.waitForTimeout(31000);
  await page.waitForTimeout(31000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page, 'დირექტორი');
  await page.goto('/timetable');
  await expect(page.locator('.tt-published-week')).toBeVisible();
  await page.getByRole('button', { name: 'სამუშაო ვერსია', exact: true }).click();
  await page.getByLabel('ვერსიის სახელი', { exact: true }).fill(`სატესტო კვირა ${Date.now()}`);
  await page.getByLabel('დაწყება', { exact: true }).fill('2026-10-26');
  await page.getByLabel('დასრულება (არ შედის)', { exact: true }).fill('2026-11-02');
  await page.getByLabel('არსებული ვერსიის კოპირება').selectOption(fixture(1600));
  await reviewed(page);
  const versionId = await page.getByLabel('განრიგის ვერსია', { exact: true }).inputValue();
  await expect(page.locator('.tt-grid')).toBeVisible();
  // Drag a whole section into its split-group period: real server validation must flag it.
  const source = page
    .locator('.tt-grid-row')
    .nth(0)
    .locator('.tt-slot')
    .nth(0)
    .locator('.tt-lesson');
  const destination = page.locator('.tt-grid-row').nth(2).locator('.tt-slot').nth(1);
  await source.dragTo(destination, { targetPosition: { x: 4, y: 4 } });
  await expect(page.getByRole('dialog')).toContainText('პოზიციას აქვს კონფლიქტები');
  await page.getByLabel('ვტოვებ ჩამოთვლილ კონფლიქტებს სამუშაო ვერსიაში გადასაწყვეტად').check();
  await reviewed(page);
  await expect(page.locator('.tt-conflict-summary')).toBeVisible();
  await page.locator('.tt-conflict-summary summary').click();
  await expect(page.locator('.tt-conflicts')).toContainText('ერთდროული');
  await page.screenshot({ path: 'test-results/timetable/conflict-light.png', fullPage: true });
  await page.getByRole('button', { name: 'გამოქვეყნება', exact: true }).click();
  await page.getByLabel('ვადასტურებ ზემოთ ჩამოთვლილ კონფლიქტებს').check();
  await page.getByRole('button', { name: 'გადახედვა', exact: true }).click();
  await expect(page.getByLabel('კონფლიქტების დაშვების დასაბუთება')).toBeFocused();
  await page.getByRole('button', { name: 'დახურვა', exact: true }).click();
  // Explicit keyboard/form alternative moves it back.
  await destination.locator('.tt-lesson').filter({ hasText: 'VII ა · ქართული' }).click();
  await page.getByLabel('კვირის დღე', { exact: true }).selectOption('1');
  await page.getByLabel('პერიოდი', { exact: true }).selectOption(fixture(1400));
  await reviewed(page);
  await expect(page.locator('.tt-conflict-summary')).toBeHidden();
  await page.getByRole('button', { name: 'გამოქვეყნება', exact: true }).click();
  await reviewed(page);
  await expect(page.getByRole('status')).toContainText('გამოქვეყნებულია');
  await page.getByLabel('განრიგის კვირა').fill('2026-10-26');
  await expect(page.locator('.tt-published-week .tt-lesson')).toHaveCount(13);
  await page.getByLabel('ოთახის ფილტრი').selectOption(fixture(1302));
  await expect(page.locator('.tt-published-week .tt-lesson')).toHaveCount(1);
  await page.getByLabel('ოთახის ფილტრი').selectOption('');
  await page.getByLabel('დღის ფილტრი').selectOption('1');
  await expect(page.locator('.tt-published-week .tt-day')).toHaveCount(1);
  await page.getByLabel('დღის ფილტრი').selectOption('');
  // Room and bell/group operational controls retain existing sources.
  await page.getByRole('button', { name: 'კონფიგურაცია', exact: true }).click();
  await page.getByRole('button', { name: 'ოთახის დამატება', exact: true }).click();
  await page.getByLabel('ოთახის ნომერი').fill(String(8000 + Math.floor(Math.random() * 1000)));
  await reviewed(page);
  // Teacher sees only own classes and requests a two-day absence, never edits master.
  const tc = await browser.newContext();
  const tp = await tc.newPage();
  await login(tp, 'მასწავლებელი');
  await tp.goto('/timetable');
  await expect(tp.getByRole('button', { name: 'სამუშაო ვერსია', exact: true })).toHaveCount(0);
  await tp.getByRole('button', { name: 'მიუწვდომლობა', exact: true }).click();
  await tp.getByRole('button', { name: 'დროებითი მიუწვდომლობის მოთხოვნა' }).click();
  await tp.getByLabel('დაწყება', { exact: true }).fill('2026-10-26');
  await tp.getByLabel('დასრულება (არ შედის)', { exact: true }).fill('2026-10-28');
  await tp.getByLabel('მიზეზი', { exact: true }).fill('სატესტო ორი დღით მიუწვდომლობა');
  await tp.getByRole('button', { name: 'დაკავშირებული გაკვეთილების ნახვა' }).click();
  await expect(tp.locator('.tt-affected')).toContainText('ქართული');
  await tp.getByRole('button', { name: 'მოთხოვნის გაგზავნა' }).click();
  await expect(tp.getByRole('dialog')).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: /მოთხოვნები ·/ }).click();
  await page
    .locator('.tt-request')
    .filter({ hasText: 'სატესტო ორი დღით მიუწვდომლობა' })
    .first()
    .click();
  // Admin adjusts every absence lesson from cancellation to an active substitute.
  const fields = page.locator('.tt-change-fields');
  await expect(fields.first()).toBeVisible();
  expect(await fields.count()).toBeGreaterThan(1);
  for (let i = 0; i < (await fields.count()); i++) {
    await fields.nth(i).getByLabel('გაკვეთილის გაუქმება').uncheck();
    await fields
      .nth(i)
      .getByLabel(`მასწავლებელი ${i + 1}`, { exact: true })
      .selectOption(fixture(1));
  }
  await page.getByLabel('მიზეზი / გადაწყვეტილება').fill('ორი დღის ჩანაცვლება შეთანხმებულია');
  await page.getByRole('button', { name: 'შემოწმება', exact: true }).click();
  await page.getByRole('button', { name: 'დადასტურება და შენახვა', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.tt-request').first()).toContainText('დამტკიცებული');
  await tp.reload();
  await tp.getByRole('button', { name: /მოთხოვნები ·/ }).click();
  await expect(tp.locator('.tt-request').first()).toContainText('დამტკიცებული');
  // Student and parent read the actual substitute; no access to admin drafts or unrelated children.
  const sc = await browser.newContext();
  const sp = await sc.newPage();
  await login(sp, 'მოსწავლე');
  await sp.goto('/timetable');
  await sp.getByLabel('განრიგის კვირა').fill('2026-10-26');
  await expect(sp.locator('.tt-published-week')).toContainText('თამარ ჯაფარიძე');
  await expect(sp.locator('.tt-published-week')).not.toContainText('VII ა · ჯგუფი 2');
  expect((await sp.request.get(`/api/timetable/drafts/${versionId}`)).status()).toBe(403);
  const gc = await browser.newContext();
  const gp = await gc.newPage();
  await login(gp, 'მშობელი');
  await gp.goto('/timetable');
  await gp.getByLabel('შვილის განრიგი').selectOption(fixture(201));
  await expect(gp.locator('.tt-published-week')).not.toContainText('VII ა · ქართული');
  expect(
    (
      await gp.request.get(`/api/timetable/week?from=2026-10-26&studentId=${fixture(203)}`)
    ).status(),
  ).toBe(404);
  // Visual matrix reuses sessions. Phones get a day view, not a squeezed weekly canvas.
  await page.goto('/timetable');
  await page.getByLabel('განრიგის კვირა').fill('2026-10-26');
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => localStorage.setItem('aia-theme', t), theme);
    await page.reload();
    await expect(page.locator('.tt-published-week')).toBeVisible();
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `test-results/timetable/week-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await sp.setViewportSize({ width: 390, height: 844 });
  await sp.getByRole('button', { name: 'სამ', exact: true }).click();
  await sp.screenshot({ path: 'test-results/timetable/student-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  await tc.close();
  await sc.close();
  await gc.close();
});
