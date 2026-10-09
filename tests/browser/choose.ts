import { expect, type Locator } from '@playwright/test';
/** Select through the real pointer interaction, preserving existing value-based domain fixtures. */
export async function choose(control: Locator, selection: string | { label: string }) {
  const label =
    typeof selection === 'string'
      ? await control.evaluate((element, value) => {
          const native = element.closest('.ux-select')?.querySelector('select');
          return Array.from(native?.options ?? [])
            .find((option) => option.value === value)
            ?.textContent?.trim();
        }, selection)
      : selection.label;
  expect(label, 'the requested domain option exists').toBeTruthy();
  await control.click();
  const option = control.page().getByRole('option', { name: label!, exact: true });
  await option.click();
  await expect(control.page().getByRole('listbox')).not.toBeVisible();
}
