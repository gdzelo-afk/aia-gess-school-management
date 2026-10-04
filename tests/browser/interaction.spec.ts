import { test, expect } from '@playwright/test';

test('login validation stays in place and retains accessible feedback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto('/login');
  const submit = page.getByRole('button', { name: 'სივრცეში შესვლა', exact: true });
  await expect(submit).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const before = await submit.boundingBox();
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('ელფოსტა');
  const after = await submit.boundingBox();
  expect(after!.y).toBeCloseTo(before!.y, 0);
  await page.getByLabel('ელფოსტა', { exact: true }).fill('director@demo.aia.local');
  await page.getByLabel('პაროლი', { exact: true }).fill('wrong-password');
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('შესვლა ვერ მოხერხდა');
  expect((await submit.boundingBox())!.y).toBeCloseTo(before!.y, 0);
  await expect(submit).toBeInViewport();
});

test('shared selection, Georgian calendar, timetable scrolling and workspace continuity', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/login');
  await page.getByRole('button', { name: 'დირექტორი', exact: true }).click();
  await page.locator('.overview-heading').waitFor();
  const shell = page.locator('.product-shell');
  await shell.evaluate((e) => e.setAttribute('data-audit-shell', 'retained'));
  await page.getByRole('link', { name: 'გაკვეთილების განრიგი', exact: true }).click();
  await page.locator('.tt-matrix').waitFor();
  await expect(shell).toHaveAttribute('data-audit-shell', 'retained');
  const selector = page.getByRole('combobox', { name: 'განრიგის ვერსია' });
  await selector.click();
  await expect(selector).toHaveCSS('outline-style', 'none');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(selector).toBeFocused();
  await expect(selector).toHaveCSS('outline-width', '2px');
  await expect(selector).not.toHaveAttribute('value', '');
  await selector.click();
  await page.getByRole('option', { name: 'მოქმედი გამოქვეყნებული განრიგი', exact: true }).click();
  await expect(selector).toHaveAttribute('value', '');
  await expect
    .poll(() => page.locator('.tt-matrix-scroll').evaluate((e) => e.scrollHeight - e.clientHeight))
    .toBeLessThanOrEqual(2);
  await page.locator('.tt-matrix').evaluate((e) => e.setAttribute('data-retained', 'yes'));
  await page
    .locator('.tt-workspace-nav')
    .getByRole('button', { name: /კონფლიქტები/ })
    .click();
  await expect(page.getByRole('heading', { name: 'კონფლიქტების განხილვა' })).toBeVisible();
  await page
    .locator('.tt-workspace-nav')
    .getByRole('button', { name: /მოთხოვნები/ })
    .click();
  await page
    .locator('.tt-workspace-nav')
    .getByRole('button', { name: 'განრიგი', exact: true })
    .click();
  await expect(page.locator('.tt-matrix')).toHaveAttribute('data-retained', 'yes');
  await page.getByRole('button', { name: 'თარიღის არჩევა', exact: true }).click();
  const calendar = page.locator('.ux-calendar');
  await expect(calendar.getByRole('columnheader')).toHaveText([
    'კვი.',
    'ორშ.',
    'სამშ.',
    'ოთხ.',
    'ხუთ.',
    'პარ.',
    'შაბ.',
  ]);
  await expect(calendar.getByRole('button', { name: 'გასუფთავება' })).toBeVisible();
  await expect(calendar.getByRole('button', { name: 'დღეს', exact: true })).toBeVisible();
  const week = await page.getByLabel('განრიგის კვირა', { exact: true }).inputValue();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('განრიგის კვირა', { exact: true })).toHaveValue(week);
  await expect(calendar).not.toBeVisible();
  await page.getByRole('link', { name: 'ჟურნალი', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'ჟურნალის სამუშაო არეები' })
    .getByRole('button', { name: 'ჟურნალი', exact: true })
    .click();
  const course = page.getByRole('combobox', { name: 'საგნის კურსი', exact: true });
  await course.click();
  await expect(page.locator('.ux-select-search input')).toBeVisible();
  await page.locator('.ux-select-search input').fill('ქართული');
  await expect(page.getByRole('option').first()).toContainText('ქართული');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(course).toContainText('ქართული');
  const navIcon = page.locator('.sidebar .nav-link svg').first();
  const iconBefore = await navIcon.boundingBox();
  await page.getByRole('button', { name: 'ნავიგაციის შეკეცვა' }).click();
  await expect(shell).toHaveClass(/sidebar-collapsed/);
  await page.waitForTimeout(240);
  await expect(page.locator('.sidebar')).toHaveCSS('width', '72px');
  const iconAfter = await navIcon.boundingBox();
  expect(iconAfter!.x).toBeCloseTo(iconBefore!.x, 0);
  expect(iconAfter!.y).toBeCloseTo(iconBefore!.y, 0);
  await page.setViewportSize({ width: 390, height: 667 });
  await page.getByRole('button', { name: 'მენიუს გახსნა' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'მენიუს გახსნა' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // The same controls inside a real modal retain native form values and validation.
  await page.goto('/students');
  await page.getByRole('button', { name: 'მოსწავლის დამატება', exact: true }).click();
  const dialog = page.locator('.op-dialog');
  await dialog.getByLabel('სახელი და გვარი', { exact: true }).fill('საცდელი პიროვნება');
  await dialog.getByLabel('მოსწავლის ნომერი', { exact: true }).fill('UX-TEST');
  await dialog.getByRole('button', { name: 'გადახედვა', exact: true }).click();
  const section = dialog.getByRole('combobox', { name: 'მიმღები კლასი', exact: true });
  await expect(section).toBeFocused();
  await expect(section).toHaveAttribute('aria-invalid', 'true');
  await section.click();
  await page.getByRole('option', { name: 'VII ა', exact: true }).click();
  await expect(page.getByRole('listbox')).not.toBeVisible();
  const date = dialog.getByLabel('ჩარიცხვის თარიღი', { exact: true });
  await date.fill('2026-09-21');
  const dateButton = dialog.getByRole('button', { name: 'თარიღის არჩევა', exact: true });
  await dateButton.click();
  await expect(page.locator('.ux-calendar header')).toContainText('სექტემბერი 2026');
  await page.getByRole('button', { name: '22 სექტემბერი 2026', exact: true }).click();
  await expect(date).toHaveValue('2026-09-22');
  await expect(dateButton).toBeFocused();
  await expect(page.locator('.ux-calendar')).not.toBeVisible();
  await dateButton.click();
  await page.getByRole('button', { name: 'გასუფთავება', exact: true }).click();
  await expect(date).toHaveValue('');
  await expect(page.locator('.ux-calendar')).not.toBeVisible();
  await date.fill('2026-02-31');
  expect(await date.evaluate((e: HTMLInputElement) => e.validity.valid)).toBe(false);
  await date.fill('2026-09-22');
  expect(await date.evaluate((e: HTMLInputElement) => e.validity.valid)).toBe(true);
  await dialog.getByRole('button', { name: 'გადახედვა', exact: true }).click();
  await expect(dialog.locator('.op-review')).toContainText('VII ა');
  await expect(dialog.locator('.op-review')).toContainText('2026-09-22');
  await dialog.getByRole('button', { name: 'რედაქტირება', exact: true }).click();
  await dialog.locator('form').evaluate((form: HTMLFormElement) => form.reset());
  await expect(section).toHaveAttribute('value', '');
  await dialog.getByLabel('არსებული პიროვნების გამოყენება').check();
  const person = dialog.getByRole('combobox', { name: 'არსებული პიროვნების მოძებნა', exact: true });
  await person.fill('თამარ');
  await expect(page.getByRole('option').first()).toBeVisible();
  await person.press('Enter');
  await expect(person).not.toHaveValue('თამარ');
  await expect(page.getByRole('listbox')).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await dateButton.click();
  await expect(page.locator('.ux-calendar')).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dateButton).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
