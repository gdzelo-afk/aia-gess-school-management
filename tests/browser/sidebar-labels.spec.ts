import { test, expect } from '@playwright/test';
import { signIn } from './sign-in';

test('sidebar contains long Georgian labels without moving icons; tooltips fit the viewport', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await signIn(page, 'დირექტორი');
  await page.evaluate(() => document.fonts.ready);
  // Headless Chromium normally uses overlay scrollbars; desktop Linux may reserve 16px.
  await page.addStyleTag({
    content:
      '.sidebar { scrollbar-gutter: stable; scrollbar-width: auto; } .sidebar::-webkit-scrollbar { width: 16px; }',
  });
  const long =
    'მშობლებისა და მეურვეების სასკოლო თანამშრომლობისა და საგანმანათლებლო მხარდაჭერის საკოორდინაციო სივრცე';
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    if (await page.locator('.sidebar-collapsed').count())
      await page.getByRole('button', { name: 'ნავიგაციის გაშლა' }).click();
    await page.waitForTimeout(250);
    await page
      .locator('.sidebar .nav-label')
      .nth(3)
      .evaluate((e, text) => (e.textContent = text), long);
    expect(
      await page.locator('.sidebar .nav-link').evaluateAll((links) =>
        links.every((link) => {
          const box = link.getBoundingClientRect(),
            label = link.querySelector('.nav-label')!.getBoundingClientRect();
          return label.right <= box.right - 3 && label.bottom <= box.bottom && label.top >= box.top;
        }),
      ),
    ).toBe(true);
    const icons = () =>
      page
        .locator('.sidebar .nav-link svg')
        .evaluateAll((nodes) =>
          nodes.map((n) => ({ x: n.getBoundingClientRect().x, y: n.getBoundingClientRect().y })),
        );
    await page.locator('.sidebar').evaluate((e) => (e.scrollTop = 0));
    const initial = await icons();
    for (const name of ['ნავიგაციის შეკეცვა', 'ნავიგაციის გაშლა', 'ნავიგაციის შეკეცვა']) {
      await page.getByRole('button', { name, exact: true }).click();
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(30);
        expect(await icons()).toEqual(initial);
        expect(
          await page.locator('.sidebar .nav-link').evaluateAll((links) =>
            links.every((link) => {
              const box = link.getBoundingClientRect(),
                icon = link.querySelector('svg')!.getBoundingClientRect();
              return icon.left >= box.left && icon.right <= box.right;
            }),
          ),
        ).toBe(true);
      }
    }
    await page.getByRole('button', { name: 'ნავიგაციის გაშლა' }).click();
    await page.waitForTimeout(250);
    await page.locator('.sidebar').evaluate((e) => (e.scrollTop = e.scrollHeight));
    const scrolledIcons = await icons();
    const scrollTop = await page.locator('.sidebar').evaluate((e) => e.scrollTop);
    for (const name of ['ნავიგაციის შეკეცვა', 'ნავიგაციის გაშლა', 'ნავიგაციის შეკეცვა']) {
      await page.getByRole('button', { name, exact: true }).click();
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(30);
        expect(await icons()).toEqual(scrolledIcons);
        expect(await page.locator('.sidebar').evaluate((e) => e.scrollTop)).toBe(scrollTop);
      }
    }
    await page.setViewportSize({ width, height: 400 });
    const link = page.locator('.sidebar .nav-link').last();
    await link.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.mouse.move(500, 10);
    await link.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await tooltip.evaluate(
      (e, text) => (e.textContent = text + ' ' + text.replaceAll(' ', '')),
      long,
    );
    await page.waitForTimeout(200);
    const box = (await tooltip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.y).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(width - 8);
    expect(box.y + box.height).toBeLessThanOrEqual(392);
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
