import { expect, type Page } from '@playwright/test';
/** Uses the real sign-in UI; retry only throttling and only after the server's reset. */
export async function signIn(page: Page, role: string) {
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
