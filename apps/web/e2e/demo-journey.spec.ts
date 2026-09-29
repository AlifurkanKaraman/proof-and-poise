import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Demo journey e2e (Task 22, Req 14): landing → demo → analysis workspace.
 * Interview and report screens are added when tasks 15 and 19 land.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

test.describe('Demo journey', () => {
  test('landing → demo → analysis with accessibility checks', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);

    await page
      .getByRole('main')
      .getByRole('link', { name: /try the demo/i })
      .click();
    await expect(page).toHaveURL(/\/s\/[^/]+\/analysis/);

    await expect(page.getByRole('heading', { name: /your analysis/i })).toBeVisible({
      timeout: 15000,
    });
    await expectNoAxeViolations(page);

    for (const name of [/competencies/i, /recommendations/i, /keywords/i]) {
      await page.getByRole('tab', { name }).click();
      await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('landing CTAs are keyboard reachable with visible focus', async ({ page }) => {
    await page.goto('/');
    const demo = page.getByRole('main').getByRole('link', { name: /try the demo/i });
    await demo.focus();
    await expect(demo).toBeFocused();
    const outline = await demo.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('primary CTAs meet the 44px touch target', async ({ page }) => {
    await page.goto('/');
    for (const name of [/prepare for a job/i, /try the demo/i]) {
      const box = await page.getByRole('main').getByRole('link', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('reduced motion: page renders', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
