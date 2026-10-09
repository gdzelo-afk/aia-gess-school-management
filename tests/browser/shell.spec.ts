import { signIn } from './sign-in';
import { test, expect } from '@playwright/test';
async function login(page: import('@playwright/test').Page, role = 'დირექტორი') {
  await page.goto('/');
  await signIn(page, role);
}
test('director shell, table, command search, theme, preferences and calendar', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await login(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ka');
  await expect(page.locator('.overview-heading time')).toContainText(
    /ორშაბათი|სამშაბათი|ოთხშაბათი|ხუთშაბათი|პარასკევი|შაბათი|კვირა/,
  );
  await page.evaluate(() => document.fonts.ready);
  const order = await page.evaluate(() => {
    const rhythm = document.querySelector('.overview-rhythm')!;
    const lower = document.querySelector('.overview-bottom')!;
    const nav = document.querySelector('.sidebar nav')!;
    const term = document.querySelector('.sidebar-term')!;
    return {
      rhythmBeforeLower: Boolean(
        rhythm.compareDocumentPosition(lower) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      termAfterNav: nav.nextElementSibling === term,
    };
  });
  expect(order).toEqual({ rhythmBeforeLower: true, termAfterNav: true });
  await expect(page.locator('.sidebar-term')).toContainText('I სემესტრი');
  const progress = page.locator('.semester-progress');
  await expect(progress).toBeVisible();
  const value = await progress.evaluate((el) => (el as HTMLProgressElement).value);
  expect(value).toBeGreaterThan(0);
  expect(value).toBeLessThan(100);
  const configured = await (await page.request.get('/api/academics')).json();
  const term = configured.semesters[0];
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(
    new Date(),
  );
  expect(value).toBeCloseTo(
    ((Date.parse(localDate) - Date.parse(term.startsOn)) /
      (Date.parse(term.endsOn) - Date.parse(term.startsOn))) *
      100,
  );
  await expect(page.locator('.school-note')).toHaveCount(0);
  await expect(page.locator('.overview-distribution')).toContainText('მოსწავლეთა განაწილება');
  await page.locator('.overview-next-meeting').getByRole('button', { name: 'დეტალები' }).click();
  await expect(page.getByRole('dialog')).toContainText('აკადემიური გუნდის შეხვედრა');
  await expect(page.getByRole('dialog')).toContainText('11:30');
  await page.keyboard.press('Escape');
  await expect(page.locator('.overview-rhythm')).toContainText('გამოქვეყნებული განრიგი');
  await page.locator('.overview-rhythm').getByRole('link', { name: 'განრიგის გახსნა' }).click();
  await expect(
    page.getByRole('heading', { name: 'გაკვეთილების განრიგი', exact: true }),
  ).toBeVisible();
  await page.goto('/');
  await page.clock.setFixedTime(new Date('2026-09-28T13:22:59Z'));
  const clock = page.locator('.tbilisi-clock time');
  await expect(clock).toHaveText('17:22:59');
  const before = await clock.boundingBox();
  await page.clock.setFixedTime(new Date('2026-09-28T13:23:00Z'));
  await expect(clock).toHaveText('17:23:00');
  const after = await clock.boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.x).toBe(before?.x);
  await page.clock.setFixedTime(new Date());
  await page.screenshot({ path: 'test-results/dashboard-light.png', fullPage: true });
  await page.getByRole('button', { name: 'მუქი რეჟიმი', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/dashboard-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'ღია რეჟიმი', exact: true }).click();
  await page.getByRole('link', { name: 'მოსწავლეები', exact: true }).click();
  await expect(page.getByRole('button', { name: 'შემდეგი გვერდი' })).toBeEnabled();
  await page.getByRole('button', { name: 'შემდეგი გვერდი' }).click();
  await expect(page.getByText('7–12 / 44 ჩანაწერი')).toBeVisible();
  await page.getByRole('textbox', { name: 'მოსწავლის ძიება' }).fill('მაისურაძე');
  await expect(page.getByText('1–2 / 2 ჩანაწერი')).toBeVisible();
  await page.getByRole('textbox', { name: 'მოსწავლის ძიება' }).fill('არარსებული');
  await expect(page.getByRole('heading', { name: 'ჩანაწერი ვერ მოიძებნა' })).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'საძიებო სიტყვა' }).fill('კალენდარი');
  await page.getByRole('dialog').getByRole('button', { name: 'კალენდარი', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'კალენდარი', exact: true })).toBeVisible();
  await expect(page.getByLabel('სასწავლო წლის არჩევა')).toContainText('2026–2027');
  await expect(page.locator('.op-record-list')).toContainText('არდადეგები');
  await page.getByRole('link', { name: 'პარამეტრები', exact: true }).click();
  await page.getByRole('switch', { name: /კომპაქტური ცხრილები/ }).check();
  await page.getByRole('button', { name: 'ცვლილებების შენახვა' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
});
test('parent and student receive distinct scopes and screens', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, 'მშობელი');
  await expect(page.getByRole('button', { name: /ანდრია მაისურაძე/ })).toBeVisible();
  await page.getByRole('button', { name: /ელენე მაისურაძე/ }).click();
  await expect(
    page.getByRole('heading', { name: 'ელენე მაისურაძე — მოკლე მიმოხილვა' }),
  ).toBeVisible();
  const childTarget = await page
    .getByRole('link', { name: 'დღის განრიგი', exact: true })
    .getAttribute('href');
  expect(childTarget).toContain('studentId=');
  await page.getByRole('link', { name: 'დღის განრიგი', exact: true }).click();
  await expect(page.getByLabel('შვილის განრიგი')).toHaveAttribute(
    'value',
    new URL(childTarget!, 'http://local').searchParams.get('studentId')!,
  );
  await expect(page.getByLabel('შვილის განრიგი')).toHaveText('ელენე მაისურაძე');
  await page.getByRole('link', { name: 'ჩემი ოჯახი', exact: true }).click();
  await page.getByRole('button', { name: /ანდრია მაისურაძე/ }).click();
  await expect(
    page.getByRole('heading', { name: 'ანდრია მაისურაძე — მოკლე მიმოხილვა' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'მოსწავლის მიმოხილვა', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'ანდრია მაისურაძე' }),
  ).toBeVisible();
  await expect(page.getByText('გადასახადის მაგალითი')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'გასვლა', exact: true }).click();
  await signIn(page, 'მოსწავლე');
  await expect(page.getByRole('heading', { name: 'დღის სასწავლო გეგმა' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ფინანსები', exact: true })).toHaveCount(0);
});
test('mobile drawer, dialog keyboard and responsive layout', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('სკოლის დღე, ერთ სივრცეში.');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
  await login(page, 'მასწავლებელი');
  const aside = await page.locator('.dashboard-aside').boundingBox();
  const agenda = await page.locator('.overview-next-meeting').boundingBox();
  expect(aside).not.toBeNull();
  expect(agenda).not.toBeNull();
  expect(agenda!.width).toBeCloseTo(aside!.width, 0);
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'მენიუს გახსნა' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const drawer = await dialog.boundingBox();
  expect(drawer).not.toBeNull();
  expect(drawer!.y).toBe(0);
  expect(drawer!.height).toBe(844);
  await page.screenshot({ path: 'test-results/mobile-menu.png' });
  await dialog.getByRole('link', { name: 'მოსწავლეები', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('1–6 / 34 ჩანაწერი')).toBeVisible();
  await page.getByRole('button', { name: 'შეტყობინებების გახსნა' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
