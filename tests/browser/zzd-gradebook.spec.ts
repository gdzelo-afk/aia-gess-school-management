import { choose } from './choose';
import { test, expect, type Page } from '@playwright/test';
import { browserOrigin } from '../../scripts/browser/environment';
test.use({ actionTimeout: 15000 });
test.describe.configure({ timeout: 240000 });
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function login(page: Page, role: string) {
  await settle(page);
  await page.goto('/login');
  // Other journeys share the real authentication budget. Retry only after a 429 reset.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-in/email'));
    await page.getByRole('button', { name: role, exact: true }).click();
    const result = await response;
    if (result.status() !== 429) {
      expect(result.ok()).toBe(true);
      await expect(page.locator('.overview-heading')).toBeVisible();
      return;
    }
    const seconds = Number(
      result.headers()['x-retry-after'] ?? result.headers()['retry-after'] ?? 60,
    );
    await page.waitForTimeout((seconds + 1) * 1000);
  }
  throw new Error('Sign-in remained throttled after its reset');
}
test.beforeEach(async ({ page }) => {
  await settle(page, 150);
});
async function settle(page: Page, minimum = 40) {
  const r = await page.request.get('/api/health');
  if (r.status() === 429 || Number(r.headers()['x-ratelimit-remaining']) < minimum)
    await page.waitForTimeout(
      (Number(r.headers()['retry-after'] ?? r.headers()['x-ratelimit-reset'] ?? 60) + 1) * 1000,
    );
}
test('Gradebook real draft publication, scoped family reports and mobile assessment roster', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(240000);
  await login(page, 'მასწავლებელი');
  await page.goto(`/gradebook?course=${id(16000)}`);
  await expect(page.getByRole('heading', { name: 'ჟურნალი', exact: true })).toBeVisible();
  await expect(page.locator('.gb-table tbody tr')).toHaveCount(20);
  await page.screenshot({ path: testInfo.outputPath('teacher-matrix-light.png'), fullPage: true });
  await page.getByRole('button', { name: 'შეფასება', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('დასახელება', { exact: true }).fill('სატესტო ტექსტის გააზრება');
  await dialog.getByLabel('თარიღი', { exact: true }).fill('2026-10-03');
  await dialog.getByRole('button', { name: 'მონახაზის შექმნა' }).click();
  const panel = page.getByRole('complementary', { name: 'შეფასების დეტალები' });
  await expect(panel.getByRole('heading', { name: 'სატესტო ტექსტის გააზრება' })).toBeVisible();
  await expect(panel.locator('.gb-entry-row')).toHaveCount(20);
  const assessmentId = new URL(page.url()).searchParams.get('assessment')!;
  const before = await page.request.get(`/api/gradebook/assessments/${assessmentId}`);
  expect(
    (await before.json()).entries.every(
      (e: { value: { kind: string } }) => e.value.kind === 'state',
    ),
  ).toBe(true);
  await choose(panel.locator('.gb-result-control [role="combobox"]').first(), 'numeric');
  await panel.getByRole('spinbutton').first().fill('9');
  await expect(panel.getByText('შეუნახავია', { exact: true })).toBeVisible();
  // Cancelling a scope/route transition must not move the lens or discard local edits.
  const originalCourse = await page
    .getByRole('combobox', { name: /საგნის კურსი/ })
    .getAttribute('value');
  for (const change of [
    () => choose(page.getByRole('combobox', { name: /საგნის კურსი/ }), id(610)),
    () => choose(page.getByRole('combobox', { name: /სემესტრი/ }), id(12)),
    () => page.getByRole('link', { name: 'დასწრება', exact: true }).click(),
  ]) {
    page.once('dialog', (d) => d.dismiss());
    await change();
    await expect(page.getByRole('combobox', { name: /საგნის კურსი/ })).toHaveAttribute(
      'value',
      originalCourse!,
    );
    await expect(page.getByRole('combobox', { name: /სემესტრი/ })).toHaveAttribute('value', id(11));
    await expect(panel.getByRole('spinbutton').first()).toHaveValue('9');
    expect(new URL(page.url()).pathname).toBe('/gradebook');
  }

  expect(
    (await (await page.request.get(`/api/gradebook/assessments/${assessmentId}`)).json()).entries[0]
      .value.kind,
  ).toBe('state');
  await panel.getByRole('button', { name: 'მონახაზის შენახვა', exact: true }).click();
  await expect(panel.getByText('პირადი მონახაზი', { exact: true })).toBeVisible();
  await panel.getByRole('spinbutton').first().fill('6');
  page.once('dialog', (d) => d.accept());
  await choose(page.getByRole('combobox', { name: /საგნის კურსი/ }), id(610));
  await expect(panel).toHaveCount(0);
  await page.goto(`/gradebook?course=${id(16000)}&assessment=${assessmentId}`);
  await expect(panel.getByRole('spinbutton').first()).toHaveValue('9');

  const founder = await browser.newContext();
  const fp = await founder.newPage();
  await fp.goto('/login');
  await fp.getByLabel('ელფოსტა', { exact: true }).fill('founder@attendance.demo.local');
  await fp.getByLabel('პაროლი', { exact: true }).fill('AiaDemo-2026!');
  await fp.getByRole('button', { name: 'სივრცეში შესვლა', exact: true }).click();
  await expect(fp.locator('.overview-heading')).toBeVisible();
  expect(
    (
      await founder.request.get(`${browserOrigin}/api/gradebook/assessments/${assessmentId}`)
    ).status(),
  ).toBe(404);
  await panel.getByRole('button', { name: 'გამოქვეყნება', exact: true }).click();
  await panel.getByRole('button', { name: 'დადასტურება და გამოქვეყნება' }).click();
  await expect(panel.getByText('გამოქვეყნებული', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'შესწორება', exact: true }).click();
  await panel.getByRole('spinbutton').first().fill('8');
  await expect(panel.getByRole('button', { name: 'შესწორების შენახვა' })).toBeDisabled();
  await panel.getByLabel('შესწორების მიზეზი', { exact: true }).fill('შეყვანის შეცდომა გასწორდა');
  await panel.getByRole('button', { name: 'შესწორების შენახვა' }).click();
  await expect(panel.getByRole('button', { name: 'შესწორება', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'აღწერა / გაუქმება', exact: true }).click();
  await panel
    .getByRole('textbox', { name: 'დასახელება', exact: true })
    .fill('გადასაყრელი ცვლილება');
  page.once('dialog', (d) => d.dismiss());
  await panel.getByRole('button', { name: 'აღწერა / გაუქმება', exact: true }).click();
  await expect(panel.getByRole('textbox', { name: 'დასახელება', exact: true })).toHaveValue(
    'გადასაყრელი ცვლილება',
  );
  page.once('dialog', (d) => d.accept());
  await panel.getByRole('button', { name: 'აღწერა / გაუქმება', exact: true }).click();
  await panel.getByRole('button', { name: 'აღწერა / გაუქმება', exact: true }).click();
  await expect(panel.getByRole('textbox', { name: 'დასახელება', exact: true })).toHaveValue(
    'სატესტო ტექსტის გააზრება',
  );
  const longTitle =
    'ტექსტის გააზრება და არგუმენტირებული მსჯელობა — მოსწავლის დამოუკიდებელი დასკვნის დასაბუთება';
  await panel.getByRole('textbox', { name: 'დასახელება', exact: true }).fill(longTitle);
  await expect(
    panel.getByRole('button', { name: 'დასაბუთებული ცვლილების შენახვა', exact: true }),
  ).toBeDisabled();
  await panel
    .getByRole('textbox', { name: 'ცვლილების დასაბუთება', exact: true })
    .fill('დასახელება დაზუსტდა შეფასების რეალური მიზნის შესაბამისად.');
  await panel.getByRole('button', { name: 'დასაბუთებული ცვლილების შენახვა', exact: true }).click();
  await expect(panel.getByRole('heading', { name: longTitle, exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'შესწორება', exact: true }).click();
  await panel.getByRole('spinbutton').first().fill('7');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.getByRole('spinbutton').first()).toHaveValue('7');
  await expect(panel.getByRole('spinbutton').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await panel.boundingBox())!.y).toBeLessThan(25);
  await page.screenshot({ path: testInfo.outputPath('teacher-mobile-roster.png') });
  await panel.getByRole('button', { name: 'გაუქმება', exact: true }).click();
  await panel.getByRole('button', { name: 'ჟურნალში დაბრუნება' }).click();
  await fp.goto(`/gradebook?course=${id(16000)}&assessment=${assessmentId}`);
  await expect(fp.locator('.gb-entry-row')).toHaveCount(20);
  await expect(fp.getByRole('button', { name: 'შესწორება', exact: true })).toHaveCount(0);
  const detail = await (
    await founder.request.get(`${browserOrigin}/api/gradebook/assessments/${assessmentId}`)
  ).json();
  expect(
    (
      await founder.request.post(`${browserOrigin}/api/gradebook/actions`, {
        headers: { origin: browserOrigin },
        data: {
          action: 'assessment.correct',
          commandId: crypto.randomUUID(),
          id: assessmentId,
          revision: detail.revision,
          entries: detail.entries,
          reason: 'დაუშვებელი ცვლილება',
        },
      })
    ).status(),
  ).toBe(403);
  await founder.close();
  await settle(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'გასვლა', exact: true }).click();
  await page.getByRole('button', { name: 'მოსწავლე', exact: true }).click();
  await expect(page.locator('.overview-heading')).toBeVisible();
  await page.goto('/gradebook');
  await expect(page.locator('.gb-family-history')).toBeVisible();
  expect(
    (
      await page.request.get(
        `/api/gradebook/reports/distribution?yearId=${id(10)}&semesterId=${id(11)}&offeringId=${id(610)}`,
      )
    ).status(),
  ).toBe(403);
  await page.getByRole('button', { name: 'პროგრესი / ანგარიშები', exact: true }).click();
  await expect(page.locator('.gb-report-rows article')).toHaveCount(1);
});

test('written feedback resumes privately, publishes deliberately and preserves scoped correction history', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  await login(page, 'მასწავლებელი');
  await page.goto(`/gradebook?course=${id(610)}`);
  await page.getByRole('button', { name: 'წერილობითი უკუკავშირი', exact: true }).click();
  await page.getByRole('button', { name: 'ჩანაწერი', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await choose(dialog.getByRole('combobox', { name: 'მოსწავლე', exact: true }), id(200));
  const draftText = 'სატესტო უკუკავშირი — ტექსტის ანალიზი გაუმჯობესდა.';
  await dialog.getByLabel('აკადემიური კომენტარი', { exact: true }).fill(draftText);
  await dialog.getByRole('button', { name: 'მონახაზის შენახვა', exact: true }).click();
  await expect(dialog.getByText('მონახაზი შენახულია. ოჯახისთვის ჯერ არ ჩანს.')).toBeVisible();
  await dialog.getByRole('button', { name: 'დახურვა', exact: true }).click();
  let article = page.locator('.gb-writings > article').filter({ hasText: draftText });
  await article.getByRole('button', { name: 'გაგრძელება', exact: true }).click();
  dialog = page.getByRole('dialog');
  const editedText = 'სატესტო უკუკავშირი — ტექსტის ანალიზი და არგუმენტაცია გაუმჯობესდა.';
  await dialog.getByRole('textbox', { name: 'აკადემიური ჩანაწერი', exact: true }).fill(editedText);
  await dialog.getByRole('button', { name: 'მონახაზის შენახვა', exact: true }).click();
  article = page.locator('.gb-writings > article').filter({ hasText: editedText });
  await article.getByRole('button', { name: 'გაგრძელება', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'გამოქვეყნება', exact: true }).click();
  await article.getByRole('button', { name: 'დეტალები / ისტორია', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'შესწორება', exact: true }).click();
  await dialog
    .getByRole('textbox', { name: 'აკადემიური ჩანაწერი', exact: true })
    .fill('სატესტო უკუკავშირი — დამატებითი სავარჯიშო რეკომენდებულია.');
  await dialog
    .getByLabel('შესწორების მიზეზი', { exact: true })
    .fill('მხოლოდ თანამშრომლის შიდა მიზეზი');
  await dialog.getByRole('button', { name: 'შესწორების შენახვა', exact: true }).click();
  article = page
    .locator('.gb-writings > article')
    .filter({ hasText: 'სატესტო უკუკავშირი — დამატებითი' });
  await article.getByRole('button', { name: 'დეტალები / ისტორია', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByText('მხოლოდ თანამშრომლის შიდა მიზეზი', { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('writing-history.png') });
  const published = (
    await (await page.request.get(`/api/gradebook/writings?yearId=${id(10)}`)).json()
  ).find(
    (w: { body: string }) => w.body === 'სატესტო უკუკავშირი — დამატებითი სავარჯიშო რეკომენდებულია.',
  );
  const family = await browser.newContext();
  const parent = await family.newPage();
  await login(parent, 'მშობელი');
  await parent.goto('/gradebook');
  await parent.getByRole('button', { name: 'აკადემიური ჩანაწერები', exact: true }).click();
  await parent
    .locator('.gb-writings > article')
    .filter({ hasText: 'სატესტო უკუკავშირი — დამატებითი' })
    .getByRole('button', { name: 'დეტალები / ისტორია', exact: true })
    .click();
  await expect(
    parent.getByRole('dialog').getByRole('button', { name: 'შესწორება', exact: true }),
  ).toHaveCount(0);
  const history = await (
    await parent.request.get(`/api/gradebook/writings/${published.id}/history`)
  ).json();
  expect(history).toHaveLength(2);
  expect(history.every((h: { reason: unknown }) => h.reason === null)).toBe(true);
  await family.close();
});

test('student extension, administrative decision, teacher recovery and versioned private criteria', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(240000);
  await login(page, 'მოსწავლე');
  const view = await (
    await page.request.get(
      `/api/gradebook/journal?yearId=${id(10)}&semesterId=${id(11)}&offeringId=${id(610)}`,
    )
  ).json();
  const missed = view.items.find(
    (a: { title: string }) => a.title === 'შემაჯამებელი · წერითი დავალება',
  );
  await page.goto(`/gradebook?course=${id(610)}&assessment=${missed.id}`);
  await page.getByRole('button', { name: 'დამატებითი ვადის მოთხოვნა', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'მოთხოვნის მიზეზი', exact: true })
    .fill('სატესტო მოთხოვნა შემაჯამებლის დამატებით აღდგენაზე.');
  await page.getByRole('button', { name: 'მოთხოვნის გაგზავნა', exact: true }).click();
  await expect(page.getByRole('complementary').getByText(/განხილვის მოლოდინში/)).toBeVisible();
  const administration = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const admin = await administration.newPage();
  await login(admin, 'დირექტორი');
  await admin.goto('/gradebook');
  await expect(
    admin.getByRole('heading', { name: 'კურსების სამუშაო მდგომარეობა', exact: true }),
  ).toBeVisible();
  await admin.screenshot({ path: testInfo.outputPath('admin-overview-light.png') });
  await admin.getByRole('button', { name: 'აღდგენა', exact: true }).click();
  const request = admin
    .locator('.gb-queue article')
    .filter({ hasText: 'შემაჯამებელი · წერითი დავალება' });
  await request.getByRole('button', { name: 'განხილვა', exact: true }).click();
  let dialog = admin.getByRole('dialog');
  await choose(dialog.getByRole('combobox', { name: 'გადაწყვეტილება', exact: true }), 'approved');
  await dialog
    .getByRole('checkbox', { name: 'პირადი / ოფლაინ განხილვა შედგა', exact: true })
    .check();
  await dialog.getByLabel('დამატებითი ვადა', { exact: true }).fill('2026-10-09');
  await dialog
    .getByRole('textbox', { name: 'დასაბუთება', exact: true })
    .fill('პირადი განხილვა შედგა; შეთანხმებულია ახალი ვადა.');
  await dialog.getByRole('button', { name: 'გადაწყვეტილების შენახვა', exact: true }).click();
  await expect(request.getByText(/დამტკიცებული/)).toBeVisible();
  await admin.getByRole('button', { name: 'მუქი რეჟიმი', exact: true }).click();
  await admin.screenshot({ path: testInfo.outputPath('admin-recovery-dark.png') });
  await admin.getByRole('button', { name: 'წესები / კრიტერიუმები', exact: true }).click();
  await choose(admin.getByRole('combobox', { name: /საგნის კურსი/ }), id(610));
  await admin.getByRole('button', { name: 'ახალი ვერსია', exact: true }).click();
  dialog = admin.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: 'კრიტერიუმები', exact: true })
    .fill('სატესტო ახალი კრიტერიუმი: მსჯელობა, ტექსტის გაგება და არგუმენტაცია.');
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'კრიტერიუმი.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'),
  });
  await dialog
    .getByRole('textbox', { name: 'დამტკიცების საფუძველი', exact: true })
    .fill('სატესტო აკადემიური განხილვა და ახალი რედაქცია.');
  await dialog.getByRole('button', { name: 'კრიტერიუმის დამტკიცება', exact: true }).click();
  await expect(
    admin.locator('.gb-criteria-version').filter({ hasText: 'სატესტო ახალი კრიტერიუმი' }),
  ).toBeVisible();
  const versions = await (
    await admin.request.get(`/api/gradebook/criteria?yearId=${id(10)}&subjectId=${id(600)}`)
  ).json();
  const latest = versions.find((v: { text: string }) =>
    v.text.startsWith('სატესტო ახალი კრიტერიუმი'),
  );
  expect((await admin.request.get(`/api/gradebook/criteria/files/${latest.fileId}`)).status()).toBe(
    200,
  );
  expect((await page.request.get(`/api/gradebook/criteria/files/${latest.fileId}`)).status()).toBe(
    404,
  );
  const old = await (await admin.request.get(`/api/gradebook/assessments/${missed.id}`)).json();
  expect(old.criteriaId).not.toBe(latest.id);
  const teaching = await browser.newContext();
  const teacher = await teaching.newPage();
  await login(teacher, 'მასწავლებელი');
  await teacher.goto(`/gradebook?course=${id(610)}&assessment=${missed.id}`);
  const panel = teacher.getByRole('complementary', { name: 'შეფასების დეტალები' });
  await panel.getByRole('button', { name: 'შესწორება', exact: true }).click();
  const row = panel.locator('.gb-entry-row').filter({ hasText: 'AG-2601' });
  await choose(row.getByRole('combobox'), 'numeric');
  await row.getByRole('spinbutton').fill('9');
  await panel
    .getByRole('textbox', { name: 'შესწორების მიზეზი', exact: true })
    .fill('შემაჯამებელი აღდგა დამტკიცებულ დამატებით ვადაში.');
  await panel.getByRole('button', { name: 'შესწორების შენახვა', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'შესწორება', exact: true })).toBeVisible();
  const requests = await (
    await page.request.get(`/api/gradebook/recovery?yearId=${id(10)}`)
  ).json();
  expect(requests.find((r: { assessmentId: string }) => r.assessmentId === missed.id).status).toBe(
    'completed',
  );
  await teaching.close();
  await administration.close();
});

test('Grade V formative homework, homeroom-only subject view and family report controls', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  await login(page, 'მასწავლებელი');
  await page.goto(`/gradebook?course=${id(16200)}`);
  await choose(page.getByRole('combobox', { name: 'სემესტრი', exact: true }), id(12));
  await page.getByRole('button', { name: 'შეფასება', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('დასახელება', { exact: true })
    .fill('V კლასი · საშინაოს განმავითარებელი უკუკავშირი');
  await dialog.getByLabel('თარიღი', { exact: true }).fill('2027-02-02');
  await choose(dialog.getByRole('combobox', { name: 'კატეგორია', exact: true }), 'homework');
  await expect(dialog.getByRole('checkbox')).toBeChecked();
  await expect(dialog.getByRole('checkbox')).toBeDisabled();
  await dialog.getByRole('button', { name: 'მონახაზის შექმნა', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'შეფასების დეტალები' });
  await expect(panel.locator('.gb-entry-row')).toHaveCount(6);
  await choose(panel.locator('.gb-result-control [role="combobox"]').first(), 'formative');
  await panel
    .getByRole('textbox')
    .first()
    .fill('აზრი გამართულად ჩამოაყალიბა; შემდეგ დაამატოს მაგალითები.');
  await expect(panel.getByRole('spinbutton')).toHaveCount(0);
  await panel.getByRole('button', { name: 'მონახაზის შენახვა', exact: true }).click();
  await expect(panel.getByText('პირადი მონახაზი', { exact: true })).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'გასვლა', exact: true }).click();
  await page.getByLabel('ელფოსტა', { exact: true }).fill('homeroom@gradebook.demo.local');
  await page.getByLabel('პაროლი', { exact: true }).fill('AiaDemo-2026!');
  // The custom homeroom account uses the same real sign-in budget as demo buttons.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-in/email'));
    await page.getByRole('button', { name: 'სივრცეში შესვლა', exact: true }).click();
    const result = await response;
    if (result.status() !== 429) {
      expect(result.ok(), await result.text()).toBe(true);
      break;
    }
    const seconds = Number(
      result.headers()['x-retry-after'] ?? result.headers()['retry-after'] ?? 60,
    );
    await page.waitForTimeout((seconds + 1) * 1000);
  }
  await expect(page.locator('.overview-heading')).toBeVisible();
  await page.goto(`/gradebook?course=${id(611)}`);
  await expect(page.getByRole('combobox', { name: /საგნის კურსი/ })).toHaveAttribute(
    'value',
    id(611),
  );
  await expect(page.getByRole('button', { name: 'შეფასება', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'წერილობითი უკუკავშირი', exact: true }).click();
  await page.getByRole('button', { name: 'ჩანაწერი', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('combobox', { name: 'ჩანაწერის ტიპი', exact: true }),
  ).toHaveAttribute('value', 'homeroom_note');
  await dialog.getByRole('combobox', { name: 'მოსწავლე', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).not.toBeVisible();
  await dialog.getByRole('button', { name: 'დახურვა', exact: true }).click();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const parent = await context.newPage();
  await login(parent, 'მშობელი');
  await parent.goto('/gradebook');
  await parent.getByRole('combobox', { name: 'მოსწავლე', exact: true }).click();
  await expect(parent.getByRole('option')).toHaveCount(3);
  await parent.keyboard.press('Escape');
  await expect(parent.getByRole('listbox')).not.toBeVisible();
  await choose(parent.getByRole('combobox', { name: 'მოსწავლე', exact: true }), id(200));
  await parent.getByRole('button', { name: 'პროგრესი / ანგარიშები', exact: true }).click();
  await expect(parent.locator('.gb-report-rows article')).toHaveCount(1);
  await expect(parent.getByText(/ზუსტი საშუალო:/)).toBeVisible();
  expect(await parent.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await parent.screenshot({ path: testInfo.outputPath('guardian-progress-mobile.png') });
  const report = await parent.request.get(
    `/api/gradebook/reports/progress?yearId=${id(10)}&semesterId=${id(11)}&offeringId=${id(16000)}&studentId=${id(13000)}`,
  );
  expect([403, 404]).toContain(report.status());
  await context.close();
});
