import { test, expect, type Page } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';

// One administrator session for the entire operational journey. Mutations use real UI/API;
// run against a dedicated seeded database as documented in engineering.md.
const topDialog = (page: Page) => page.getByRole('dialog').last();
async function save(page: Page) {
  // Pace real writes and their read refreshes within the unchanged request budget.
  await page.waitForTimeout(2500);
  const labelId = await topDialog(page).getAttribute('aria-labelledby');
  const dialog = page.locator(`[role="dialog"][aria-labelledby="${labelId}"]`);
  await dialog.getByRole('button', { name: 'გადახედვა', exact: true }).click();
  await expect(dialog.getByText('შენახვამდე შეამოწმეთ')).toBeVisible();
  const response = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().endsWith('/actions'),
  );
  await dialog.getByRole('button', { name: 'დადასტურება და შენახვა' }).click();
  const result = await response;
  expect(result.status(), await result.text()).toBe(200);
  await expect(dialog).not.toBeVisible();
  return result.json();
}
async function pick(page: Page, label: string, name: string) {
  const dialog = topDialog(page);
  await dialog.getByLabel(label, { exact: true }).fill(name);
  await dialog
    .locator('.op-picker-results')
    .getByRole('button', { name: new RegExp(name) })
    .first()
    .click();
}
async function tab(page: Page, name: string) {
  await page.locator('.op-tabs').getByRole('button', { name, exact: true }).click();
}

test('Stage 1A academic, people, enrollment and account workflows persist through the main UI', async ({
  page,
  browser,
}) => {
  test.setTimeout(480_000);
  // Prior persona tests share localhost's sign-in budget. Let that window expire without changing limits.
  await page.waitForTimeout(31000);
  await page.waitForTimeout(31000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const suffix = Date.now().toString().slice(-7),
    studentName = `დემო მოსწავლე ${suffix}`,
    staffName = `დემო პედაგოგი ${suffix}`;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'დირექტორი', exact: true }).click();
  await expect(page.locator('.overview-heading')).toBeVisible();
  await page.goto('/academics');
  await expect(page.locator('.op-year-overview')).toContainText('I სემესტრი');
  await page.getByRole('button', { name: 'წლის დამატება' }).click();
  await topDialog(page)
    .getByLabel('წლის დასახელება', { exact: true })
    .fill(`2033–2034 · ${suffix}`);
  for (const [label, value] of [
    ['დასაწყისი', '2033-09-15'],
    ['დასრულების საზღვარი', '2034-06-16'],
    ['1 სემესტრის დასაწყისი', '2033-09-15'],
    ['1 სემესტრის დასრულების საზღვარი', '2033-12-30'],
    ['2 სემესტრის დასაწყისი', '2034-01-15'],
    ['2 სემესტრის დასრულების საზღვარი', '2034-06-16'],
  ])
    await topDialog(page).getByLabel(label!, { exact: true }).fill(value!);
  const year = await save(page);
  await page.getByLabel('სასწავლო წლის არჩევა').selectOption(year.id);
  await expect(page.locator('.op-year-overview')).toContainText('2033-09-15');
  await page.getByRole('button', { name: 'წლის რედაქტირება' }).click();
  await save(page);
  await tab(page, 'კლასები');
  await page.getByRole('button', { name: 'დამატება', exact: true }).click();
  await topDialog(page).getByLabel('პარალელის დასახელება').fill(`VII საცდელი ${suffix}`);
  await save(page);
  await tab(page, 'კალენდარი');
  await page.getByRole('button', { name: 'დამატება', exact: true }).click();
  await topDialog(page).getByLabel('სათაური').fill(`დემო ეტაპი ${suffix}`);
  await topDialog(page).getByLabel('დასაწყისი', { exact: true }).fill('2033-10-01');
  await topDialog(page).getByLabel('დასრულების საზღვარი').fill('2033-10-02');
  await save(page);
  await expect(page.locator('.op-record-list')).toContainText(`დემო ეტაპი ${suffix}`);
  // Continue on the current year: new subject, elective and effective membership.
  await page.getByLabel('სასწავლო წლის არჩევა').selectOption({ label: '2026–2027 · მიმდინარე' });
  await tab(page, 'საგნები');
  await page.getByRole('button', { name: 'დამატება', exact: true }).click();
  await topDialog(page).getByLabel('საგნის დასახელება').fill(`დემო კვლევა ${suffix}`);
  await topDialog(page).getByLabel('საგნის კოდი').fill(`QA${suffix}`);
  await save(page);
  await tab(page, 'კურსები');
  await page.getByRole('button', { name: 'დამატება', exact: true }).click();
  await topDialog(page).getByLabel('კლასი', { exact: true }).selectOption({ label: 'VII ა' });
  await topDialog(page)
    .getByLabel('საგანი', { exact: true })
    .selectOption({ label: `დემო კვლევა ${suffix}` });
  await topDialog(page).getByLabel('შემადგენლობის წესი').selectOption('true');
  await save(page);
  await page.goto('/staff');
  await page.getByRole('button', { name: 'დამატება', exact: true }).click();
  await topDialog(page).getByLabel('სახელი და გვარი').fill(staffName);
  await topDialog(page).getByLabel('თანამდებობა').fill('მასწავლებელი');
  await topDialog(page).getByLabel('სამუშაოს დასაწყისი').fill('2026-09-01');
  await save(page);
  await page.goto('/academics');
  await tab(page, 'დანიშვნები');
  await page.getByRole('button', { name: 'დამატება', exact: true }).click();
  await pick(page, 'მასწავლებლის მოძებნა', staffName);
  await topDialog(page)
    .getByLabel('პასუხისმგებლობა')
    .selectOption({ label: `VII ა · დემო კვლევა ${suffix}` });
  await save(page);
  await expect(page.locator('.op-record-list')).toContainText(staffName);
  const guardianNames = [`დემო მეურვე პირველი ${suffix}`, `დემო მეურვე მეორე ${suffix}`];
  await page.goto('/guardians');
  for (const name of guardianNames) {
    await page.getByRole('button', { name: 'დამატება', exact: true }).click();
    await topDialog(page).getByLabel('სახელი და გვარი').fill(name);
    await save(page);
  }
  await page.goto('/students');
  await page.getByRole('button', { name: 'მოსწავლის დამატება', exact: true }).click();
  await topDialog(page).getByLabel('სახელი და გვარი').fill(studentName);
  await topDialog(page).getByLabel('მოსწავლის ნომერი').fill(`QA-${suffix}`);
  await topDialog(page).getByLabel('მიმღები კლასი').selectOption({ label: 'VII ა' });
  await topDialog(page).getByLabel('ჩარიცხვის თარიღი').fill('2026-09-15');
  await save(page);
  await page.getByLabel('მოსწავლის ძიება').fill(studentName);
  await page.locator('.person-cell').first().click();
  await page.getByRole('button', { name: 'პროფილის რედაქტირება' }).click();
  await topDialog(page).getByLabel('საკონტაქტო ელფოსტა').fill(`student-${suffix}@example.test`);
  await save(page);
  for (const guardian of guardianNames) {
    await page.getByRole('button', { name: 'დაკავშირება', exact: true }).click();
    await pick(page, 'მშობლის მოძებნა', guardian);
    await topDialog(page).getByLabel('კავშირის დასაწყისი').fill('2026-09-15');
    await save(page);
  }
  await expect(page.locator('.op-history').last()).toContainText(guardianNames[0]!);
  await expect(page.locator('.op-history').last()).toContainText(guardianNames[1]!);
  await page.keyboard.press('Escape');
  await page.goto('/academics');
  await tab(page, 'კურსები');
  await page
    .locator('.op-record-list article')
    .filter({ hasText: `დემო კვლევა ${suffix}` })
    .getByRole('button', { name: /შემადგენლობა/ })
    .click();
  await page.getByRole('button', { name: 'მოსწავლის დამატება', exact: true }).click();
  await pick(page, 'მოსწავლის მოძებნა', studentName);
  await topDialog(page).getByLabel('წევრობის დასაწყისი').fill('2026-09-15');
  await save(page);
  await expect(topDialog(page)).toContainText(studentName);
  await page.keyboard.press('Escape');
  await page.goto('/students');
  await page.getByLabel('მოსწავლის ძიება').fill(studentName);
  await page.locator('.person-cell').first().click();
  await page.getByRole('button', { name: 'ჩარიცხვის შეცვლა' }).click();
  await topDialog(page).getByLabel('მიმღები კლასი').selectOption({ label: 'VII ბ' });
  await topDialog(page).getByLabel('ცვლილების მიზეზი').fill('სადემონსტრაციო გადაყვანა');
  await save(page);
  await expect(page.locator('.op-history').first()).toContainText('VII ა');
  await expect(page.locator('.op-history').first()).toContainText('VII ბ');
  await page.getByRole('button', { name: 'არქივირება', exact: true }).click();
  await topDialog(page).getByRole('button', { name: 'გადახედვა', exact: true }).click();
  await topDialog(page).getByRole('button', { name: 'დადასტურება და შენახვა' }).click();
  await expect(topDialog(page).getByRole('alert')).toContainText('ჩარიცხვები');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  // Invite the real linked guardian, activate through an anonymous browser, recover and disable.
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'მოწვევის შექმნა' }).click();
  await pick(page, 'არსებული პიროვნების მოძებნა', guardianNames[1]!);
  const email = `guardian-${suffix}@example.test`;
  await topDialog(page).getByLabel('ანგარიშის ელფოსტა').fill(email);
  await topDialog(page).getByLabel('მშობელი', { exact: true }).check();
  const invitation = await save(page);
  await expect(page.locator('.op-token-link')).toContainText('/activate#');
  await page.keyboard.press('Escape');
  const guest = await browser.newContext();
  const activation = await guest.newPage();
  activation.on('pageerror', (e) => errors.push(e.message));
  await activation.goto(invitation.activationUrl);
  await activation.getByLabel('ახალი პაროლი', { exact: true }).fill('Stage1a-browser-password!');
  await activation.getByLabel('გაიმეორეთ პაროლი').fill('Stage1a-browser-password!');
  await activation.getByRole('button', { name: 'პაროლის შენახვა' }).click();
  await expect(activation.getByRole('status')).toContainText('პაროლი შენახულია');
  await activation.getByRole('link', { name: 'შესვლაზე დაბრუნება' }).click();
  await expect(activation.locator('.product-login')).toBeVisible();
  await activation.goto(invitation.activationUrl);
  await activation.getByLabel('ახალი პაროლი', { exact: true }).fill('Stage1a-browser-password!');
  await activation.getByLabel('გაიმეორეთ პაროლი').fill('Stage1a-browser-password!');
  await activation.getByRole('button', { name: 'პაროლის შენახვა' }).click();
  await expect(activation.getByRole('alert')).toContainText('გამოყენებულია');
  await activation.goto('http://localhost:5173/recovery');
  const existing: string[] = await readdir('.local/delivery').catch(() => []);
  await activation.getByLabel('ანგარიშის ელფოსტა').fill(email);
  await activation.getByRole('button', { name: 'აღდგენის მოთხოვნა' }).click();
  await expect(activation.getByRole('status')).toContainText('მოთხოვნა მიღებულია');
  const filename = (await readdir('.local/delivery')).find((f) => !existing.includes(f))!;
  const recovery = JSON.parse(await readFile(`.local/delivery/${filename}`, 'utf8')) as {
    url: string;
  };
  await activation.goto(recovery.url);
  await activation.getByLabel('ახალი პაროლი', { exact: true }).fill('Stage1a-recovered-password!');
  await activation.getByLabel('გაიმეორეთ პაროლი').fill('Stage1a-recovered-password!');
  await activation.getByRole('button', { name: 'პაროლის შენახვა' }).click();
  await expect(activation.getByRole('status')).toContainText('პაროლი შენახულია');
  await activation.getByRole('link', { name: 'შესვლაზე დაბრუნება' }).click();
  await activation.getByLabel('ელფოსტა', { exact: true }).fill(email);
  await activation.getByLabel('პაროლი', { exact: true }).fill('Stage1a-recovered-password!');
  await activation.getByRole('button', { name: 'სივრცეში შესვლა', exact: true }).click();
  await expect(activation.locator('.overview-heading')).toBeVisible();
  await activation.goto('http://localhost:5173/accounts');
  await expect(activation.getByRole('heading', { name: 'წვდომა შეზღუდულია' })).toBeVisible();
  expect((await activation.request.get('http://localhost:5173/api/accounts')).status()).toBe(403);
  expect(
    (
      await activation.request.post('http://localhost:5173/api/academics/actions', {
        data: { action: 'year.status' },
        headers: { origin: 'http://localhost:5173' },
      })
    ).status(),
  ).not.toBe(200);
  await page.getByLabel('ანგარიშის ძიება').fill(email);
  await page
    .locator('.op-record-list')
    .getByRole('button', { name: 'გამორთვა', exact: true })
    .click();
  await save(page);
  expect((await activation.request.get('http://localhost:5173/api/me')).status()).toBe(401);
  await guest.close();
  // Effective departure closes assignments; ending a guardian link preserves history.
  await page.goto('/staff');
  await page.getByLabel('პიროვნების ძიება').fill(staffName);
  await page
    .locator('.op-record-list')
    .getByRole('button', { name: 'პროფილი', exact: true })
    .click();
  const localToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(
    new Date(),
  );
  await topDialog(page).getByLabel('სამუშაოს დასრულება (არ შედის)').fill(localToday);
  await save(page);
  await page.getByLabel('სტატუსის ფილტრი').selectOption('departed');
  await expect(page.locator('.op-record-list')).toContainText('სამუშაო პერიოდი დასრულებულია');
  await page
    .locator('.op-record-list')
    .getByRole('button', { name: 'დანიშვნები', exact: true })
    .click();
  await expect(topDialog(page)).toContainText(localToday);
  await page.keyboard.press('Escape');
  await page.goto('/students');
  await page.getByLabel('მოსწავლის ძიება').fill(studentName);
  await page.locator('.person-cell').first().click();
  await page.getByRole('button', { name: 'კავშირის დასრულება' }).first().click();
  await save(page);
  await expect(page.locator('.op-history').last()).toContainText(localToday);
  await page.keyboard.press('Escape');
  // Separate pupil: same-day transfer cannot be collapsed to a zero-length enrollment.
  await page.getByRole('button', { name: 'მოსწავლის დამატება', exact: true }).click();
  await topDialog(page).getByLabel('სახელი და გვარი').fill(`გასვლის მაგალითი ${suffix}`);
  await topDialog(page).getByLabel('მოსწავლის ნომერი').fill(`EXIT-${suffix}`);
  await topDialog(page).getByLabel('მიმღები კლასი').selectOption({ label: 'VII ა' });
  await topDialog(page).getByLabel('ჩარიცხვის თარიღი').fill('2026-09-15');
  await save(page);
  await page.getByLabel('მოსწავლის ძიება').fill(`გასვლის მაგალითი ${suffix}`);
  await page.locator('.person-cell').first().click();
  await page.getByRole('button', { name: 'ჩარიცხვის შეცვლა' }).click();
  await topDialog(page).getByLabel('მიმღები კლასი').selectOption('');
  await topDialog(page).getByLabel('ცვლილების მიზეზი').fill('დემო გასვლა');
  await save(page);
  await page.getByRole('button', { name: 'არქივირება', exact: true }).click();
  await save(page);
  await expect(page.locator('.student-dialog')).toContainText('არქივში');
  await page.getByRole('button', { name: 'აღდგენა', exact: true }).click();
  await save(page);
  await page.keyboard.press('Escape');

  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => localStorage.setItem('aia-theme', t), theme);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const route of ['academics', 'calendar', 'students', 'guardians', 'staff', 'accounts']) {
        // Pace full reloads; normal navigation reuses cached shell queries.
        await page.waitForTimeout(4000);
        await page.goto(`/${route}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: `test-results/stage1a/${route}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
      await page.goto('/staff');
      await page.getByRole('button', { name: 'დამატება', exact: true }).click();
      await expect(topDialog(page)).toBeVisible();
      const box = await topDialog(page).boundingBox();
      expect(box!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `test-results/stage1a/form-${theme}-${width}.png` });
      await page.keyboard.press('Escape');
    }
  }
  expect(errors).toEqual([]);
});
