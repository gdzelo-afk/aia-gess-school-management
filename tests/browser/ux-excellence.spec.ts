import { test, expect, type Page } from '@playwright/test';
import { signIn } from './sign-in';

async function revalidate(page: Page) {
  const response = page.waitForResponse((r) => r.url().endsWith('/api/me'));
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  return response;
}

test('transient session checks preserve unsaved work; retry recovers and expiration removes access', async ({
  page,
}) => {
  test.setTimeout(110000);
  await page.goto('/login');
  await signIn(page, 'დირექტორი');
  await page.locator('.sidebar .nav-link[href="/students"]').click();
  await expect(page.locator('#main')).toBeFocused();
  const add = page.getByRole('button', { name: 'მოსწავლის დამატება', exact: true });
  await add.click();
  const field = page.getByLabel('სახელი და გვარი', { exact: true });
  await field.fill('შეუნახავი საცდელი სახელი');
  await page.route('**/api/me', (r) =>
    r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await page.waitForTimeout(31000);
  expect((await revalidate(page)).status()).toBe(503);
  await expect(field).toHaveValue('შეუნახავი საცდელი სახელი');
  await expect(field).toBeFocused();
  await expect(page.locator('.session-notice')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 600 });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'დახურვა', exact: true })
    .click({ trial: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('Escape');
  await expect(add).toBeFocused();
  await page.unroute('**/api/me');
  await page.getByRole('button', { name: 'კავშირის შემოწმება', exact: true }).click();
  await expect(page.locator('.session-notice')).toHaveCount(0);
  await expect(page.locator('.product-shell')).toBeVisible();
  await page.route('**/api/me', (r) =>
    r.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.waitForTimeout(31000);
  expect((await revalidate(page)).status()).toBe(401);
  await expect(page.locator('.product-shell')).toHaveCount(0);
  await expect(page.getByLabel('პაროლი', { exact: true })).toBeVisible();
});

test('keyboard continuity: dialog return, local selector scrolling, forward Tab and manual workspace navigation', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await signIn(page, 'დირექტორი');
  const notice = page.getByRole('button', { name: 'შეტყობინებების გახსნა' });
  await notice.focus();
  await notice.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(notice).toBeFocused();
  await page.locator('.sidebar .nav-link[href="/gradebook"]').click();
  const navigation = page.getByRole('navigation', { name: 'ჟურნალის სამუშაო არეები' });
  await navigation.getByRole('button', { name: 'ჟურნალი', exact: true }).click();
  const lens = page.getByRole('combobox', { name: 'საგნის კურსი', exact: true });
  await lens.click();
  await page.getByRole('option').last().click();
  await lens.click();
  await expect
    .poll(() =>
      page.getByRole('option', { selected: true }).evaluate((e) => {
        const row = e.getBoundingClientRect(),
          list = e.parentElement!.getBoundingClientRect();
        return row.top >= list.top && row.bottom <= list.bottom + 1;
      }),
    )
    .toBe(true);
  const scroll = await page.evaluate(() => scrollY);
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(lens).not.toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  await page.goto('/attendance');
  await page.setViewportSize({ width: 390, height: 600 });
  // Exercise the ready workspace; the async overdue badge changes the tab widths.
  await expect(page.getByRole('region', { name: 'დღის შეჯამება' })).toBeVisible();
  const tabs = page.getByRole('tablist');
  const today = tabs.getByRole('tab', { name: 'დღეს', exact: true });
  await today.focus();
  await page.keyboard.press('End');
  const last = tabs.getByRole('tab').last();
  await expect(last).toBeFocused();
  await expect(today).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(() =>
      last.evaluate((e) => {
        const a = e.getBoundingClientRect(),
          b = e.parentElement!.getBoundingClientRect();
        return a.left >= b.left - 1 && a.right <= b.right + 1;
      }),
    )
    .toBe(true);
  await page.keyboard.press('Enter');
  await expect(last).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('directory typing coalesces requests and makes prior results inert immediately', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/login');
  await signIn(page, 'დირექტორი');
  await page.goto('/students');
  const search = page.getByLabel('მოსწავლის ძიება');
  const rows = page.getByRole('region', { name: 'მოსწავლეთა სია', exact: true });
  await expect(rows).toBeVisible();
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/foundation/students?')) requests.push(r.url());
  });
  await search.pressSequentially('გიორგი', { delay: 45 });
  await expect(rows).toHaveAttribute('inert', '');
  await expect(page.getByRole('status').filter({ hasText: 'ახლდება' })).toBeVisible();
  await expect.poll(() => requests.length).toBe(1);
  await expect(rows).not.toHaveAttribute('inert', '');
  expect(new URL(requests[0]!).searchParams.get('q')).toBe('გიორგი');
  await search.fill('');
  await expect(rows).not.toHaveAttribute('inert', '');
  await expect(page.getByRole('status').filter({ hasText: 'ჩანაწერი' })).toBeVisible();
});
