import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Activate an interview button with the keyboard. Linux WebKit's iPhone emulation can
 * report a scrolled-into-view button as "outside of the viewport" for mouse clicks;
 * focus + Enter is a real user path and works on every project.
 */
async function press(page: Page, name: RegExp) {
  await page.getByRole('button', { name }).focus();
  await page.keyboard.press('Enter');
}

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
      await press(page, /submit answer/i);
      const next = page.getByRole('button', { name: /continue to next|view your report/i });
      await expect(next).toBeVisible({ timeout: 15000 });
      const isLast = /view your report/i.test((await next.textContent()) ?? '');
      await press(page, /continue to next|view your report/i);
      if (isLast) break;
    }

    await expect(page).toHaveURL(/\/report/);
    await expect(page.getByRole('button', { name: /print/i })).toBeVisible({ timeout: 15000 });
    await expectNoAxeViolations(page);
  });

  // Regression (design §7.6, Req 8.1): a successful confirmation from the Tailor tab shows
  // no error, one score update, and the keyword as confirmed rather than as a gap.
  test('tailor: add a skill, confirm a missing keyword, no error and one score update', async ({
    page,
  }) => {
    let posts = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/confirmations$/.test(r.url())) posts++;
    });
    await page.goto('/');
    await page
      .getByRole('main')
      .getByRole('link', { name: /try the demo/i })
      .click();
    await expect(page.getByRole('heading', { name: /your analysis/i })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('tab', { name: 'Tailor resume' }).click();
    await page.getByRole('button', { name: 'Add REST APIs to Skills' }).click();
    // Req 14.6: the button that appears after adding a skill stays inside its card. At 375px
    // it used to overflow, which made Linux WebKit repaint every frame and time out.
    const view = page.getByRole('button', { name: 'View and download the tailored resume' });
    expect(
      await view.evaluate((b) => b.parentElement!.scrollWidth - b.parentElement!.clientWidth),
      'card overflow (px)',
    ).toBeLessThanOrEqual(0);

    const row = page
      .getByRole('listitem')
      .filter({ hasText: 'Kubernetes' })
      .filter({ hasText: 'Not shown' });
    await row.getByRole('button', { name: /i have this experience/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('textbox')
      .fill('I containerized three services with Docker and ran them on a k3s cluster.');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Save confirmation' }).click();

    await expect(dialog).toBeHidden();
    // Exact match: the Radix toast's aria-live announcer briefly repeats the text with a prefix.
    await expect(
      page.getByText('You confirmed Kubernetes and containers experience.', { exact: true }),
    ).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(row.getByText('Confirmed by you')).toBeVisible();
    await expect(row.getByText('Gap: prepare to discuss it')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Remove REST APIs from Skills' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(posts).toBe(1);
    await expectNoAxeViolations(page);
  });

  test('report → practice again → answer → report updates', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/demo');
    await page.getByRole('button', { name: /start interview/i }).click();
    for (let i = 0; i < 10 && !/\/report/.test(page.url()); i++) {
      await page.getByRole('tab', { name: /type/i }).click();
      await page.getByPlaceholder(/type your answer/i).fill('I did some work on a project.');
      await press(page, /submit answer/i);
      const next = page.getByRole('button', { name: /continue to next|view your report/i });
      await expect(next).toBeVisible({ timeout: 15000 });
      const isLast = /view your report/i.test((await next.textContent()) ?? '');
      await press(page, /continue to next|view your report/i);
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
    await press(page, /submit answer/i);
    await press(page, /view your report/i);
    await expect(page).toHaveURL(/\/report/);
    await expect(page.getByRole('button', { name: /print/i })).toBeVisible({ timeout: 15000 });
  });
});
