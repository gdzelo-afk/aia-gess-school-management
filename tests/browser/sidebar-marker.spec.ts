import { test, expect } from '@playwright/test';
import { signIn } from './sign-in';

test('expanded sidebar markers fade without changing shape between destinations', async ({
  page,
}) => {
  test.setTimeout(120_000); // Includes the real shared API/authentication reset.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await signIn(page, 'დირექტორი');
  await page.evaluate(() => document.fonts.ready);
  const sidebar = page.locator('.sidebar');
  for (const theme of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page
        .getByRole('button', { name: theme === 'light' ? 'ღია რეჟიმი' : 'მუქი რეჟიმი' })
        .click();
    await sidebar.getByRole('link', { name: 'სასწავლო პროცესი', exact: true }).click();
    await expect(sidebar.locator('.nav-link.active')).toHaveAttribute('href', '/academics');
    await page.waitForTimeout(200);
    // Observe real animation frames, not only the settled state. The old scale
    // transition passed static screenshots but shortened the expanded marker.
    const sampling = page.evaluate(
      () =>
        new Promise<{ opacity: number; x: number; y: number; width: number; height: number }[][]>(
          (resolve) => {
            const markers = ['/academics', '/students'].map((href) =>
              document.querySelector(`.sidebar a[href="${href}"] .nav-current`)!,
            );
            const samples: {
              opacity: number;
              x: number;
              y: number;
              width: number;
              height: number;
            }[][] = [];
            const start = performance.now();
            function sample() {
              samples.push(
                markers.map((marker) => {
                  const { x, y, width, height } = marker.getBoundingClientRect();
                  return { opacity: Number(getComputedStyle(marker).opacity), x, y, width, height };
                }),
              );
              if (performance.now() - start < 600) requestAnimationFrame(sample);
              else resolve(samples);
            }
            requestAnimationFrame(sample);
          },
        ),
    );
    await sidebar.getByRole('link', { name: 'მოსწავლეები', exact: true }).click();
    const samples = await sampling;
    expect(samples.some((frame) => frame.some(({ opacity }) => opacity > 0 && opacity < 1))).toBe(
      true,
    );
    for (const frame of samples) {
      for (let i = 0; i < frame.length; i++) {
        for (const dimension of ['x', 'y', 'width', 'height'] as const)
          expect(frame[i]![dimension]).toBe(samples[0]![i]![dimension]);
      }
    }
    expect(samples.at(-1)!.map(({ opacity }) => opacity)).toEqual([0, 1]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await sidebar.getByRole('link', { name: 'სასწავლო პროცესი', exact: true }).click();
  await expect(sidebar.locator('.nav-link.active')).toHaveAttribute('href', '/academics');
  expect(
    await sidebar.locator('.nav-link.active .nav-current').evaluate((marker) => ({
      opacity: getComputedStyle(marker).opacity,
      duration: getComputedStyle(marker).transitionDuration,
    })),
  ).toEqual({ opacity: '1', duration: '0s' });
});
