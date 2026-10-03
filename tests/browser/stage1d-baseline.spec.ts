import { test, expect } from '@playwright/test';

test('family attendance retains accurate status icons and one page landmark', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'მშობელი', exact: true }).click();
  await expect(page.locator('.overview-heading')).toBeVisible();
  await page.goto('/attendance?date=2026-09-22');
  await expect(page.locator('.att-calendar')).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(1);
  const absence = page.locator('.att-lesson-state').filter({ hasText: 'არ ესწრება' });
  await expect(absence.first()).toBeVisible();
  await expect(absence.locator('.lucide-check')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
