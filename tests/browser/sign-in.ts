import { setTimeout } from 'node:timers/promises';
import { expect, type Page } from '@playwright/test';
/** Uses the real sign-in UI; retry only throttling and only after the server's reset. */
export async function signIn(page: Page, role: string) {
  // A preceding workflow can consume the shared API budget even when the
  // separate sign-in endpoint still accepts requests. Leave room for bootstrap
  // and Dashboard reads, then reload only after a genuine budget reset. This
  // also recovers a /api/me 429 that happened before this helper was called.
  const budget = await page.request.get('/api/health');
  expect([200, 429]).toContain(budget.status());
  if (budget.status() === 429 || Number(budget.headers()['x-ratelimit-remaining'] ?? 180) < 35) {
    const seconds = Number(
      budget.headers()['retry-after'] ?? budget.headers()['x-ratelimit-reset'] ?? 60,
    );
    await setTimeout((seconds + 1) * 1000);
    await page.reload();
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-in/email'));
    await page.getByRole('button', { name: role, exact: true }).click();
    const result = await response;
    if (result.status() !== 429) {
      expect(result.ok(), await result.text()).toBe(true);
      await expect(page.locator('.overview-heading')).toBeVisible();
      return;
    }
    const seconds = Number(
      result.headers()['x-retry-after'] ?? result.headers()['retry-after'] ?? 60,
    );
    await page.waitForTimeout((seconds + 1) * 1000);
  }
  throw new Error('Sign-in remained throttled after the server reset');
}
