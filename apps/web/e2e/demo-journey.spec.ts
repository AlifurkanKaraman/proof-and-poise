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

  test('full demo: analysis → interview → report', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: /your analysis/i })).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole('button', { name: /start interview/i }).click();
    await expect(page).toHaveURL(/\/interview/);

    // Answer until the interview hands off to the report (5 questions + follow-ups).
    for (let i = 0; i < 10 && !/\/report/.test(page.url()); i++) {
      await page.getByRole('tab', { name: /type/i }).click();
      await page
        .getByPlaceholder(/type your answer/i)
        .fill(
          'I led a migration of our checkout service, cutting p95 latency by 35% across two quarters, and wrote the runbook the team still uses.',
        );
      await page.getByRole('button', { name: /submit answer/i }).click();
      const next = page.getByRole('button', { name: /continue to next|view your report/i });
      await expect(next).toBeVisible({ timeout: 15000 });
      const isLast = /view your report/i.test((await next.textContent()) ?? '');
      await next.click();
      if (isLast) break;
    }

    await expect(page).toHaveURL(/\/report/);
    await expect(page.getByRole('button', { name: /print/i })).toBeVisible({ timeout: 15000 });
    await expectNoAxeViolations(page);
  });

  test('report → practice again → answer → report updates', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/demo');
    await page.getByRole('button', { name: /start interview/i }).click();
    for (let i = 0; i < 10 && !/\/report/.test(page.url()); i++) {
      await page.getByRole('tab', { name: /type/i }).click();
      await page.getByPlaceholder(/type your answer/i).fill('I did some work on a project.');
      await page.getByRole('button', { name: /submit answer/i }).click();
      const next = page.getByRole('button', { name: /continue to next|view your report/i });
      await expect(next).toBeVisible({ timeout: 15000 });
      const isLast = /view your report/i.test((await next.textContent()) ?? '');
      await next.click();
      if (isLast) break;
    }
    await expect(page).toHaveURL(/\/report/);

    // Open the first accordion that offers practice.
    const practice = page.getByRole('button', { name: /practice (this question )?again/i }).first();
    if (!(await practice.isVisible().catch(() => false))) {
      await page
        .getByRole('button', { name: /question/i })
        .first()
        .click();
    }
    await expect(practice).toBeVisible({ timeout: 10000 });
    await practice.click();

    await expect(page).toHaveURL(/\/interview$/);
    await expect(page.getByText(/practice/i).first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('tab', { name: /type/i }).click();
    await page
      .getByPlaceholder(/type your answer/i)
      .fill('At Acme I led a migration, cutting p95 latency by 35% across two quarters.');
    await page.getByRole('button', { name: /submit answer/i }).click();
    await page.getByRole('button', { name: /view your report/i }).click();
    await expect(page).toHaveURL(/\/report/);
    await expect(page.getByRole('button', { name: /print/i })).toBeVisible({ timeout: 15000 });
  });
});
