import { browserOrigin } from '../../scripts/browser/environment';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { schoolDateAt } from '../../shared/attendance';
const shiftDate = (date: string, n: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: role, exact: true }).click();
  await expect(page.locator('.overview-heading')).toBeVisible();
}
async function action(context: BrowserContext, url: string, body: unknown) {
  const r = await context.request.post(url, {
    headers: { origin: browserOrigin },
    data: body,
  });
  expect(r.status(), await r.text()).toBe(200);
  return r.json();
}
async function budget(page: Page) {
  const r = await page.request.get('/api/health');
  if (r.status() === 429 || Number(r.headers()['x-ratelimit-remaining']) < 35)
    await page.waitForTimeout(
      (Number(r.headers()['retry-after'] ?? r.headers()['x-ratelimit-reset'] ?? 60) + 1) * 1000,
    );
}
const lessonUrl = (occurrenceId: string, date: string) =>
  `/attendance?date=${date}&lesson=${encodeURIComponent(occurrenceId)}`;
test('attendance teacher roll call, family explanations, administrative corrections and read-only oversight', async ({
  browser,
  page,
}) => {
  test.setTimeout(360000);
  page.setDefaultTimeout(15000);
  // This suite follows the two long write journeys; respect the shared real auth budget.
  await page.waitForTimeout(62000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, 'დირექტორი');
  const admin = page.context();
  const today = schoolDateAt(new Date());
  // The expanded demo has a newer publication from October 5. Resolve the
  // actual active version; historical checks below intentionally retain the old one.
  const setupResponse = await page.request.get('/api/timetable/setup');
  expect(setupResponse.ok()).toBe(true);
  const setup = await setupResponse.json();
  const version = setup.versions.find(
    (v: { status: string; startsOn: string; endsOn: string }) =>
      v.status === 'published' && v.startsOn <= today && today < v.endsOn,
  );
  expect(version).toBeTruthy();
  const versionId = version.id;
  // On a non-weekday template creates an explicit exceptional occurrence.
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
  const lessonId = id(1500 + (weekday <= 5 ? weekday : 1));
  const templateResponse = await page.request.get(
    `/api/timetable/template?versionId=${versionId}&lessonId=${lessonId}&date=${today}`,
  );
  expect(templateResponse.ok(), await templateResponse.text()).toBe(true);
  const template = await templateResponse.json();
  const time = (delta: number) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tbilisi',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(Date.now() + delta * 60000));
  const move = {
    date: today,
    occurrenceId: template.id,
    expectedRevision: template.revision,
    cancelled: false,
    teacherId: id(2),
    roomId: id(1300),
    groupId: id(1410),
    periodId: id(1400),
    start: time(10),
    end: time(55),
    targetDate: today,
    exceptionalDay: true,
  };
  await action(admin, '/api/timetable/actions', {
    action: 'exception.apply',
    changes: [move],
    reason: 'დასწრების იზოლირებული ბრაუზერის შემოწმება',
    overrides: [],
  });
  const teacherContext = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    teacher = await teacherContext.newPage();
  teacher.on('pageerror', (e) => errors.push(e.message));
  await login(teacher, 'მასწავლებელი');
  await teacher.goto(lessonUrl(template.id, today));
  await expect(teacher.locator('.att-state-line')).toContainText('ჯერ არ დაწყებულა');
  await expect(teacher.getByRole('button', { name: 'ყველა ესწრება', exact: true })).toHaveCount(0);
  const refreshed = await (
    await page.request.get(
      `/api/timetable/template?versionId=${versionId}&lessonId=${lessonId}&date=${today}`,
    )
  ).json();
  await action(admin, '/api/timetable/actions', {
    action: 'exception.apply',
    changes: [{ ...move, expectedRevision: refreshed.revision, start: time(-25), end: time(20) }],
    reason: 'გაკვეთილის ფაქტობრივი დროის სატესტო შესწორება',
    overrides: [],
  });
  await teacher.reload();
  await expect(teacher.locator('.att-unresolved')).toHaveCount(3);
  await teacher.getByRole('button', { name: 'ყველა ესწრება', exact: true }).click();
  const opened = await (
    await teacher.request.get(
      `/api/attendance/lesson?occurrenceId=${encodeURIComponent(template.id)}`,
    )
  ).json();
  expect(opened.revision).toBe(0);
  expect(opened.entries).toHaveLength(0);
  const pupils = teacher.locator('.att-pupil');
  await pupils.nth(0).getByRole('radio', { name: 'დაგვიანება', exact: true }).check();
  await pupils.nth(0).getByLabel('მოსვლის დრო').fill(time(-12));
  await expect(pupils.nth(0)).toContainText('≈ 13 წუთით');
  await pupils.nth(0).getByLabel('ადრე გასვლა', { exact: true }).check();
  await pupils.nth(0).getByLabel('გასვლის დრო').fill(time(-2));
  await pupils.nth(1).getByRole('radio', { name: 'არ ესწრება', exact: true }).check();
  await expect(teacher.locator('.att-state-line')).toContainText('შეუნახავი');
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await teacher.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await teacher.screenshot({
    path: 'test-results/attendance/mobile-rollcall-light.png',
    fullPage: true,
  });
  await teacher.getByRole('button', { name: 'დასწრების შენახვა', exact: true }).click();
  await expect(teacher.getByRole('button', { name: 'შესწორება', exact: true })).toBeVisible();
  await teacher.getByRole('button', { name: 'შესწორება', exact: true }).click();
  await expect(
    teacher.getByRole('button', { name: 'შესწორების შენახვა', exact: true }),
  ).toBeDisabled();
  await teacher.getByLabel('შესწორების / შევსების მიზეზი').fill('დასწრების დრო შემოწმებულია');
  await teacher.getByRole('button', { name: 'შესწორების შენახვა', exact: true }).click();
  await expect(teacher.locator('.att-history')).toContainText('მასწავლებლის შესწორება');
  await teacher.evaluate(() => localStorage.setItem('aia-theme', 'dark'));
  await teacher.reload();
  await expect(teacher.locator('.att-history')).toBeVisible();
  await teacher.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await teacher.screenshot({
    path: 'test-results/attendance/mobile-rollcall-dark.png',
    fullPage: true,
  });
  await teacher.goto('/attendance');
  await teacher.getByRole('tab', { name: /შესავსები/ }).click();
  await expect(teacher.locator('.att-list-heading')).toContainText('შესავსები გაკვეთილები');
  const parentContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    parent = await parentContext.newPage();
  await login(parent, 'მშობელი');
  await parent.goto('/attendance');
  await expect(parent.locator('.att-calendar')).toBeVisible();
  const childButtons = parent.locator('.att-family-switch button');
  await expect(childButtons).toHaveCount(2);
  await childButtons.nth(1).click();
  await expect(childButtons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await childButtons.nth(0).click();
  await parent.getByRole('button', { name: 'განმარტების დამატება', exact: true }).click();
  await parent.getByLabel('პირველი დღე').fill(shiftDate(today, 1));
  await parent.getByLabel('ბოლო დღე · ჩათვლით').fill(shiftDate(today, 2));
  await parent.getByLabel('მოკლე განმარტება').fill('სატესტო ოჯახური დაგეგმილი გაცდენის განმარტება');
  await parent.getByRole('button', { name: 'განმარტების გაგზავნა', exact: true }).click();
  await expect(parent.getByRole('dialog')).toBeHidden();
  await expect(parent.locator('.att-queue')).toContainText('განხილვის მოლოდინში');
  await page.goto('/attendance');
  await page.getByRole('tab', { name: 'განმარტებები', exact: true }).click();
  await page.locator('.att-queue button').filter({ hasText: 'განხილვის მოლოდინში' }).last().click();
  await page.getByLabel('გადაწყვეტილების მიზეზი').fill('ოჯახის მოთხოვნა ადმინისტრაციამ განიხილა');
  await page.getByRole('button', { name: 'დადასტურება', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await parent.reload();
  await parent.getByRole('tab', { name: 'განმარტებები', exact: true }).click();
  await expect(parent.locator('.att-queue')).toContainText('დადასტურებულია');
  expect(
    (await parent.request.get(`/api/attendance/range?from=${today}&studentId=${id(205)}`)).status(),
  ).toBe(404);
  await budget(page);
  await page.goto(lessonUrl(template.id, today));
  await page.getByRole('button', { name: 'შესწორება', exact: true }).click();
  await page
    .locator('.att-pupil')
    .nth(1)
    .getByRole('radio', { name: 'საპატიო გაცდენა', exact: true })
    .check();
  await page
    .getByLabel('შესწორების / შევსების მიზეზი')
    .fill('ადმინისტრაციული გადამოწმებით დადასტურებულია');
  await page.getByRole('button', { name: 'შესწორების შენახვა', exact: true }).click();
  await expect(page.locator('.att-history')).toContainText('ადმინისტრაციული შესწორება');
  const oldDate = '2026-09-21',
    oldId = `${id(1600)}:${id(1501)}:${oldDate}`;
  await teacher.goto(lessonUrl(oldId, oldDate));
  await teacher.getByRole('button', { name: 'შესწორების მოთხოვნა', exact: true }).click();
  await teacher
    .getByLabel('განუმარტეთ ადმინისტრაციას შესწორების მიზეზი')
    .fill('ისტორიული გაკვეთილის ჩანაწერის გადამოწმება');
  await teacher.getByRole('button', { name: 'მოთხოვნის გაგზავნა', exact: true }).click();
  await expect(
    teacher.getByRole('status').filter({ hasText: 'მოთხოვნა გაგზავნილია' }),
  ).toBeVisible();
  await page.goto('/attendance');
  await page.getByRole('tab', { name: 'შესწორებები', exact: true }).click();
  await page.locator('.att-queue button').filter({ hasText: 'განხილვის მოლოდინში' }).last().click();
  await expect(page.locator('.att-proposal li')).toHaveCount(3);
  await page.getByLabel('გადაწყვეტილების მიზეზი').fill('მოთხოვნის მონაცემები გადამოწმებულია');
  await page.getByRole('button', { name: 'დადასტურება', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await budget(page);
  // A second explanation exercises denial without changing any attendance.
  await parent.getByRole('button', { name: 'განმარტების დამატება', exact: true }).click();
  await parent.getByLabel('პირველი დღე').fill(shiftDate(today, 3));
  await parent.getByLabel('ბოლო დღე · ჩათვლით').fill(shiftDate(today, 3));
  await parent.getByLabel('მოკლე განმარტება').fill('სატესტო განმარტება დამატებითი დაზუსტებისთვის');
  await parent.getByRole('button', { name: 'განმარტების გაგზავნა', exact: true }).click();
  await expect(parent.getByRole('dialog')).toBeHidden();
  await page.getByRole('tab', { name: 'განმარტებები', exact: true }).click();
  await page.locator('.att-queue button').filter({ hasText: 'განხილვის მოლოდინში' }).last().click();
  await expect(page.getByRole('button', { name: 'უარყოფა', exact: true })).toBeDisabled();
  await page.getByLabel('გადაწყვეტილების მიზეზი').fill('მოთხოვნა დასაზუსტებელია ადმინისტრაციასთან');
  await page.getByRole('button', { name: 'უარყოფა', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await parent.reload();
  await parent.getByRole('tab', { name: 'განმარტებები', exact: true }).click();
  await expect(parent.locator('.att-queue')).toContainText('უარყოფილია');
  await page.getByRole('tab', { name: 'მოსწავლეები', exact: true }).click();
  await page.locator('.att-daily-list button').first().click();
  await expect(page.locator('.att-calendar')).toBeVisible();
  await expect(page.locator('.att-percentage')).toContainText('შეუვსებელი');
  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    student = await studentContext.newPage();
  await login(student, 'მოსწავლე');
  await student.goto('/attendance');
  await expect(student.locator('.att-calendar')).toBeVisible();
  await expect(
    student.getByRole('button', { name: 'განმარტების დამატება', exact: true }),
  ).toHaveCount(0);
  await student.goto(lessonUrl(template.id, today));
  await expect(student.locator('.att-pupil')).toHaveCount(1);
  await expect(student.getByRole('button', { name: 'შესწორება', exact: true })).toHaveCount(0);
  expect(
    (
      await student.request.get(`/api/attendance/range?from=${today}&studentId=${id(205)}`)
    ).status(),
  ).toBe(404);
  const founderContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    founder = await founderContext.newPage();
  await founder.goto('/login');
  await founder.getByLabel('ელფოსტა', { exact: true }).fill('founder@attendance.demo.local');
  await founder.getByLabel('პაროლი', { exact: true }).fill('AiaDemo-2026!');
  await founder.getByRole('button', { name: 'სივრცეში შესვლა', exact: true }).click();
  await expect(founder.locator('.overview-heading')).toBeVisible();
  await founder.goto('/attendance');
  await expect(founder.locator('.att-read-only')).toBeVisible();
  await expect(founder.getByRole('tab', { name: 'განმარტებები', exact: true })).toHaveCount(0);
  await expect(founder.getByRole('tab', { name: 'შესწორებები', exact: true })).toHaveCount(0);
  await founder.getByRole('tab', { name: 'ისტორია', exact: true }).click();
  await expect(founder.locator('.att-percentage')).toBeVisible();
  await founder.goto(lessonUrl(template.id, today));
  await expect(founder.getByRole('button', { name: 'შესწორება', exact: true })).toHaveCount(0);
  const read = await (
    await founder.request.get(
      `/api/attendance/lesson?occurrenceId=${encodeURIComponent(template.id)}`,
    )
  ).json();
  const denied = await founder.request.post('/api/attendance/actions', {
    headers: { origin: browserOrigin },
    data: {
      action: 'submit',
      commandId: crypto.randomUUID(),
      occurrenceId: template.id,
      expectedToken: read.expectedToken,
      revision: read.revision,
      entries: read.entries,
      reason: 'დაუშვებელი სატესტო ცვლილება',
    },
  });
  expect(denied.status()).toBe(403);
  await budget(page);
  await page.goto('/attendance');
  for (const theme of ['light', 'dark']) {
    await page.evaluate((v) => {
      localStorage.setItem('aia-theme', v);
      document.documentElement.dataset.theme = v;
    }, theme);
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `test-results/attendance/admin-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await parent.goto('/attendance');
  await parent.screenshot({ path: 'test-results/attendance/parent-history.png', fullPage: true });
  for (const [name, context] of [
    ['director', admin],
    ['teacher', teacherContext],
    ['parent', parentContext],
    ['student', studentContext],
    ['founder', founderContext],
  ] as const)
    await context.storageState({ path: `test-results/attendance/${name}-session.json` });
  expect(errors).toEqual([]);
  await Promise.all([
    teacherContext.close(),
    parentContext.close(),
    studentContext.close(),
    founderContext.close(),
  ]);
});
