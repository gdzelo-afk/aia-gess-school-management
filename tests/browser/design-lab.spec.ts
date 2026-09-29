import { test, expect } from '@playwright/test';
import { fonts } from '../../src/design-lab/data';

for (const direction of ['a', 'b', 'c']) {
  test(`${direction}: local login, command lookup, people states and keyboard grade entry`, async ({
    page,
  }) => {
    const apiRequests: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/')) apiRequests.push(r.url());
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/design-lab/${direction}/login`);
    await page.getByRole('button', { name: 'სივრცეში შესვლა', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/design-lab/${direction}/dashboard$`));
    await page.keyboard.press('Control+k');
    const search = page.getByRole('combobox', { name: 'ძიება ან ბრძანება' });
    await expect(search).toBeFocused();
    await search.fill('ელენე');
    await expect(page.getByRole('option')).toHaveCount(1);
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(page.getByRole('dialog', { name: 'მოსწავლის პროფილი' })).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'ელენე მაისურაძე' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const filter = page.getByRole('combobox', { name: 'კლასის ფილტრი' });
    await filter.selectOption('VII ა');
    await expect(page.locator('.dl-people-table tbody tr')).toHaveCount(3);
    await page.getByRole('textbox', { name: 'მოსწავლის ძიება' }).fill('არარსებული');
    await expect(page.getByRole('heading', { name: 'ჩანაწერი ვერ მოიძებნა' })).toBeVisible();
    await page.getByRole('button', { name: 'ფილტრების გასუფთავება' }).click();
    await expect(page.locator('.dl-people-table tbody tr')).toHaveCount(12);
    await page.getByRole('button', { name: /^გადასამოწმებელი/ }).click();
    await expect(page.locator('.dl-people-table tbody tr')).toHaveCount(2);
    await page.getByRole('checkbox', { name: 'ყველა ნაჩვენები მოსწავლის მონიშვნა' }).check();
    await expect(page.locator('.dl-selection-bar')).toContainText('2 მონიშნულია');
    await page.getByRole('button', { name: 'მონიშვნის გაუქმება' }).click();
    await page.getByLabel('ხედის პარამეტრები', { exact: true }).click();
    await page.getByRole('button', { name: 'შეცდომის სცენარი' }).click();
    await expect(page.getByRole('alert')).toContainText('სიის ჩატვირთვა ვერ მოხერხდა');
    await page.getByRole('button', { name: 'ხელახლა ცდა' }).click();
    await expect(page.getByRole('status', { name: 'იტვირთება' })).toBeVisible();
    await expect(page.locator('.dl-people-table tbody tr')).toHaveCount(2);
    await page
      .locator('.dl-rail nav')
      .getByRole('link', { name: /ჟურნალი/ })
      .click();
    const first = page.getByRole('textbox', {
      name: 'ელენე მაისურაძე, 21 სექტემბერი',
      exact: true,
    });
    await first.fill('10');
    await first.press('ArrowRight');
    await expect(
      page.getByRole('textbox', { name: 'ელენე მაისურაძე, 22 სექტემბერი', exact: true }),
    ).toBeFocused();
    await first.fill('11');
    await expect(first).toHaveValue('10');
    await expect(page.getByRole('status')).toContainText('1-დან 10-მდე');
    await page.getByRole('button', { name: 'მიმოხილვა', exact: true }).click();
    await page.getByRole('button', { name: 'ნიმუშის დადასტურება' }).click();
    await expect(page.getByRole('status')).toContainText('ოფიციალური გამოქვეყნების გარეშე');
    await page.getByRole('button', { name: 'მუქი რეჟიმი', exact: true }).click();
    await page.reload();
    await expect(page.locator('.dl-root')).toHaveAttribute('data-lab-theme', 'dark');
    await expect(first).toHaveValue('8'); // Prototype edits never persist as school records.
    expect(apiRequests).toEqual([]);
  });

  test(`${direction}: responsive surfaces, themes, drawer and reduced motion`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const theme of ['light', 'dark']) {
        await page.goto(`/design-lab/${direction}/login`);
        await page.evaluate(
          ([d, t]) => localStorage.setItem(`aia-lab-${d}-theme`, t!),
          [direction, theme],
        );
        for (const screen of ['login', 'dashboard', 'students', 'gradebook']) {
          await page.goto(`/design-lab/${direction}/${screen}`);
          await expect(page.locator('.dl-root')).toHaveAttribute('data-lab-theme', theme);
          await page.evaluate(() => document.fonts.ready);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          await page.screenshot({
            path: `test-results/design-lab/${direction}-${screen}-${width}-${theme}.png`,
            fullPage: true,
            animations: 'disabled',
          });
        }
      }
    }
    await page.getByRole('button', { name: 'მენიუს გახსნა' }).click();
    await expect(page.getByRole('dialog', { name: 'ნავიგაცია' })).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('link', { name: /მოსწავლეები/ })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'ელენე მაისურაძე — დეტალები' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds?.width).toBeLessThanOrEqual(390);
    await page
      .getByRole('textbox', { name: 'სამუშაო შენიშვნის ნიმუში' })
      .fill('გამოგონილი შენიშვნა');
    await page.getByRole('button', { name: 'ნიმუშის შენახვა' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('status')).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/design-lab/${direction}/login`);
    expect(
      await page
        .locator('.dl-login-statement h1 b')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
    ).toBeLessThan(0.01);
    await page.getByRole('button', { name: 'სივრცეში შესვლა', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/design-lab/${direction}/dashboard$`));
    expect(errors).toEqual([]);
  });
}

test('typography specimens load all 12 candidates and support the full working scale', async ({
  page,
}) => {
  await page.goto('/design-lab/type');
  for (const font of fonts) {
    await page.getByRole('combobox', { name: 'მარჯვენა შრიფტი' }).selectOption(font.id);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        (id) => document.fonts.check(`14px "DL-${id}"`, 'მოსწავლე 10 GEL'),
        font.id,
      ),
    ).toBe(true);
  }
  for (const size of [12, 13, 14, 16, 20, 24, 32, 64]) {
    await page.getByLabel('სამუშაო ტექსტის ზომა').selectOption(String(size));
    await expect(page.locator('.dl-type-specimen').first()).toHaveCSS('font-size', `${size}px`);
  }
  await page.getByLabel('სათაურის ტექსტი').fill('სკოლის ახალი დღე');
  await expect(page.locator('.dl-type-specimen h2').first()).toHaveText('სკოლის ახალი დღე');
  await page.getByRole('button', { name: 'თემის შეცვლა' }).click();
  await expect(page.locator('.dl-root')).toHaveAttribute('data-lab-theme', 'dark');
});

test('main application does not request lab modules, styles or fonts', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'დირექტორი', exact: true })).toBeVisible();
  expect(urls.filter((url) => url.includes('design-lab'))).toEqual([]);
  expect(
    await page.locator('.product-login').evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain('AIA Mersad');
});
