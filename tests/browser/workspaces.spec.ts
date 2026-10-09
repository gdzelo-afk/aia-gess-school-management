import { choose } from './choose';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';

// Reuse this file's real director session; layout checks do not need another sign-in.
let directorCookies: Awaited<ReturnType<BrowserContext['cookies']>> | undefined;

// Full-page viewport/theme sweeps may exhaust the real global API budget on fast CI.
// Respect server-provided reset timing instead of weakening production throttling.
async function navigate(page: Page, path: string) {
  const budget = await page.request.get('/api/health');
  const remaining = Number(budget.headers()['x-ratelimit-remaining'] ?? 180);
  if (budget.status() === 429 || remaining < 25) {
    const retry = Number(
      budget.headers()['retry-after'] ?? budget.headers()['x-ratelimit-reset'] ?? 60,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(Math.max(retry, 1), 60) * 1000 + 100),
    );
  }
  await page.goto(path);
}

async function signInDirector(page: Page) {
  // A preceding file can legitimately consume the shared sign-in budget.
  // Retry only a real 429, after its server-provided reset, through the same UI.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-in/email'));
    await page.getByRole('button', { name: 'დირექტორი', exact: true }).click();
    const result = await response;
    if (result.status() !== 429) {
      expect(result.ok()).toBe(true);
      return;
    }
    const seconds = Number(
      result.headers()['x-retry-after'] ?? result.headers()['retry-after'] ?? 60,
    );
    await page.waitForTimeout((seconds + 1) * 1000);
  }
  throw new Error('Sign-in remained throttled after its reset');
}

test('selected system covers functional students and honest academic/message workspaces', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await navigate(page, '/');
  await signInDirector(page);
  await expect(page.locator('.overview-heading')).toBeVisible();
  directorCookies = await page.context().cookies();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.greeting')).toHaveCSS('font-family', /AIA Mersad/);
  expect(
    await page.evaluate(() => document.fonts.check('36px "AIA Mersad"', 'გამარჯობა, თამარ.')),
  ).toBe(true);
  // Sample the browser's actual animation frames: fixed geometry, binary opacity, 1s cycles.
  const caret = await page.locator('.presence-cursor').evaluate((el) => {
    const animation = el.getAnimations()[0]!;
    animation.pause();
    const frames = [0, 250, 500, 750, 1000, 9500, 10000].map((time) => {
      animation.currentTime = time;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        opacity: style.opacity,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        transform: style.transform,
      };
    });
    animation.play();
    return frames;
  });
  expect(caret.map((frame) => frame.opacity)).toEqual(['1', '1', '0', '0', '1', '0', '1']);
  expect(
    new Set(
      caret.map(({ x, y, width, height, transform }) =>
        JSON.stringify({ x, y, width, height, transform }),
      ),
    ).size,
  ).toBe(1);
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => localStorage.setItem('aia-theme', value), theme);
    await navigate(page, '/students');
    await expect(page.getByRole('region', { name: 'მოსწავლეთა სია' })).toBeVisible();
    await expect(page.locator('.product-shell')).toHaveCSS('font-family', /AIA Mersad/);
    await choose(page.getByLabel('კლასის ფილტრი'), 'VII ბ');
    await expect(page.getByText('1–3 / 3 ჩანაწერი')).toBeVisible();
    await page.getByRole('button', { name: 'მოსწავლე', exact: true }).click();
    await expect(page.locator('th[aria-sort]')).toHaveAttribute('aria-sort', 'descending');
    await page.locator('.person-cell').first().click();
    await expect(page.locator('.student-dialog.product-theme')).toBeVisible();
    await expect(page.locator('.student-dialog')).toHaveCSS('font-family', /AIA Mersad/);
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: 'მოსწავლის ძიება' }).fill('არარსებული');
    await expect(page.getByRole('heading', { name: 'ჩანაწერი ვერ მოიძებნა' })).toBeVisible();
    await page.getByRole('button', { name: 'ფილტრების გასუფთავება' }).click();
    await expect(page.getByText('1–6 / 44 ჩანაწერი')).toBeVisible();
    await navigate(page, '/academics');
    await expect(
      page.getByRole('heading', { name: 'სასწავლო პროცესი', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.op-year-overview')).toContainText('2026–2027');
    await page.locator('.op-tabs').getByRole('button', { name: 'საგნები', exact: true }).click();
    await expect(page.locator('.op-record-list')).toContainText('მათემატიკა');
    await navigate(page, '/messages');
    await expect(page.getByRole('heading', { name: 'მიმოწერა ჯერ არ არის ჩართული' })).toBeVisible();
    await expect(page.locator('textarea')).toHaveCount(0);
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const route of ['students', 'academics', 'messages']) {
        await navigate(page, `/${route}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: `test-results/product/${route}-${width}-${theme}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
  }
  await page.setViewportSize({ width: 720, height: 500 });
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('combobox')).toBeFocused();
  const command = await page.getByRole('dialog').boundingBox();
  const footer = await page.locator('.command-footer').boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(command!.y + command!.height);
  await page.keyboard.press('Escape');
  await navigate(page, '/design');
  await page.getByRole('link', { name: /ვიზუალური ლაბორატორია/ }).click();
  await expect(page.locator('.dl-hub')).toBeVisible();
  await expect(page.locator('.product-shell')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('people directory filters keep usable search width and compact mobile spacing', async ({
  page,
}) => {
  test.setTimeout(120_000);
  if (directorCookies) {
    await page.context().addCookies(directorCookies);
    await navigate(page, '/');
  } else {
    await navigate(page, '/login');
    await signInDirector(page);
  }
  await expect(page.locator('.overview-heading')).toBeVisible();
  for (const route of ['students', 'guardians', 'staff']) {
    await navigate(page, `/${route}`);
    await expect(page.locator('.directory-toolbar')).toBeVisible();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const search = await page.locator('.directory-toolbar input').boundingBox();
      expect(search!.width).toBeGreaterThan(240);
      const toolbar = await page.locator('.directory-toolbar').boundingBox();
      expect(toolbar!.height).toBeLessThan(width === 390 ? 220 : 100);
      for (const select of await page.locator('.directory-toolbar [role=combobox]').all()) {
        const box = await select.boundingBox();
        expect(box!.width).toBeGreaterThan(150);
        expect(box!.height).toBeLessThan(50);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
});
