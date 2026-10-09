import { mkdir } from 'node:fs/promises';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { signIn } from './sign-in';

test.use({ hasTouch: true, actionTimeout: 15000 });
const evidence = '.local/ux-phase2';
test.beforeAll(async () => mkdir(evidence, { recursive: true }));

async function shot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage, animations: 'disabled' });
}
async function theme(page: Page, value: string) {
  const toggle = page.getByRole('button', {
    name: /^(ფერის რეჟიმის შეცვლა|მუქი რეჟიმი|ღია რეჟიმი)$/,
  });
  if ((await page.locator('html').getAttribute('data-theme')) !== value) await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', value);
}
async function navigate(page: Page, path: string) {
  const budget = await page.request.get('/api/health');
  if (budget.status() === 429 || Number(budget.headers()['x-ratelimit-remaining'] ?? 180) < 35) {
    const retry = Number(
      budget.headers()['retry-after'] ?? budget.headers()['x-ratelimit-reset'] ?? 60,
    );
    await page.waitForTimeout((retry + 1) * 1000);
  }
  await page.goto(path);
  await expect(page.locator('#main')).toBeVisible();
}
async function pointerField(field: Locator, quiet = false) {
  await field.click();
  await expect(field.page().locator('html')).toHaveAttribute('data-focus-method', 'pointer');
  await expect(field).toHaveCSS('outline-style', 'none');
  if (!quiet) await expect(field).toHaveCSS('box-shadow', 'none');
}
async function keyboardField(field: Locator, quiet = false) {
  await field.press('Shift+Tab');
  await field.page().keyboard.press('Tab');
  await expect(field).toBeFocused();
  await expect(field.page().locator('html')).toHaveAttribute('data-focus-method', 'keyboard');
  if (quiet) {
    await expect(field).toHaveCSS('outline-style', 'none');
    await expect(field).toHaveCSS('box-shadow', /inset/);
  } else {
    await expect(field).toHaveCSS('outline-width', '2px');
    await expect(field).toHaveCSS('outline-offset', '-2px');
  }
}

test('phone Login removes its story footprint and real taps toggle both persisted themes', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/login');
  const toggle = page.getByRole('button', { name: 'ფერის რეჟიმის შეცვლა', exact: true });
  const email = page.getByLabel('ელფოსტა', { exact: true });
  for (const [width, height] of [
    [390, 844],
    [390, 667],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect(page.locator('.entrance-story')).toBeHidden();
    expect(
      await page.locator('.entrance-story').evaluate((e) => e.getBoundingClientRect().height),
    ).toBe(0);
    const target = await toggle.boundingBox();
    expect(target!.width).toBeGreaterThanOrEqual(44);
    expect(
      await toggle.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
    for (const next of ['dark', 'light']) {
      await theme(page, next === 'dark' ? 'light' : 'dark');
      await page.touchscreen.tap(target!.x + target!.width / 2, target!.y + target!.height / 2);
      await expect(page.locator('html')).toHaveAttribute('data-theme', next);
      expect(await page.evaluate(() => localStorage.getItem('aia-theme'))).toBe(next);
      await expect(email).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390) await shot(page, `login-${width}x${height}-${next}`, true);
    }
  }
  await page.setViewportSize({ width: 390, height: 667 });
  await theme(page, 'dark');
  await email.fill('review@example.invalid');
  await pointerField(email);
  await email.press('r'); // Typing does not turn pointer focus into a ring.
  await expect(email).toHaveCSS('outline-style', 'none');
  await keyboardField(email);
  await toggle.focus();
  await toggle.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(email).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'სივრცეში შესვლა', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('link', { name: 'პაროლის აღდგენა' })).toBeVisible();
  for (const width of [761, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await expect(page.locator('.entrance-story')).toBeVisible();
    await theme(page, 'dark');
    await theme(page, 'light');
    if (width === 1440) await shot(page, 'desktop-login-preserved');
  }
});

test('shared form boundaries remain single after pointer and contiguous after keyboard, including invalid fields', async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.goto('/login');
  await signIn(page, 'დირექტორი');
  for (const mode of ['light', 'dark']) {
    await navigate(page, '/calendar');
    await theme(page, mode);
    await page.getByRole('button', { name: 'დამატება', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const title = dialog.getByLabel('სათაური', { exact: true });
    await pointerField(title);
    await shot(page, `calendar-pointer-${mode}`);
    await keyboardField(title);
    await shot(page, `calendar-keyboard-${mode}`);
    const fields = dialog.locator('input:visible:not([type=checkbox]):not([type=radio])');
    for (const field of await fields.all()) {
      await pointerField(field);
      await keyboardField(field);
    }
    await title.fill('საცდელი სათაური');
    await title.clear();
    await dialog.getByRole('button', { name: 'გადახედვა', exact: true }).click();
    expect(await title.evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
    await expect(title).toHaveCSS(
      'border-top-color',
      mode === 'light' ? 'rgb(173, 53, 63)' : 'rgb(248, 169, 176)',
    );
    await keyboardField(title);
    await expect(title).toHaveCSS(
      'outline-color',
      mode === 'light' ? 'rgb(173, 53, 63)' : 'rgb(248, 169, 176)',
    );
    await page.keyboard.press('Escape');
  }
  for (const [path, button] of [
    ['/students', 'მოსწავლის დამატება'],
    ['/guardians', 'დამატება'],
    ['/staff', 'დამატება'],
    ['/accounts', 'მოწვევის შექმნა'],
  ]) {
    await navigate(page, path!);
    const search = page.locator('#main input').first();
    await pointerField(search);
    await keyboardField(search);
    await page.getByRole('button', { name: button!, exact: true }).click();
    const fields = page
      .locator('.dialog-content')
      .locator('input:visible:not([type=checkbox]):not([type=radio])');
    for (const field of await fields.all()) {
      await pointerField(field);
      await keyboardField(field);
    }
    await page.keyboard.press('Escape');
    if (await page.locator('.dialog-content').isVisible()) await page.keyboard.press('Escape');
  }
  await navigate(page, '/academics');
  for (const tab of ['წელი და სემესტრები', 'კლასები', 'საგნები', 'კურსები', 'დანიშვნები']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page
      .getByRole('button', {
        name: tab === 'წელი და სემესტრები' ? 'წლის დამატება' : 'დამატება',
        exact: true,
      })
      .click();
    for (const field of await page
      .locator('.dialog-content')
      .locator('input:visible:not([type=checkbox]):not([type=radio])')
      .all()) {
      await pointerField(field);
      await keyboardField(field);
    }
    await page.keyboard.press('Escape');
    if (await page.locator('.dialog-content').isVisible()) await page.keyboard.press('Escape');
  }
});

test('select and borderless search preserve keyboard visibility without separated rings', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/login');
  await signIn(page, 'დირექტორი');
  await navigate(page, '/timetable');
  const selector = page.getByRole('combobox', { name: 'განრიგის ვერსია', exact: true });
  for (const mode of ['light', 'dark']) {
    await theme(page, mode);
    await selector.click();
    await expect(selector).toHaveCSS('outline-style', 'none');
    await expect(selector).toHaveCSS('border-top-width', '1px');
    await shot(page, `selector-pointer-${mode}`);
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    await keyboardField(selector);
    await shot(page, `selector-keyboard-${mode}`);
    await page.locator('.tt-lens-heading > button').click();
    await pointerField(page.getByRole('dialog').locator('input'), true);
    await keyboardField(page.getByRole('dialog').locator('input'), true);
    await page.keyboard.press('Escape');
  }
  await navigate(page, '/gradebook');
  await page
    .getByRole('navigation', { name: 'ჟურნალის სამუშაო არეები' })
    .getByRole('button', { name: 'ჟურნალი', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'საგნის კურსი', exact: true }).click();
  const search = page.locator('.ux-select-search input');
  await pointerField(search, true);
  // Tab deliberately exits a Select popover; arrows navigate its real list.
  await search.press('ArrowDown');
  await expect(page.locator('html')).toHaveAttribute('data-focus-method', 'keyboard');
  await expect(search).toHaveCSS('outline-style', 'none');
  await expect(search).toHaveCSS('box-shadow', /inset/);
  await search.fill('ქართული');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).not.toBeVisible();
});

test('compact dates share stable optical padding and preserve actual date navigation', async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.goto('/login');
  await signIn(page, 'დირექტორი');
  for (const path of ['/attendance', '/timetable']) {
    await navigate(page, path);
    const date = page.locator('.ux-date--compact input');
    await expect(date).toHaveCSS('font-family', '"AIA Mersad", sans-serif');
    await expect(date).toHaveCSS('padding-top', '10px');
    await expect(date).toHaveCSS('padding-bottom', '6px');
    await expect(date).toHaveCSS('line-height', '20px');
    for (const width of [1920, 1440, 1024, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 667 : 1080 });
      for (const mode of ['light', 'dark']) {
        await theme(page, mode);
        await pointerField(date, true);
        await keyboardField(date, true);
        await page.getByRole('heading', { level: 1 }).click();
        await shot(page, `${path.slice(1)}-${width}-${mode}`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const value of ['2026-10-08', '2026-11-19', '2026-12-28']) {
      await date.fill(value);
      await expect(date).toHaveValue(
        path === '/attendance'
          ? value
          : ['2026-10-05', '2026-11-16', '2026-12-28'][
              ['2026-10-08', '2026-11-19', '2026-12-28'].indexOf(value)
            ]!,
      );
    }
    await date.locator('..').getByRole('button', { name: 'თარიღის არჩევა', exact: true }).click();
    await expect(page.locator('.ux-calendar')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ux-calendar')).not.toBeVisible();
  }
});

test('teacher and family fields receive shared focus corrections without changing their scopes', async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.goto('/login');
  await signIn(page, 'მასწავლებელი');
  await navigate(page, '/gradebook');
  await page.getByRole('button', { name: 'შეფასება', exact: true }).click();
  for (const field of await page
    .getByRole('dialog')
    .locator('input:visible:not([type=checkbox]):not([type=radio]),textarea:visible')
    .all()) {
    await pointerField(field);
    await keyboardField(field);
  }
  await page.keyboard.press('Escape');
  await navigate(page, '/attendance');
  await page.locator('.att-lessons > button').first().click();
  const pupil = page.locator('.att-pupil').first();
  await pupil.getByLabel('დაგვიანება', { exact: true }).check();
  await pointerField(pupil.locator('input[type=time]'));
  // Touch-enabled Chrome opens its native time picker; dismiss it before
  // testing document-level Tab traversal rather than the picker's own keys.
  await page.keyboard.press('Escape');
  await keyboardField(pupil.locator('input[type=time]'));
  const unauthorized = pupil.getByLabel('საპატიო გაცდენა', { exact: true });
  await expect(unauthorized).toBeDisabled();
  // Navigation discards only this unsaved local exception, never a submitted roll call.
  page.once('dialog', (d) => d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: 'გასვლა', exact: true }).click();
  await signIn(page, 'მშობელი');
  await navigate(page, '/attendance');
  await page.getByRole('button', { name: 'განმარტების დამატება', exact: true }).click();
  const narrative = page.getByRole('dialog').locator('textarea');
  for (const mode of ['light', 'dark']) {
    await page.keyboard.press('Escape');
    await theme(page, mode);
    await page.getByRole('button', { name: 'განმარტების დამატება', exact: true }).click();
    await pointerField(narrative);
    await keyboardField(narrative);
    await page.setViewportSize({ width: 390, height: 667 });
    await shot(page, `guardian-explanation-${mode}`);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.keyboard.press('Escape');
  await page.goto('/');
  await page.getByRole('button', { name: 'გასვლა', exact: true }).click();
  await signIn(page, 'მოსწავლე');
  await navigate(page, '/attendance');
  await expect(page.getByRole('button', { name: 'განმარტების დამატება', exact: true })).toHaveCount(
    0,
  );
  await pointerField(page.locator('.ux-date--compact input'), true);
  await keyboardField(page.locator('.ux-date--compact input'), true);
  await navigate(page, '/gradebook');
  await expect(page.getByRole('button', { name: 'შეფასება', exact: true })).toHaveCount(0);
});
