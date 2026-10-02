import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Task 22 audit (Req 14.2-14.6, 14.9): every screen at 375/768/1280 for axe (incl. contrast),
 * horizontal overflow, 44px touch targets and keyboard focus visibility.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const WIDTHS = [375, 768, 1280] as const;

async function toAnalysis(page: Page) {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: /your analysis/i })).toBeVisible({
    timeout: 15000,
  });
}

async function toTab(page: Page, name: string) {
  await toAnalysis(page);
  const tab = page.getByRole('tab', { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function toInterview(page: Page) {
  await toAnalysis(page);
  await page.getByRole('button', { name: /start interview/i }).click();
  await expect(page).toHaveURL(/\/interview/);
  await expect(page.getByRole('tab', { name: /type/i })).toBeVisible();
}

/**
 * Activate a button with the keyboard. Linux WebKit's iPhone emulation can report a
 * scrolled-into-view button as "outside of the viewport" for mouse clicks; focus + Enter
 * is a real user path and works on every project.
 */
async function press(page: Page, name: RegExp) {
  const button = page.getByRole('button', { name });
  await button.focus();
  await page.keyboard.press('Enter');
}

async function toReport(page: Page) {
  await toInterview(page);
  for (let i = 0; i < 10 && !/\/report/.test(page.url()); i++) {
    await page.getByRole('tab', { name: /^type$/i }).click();
    await page.getByPlaceholder(/type your answer/i).fill('I led a migration and cut latency 35%.');
    await press(page, /submit answer/i);
    const next = page.getByRole('button', { name: /continue to next|view your report/i });
    await expect(next).toBeVisible({ timeout: 15000 });
    const last = /view your report/i.test((await next.textContent()) ?? '');
    await press(page, /continue to next|view your report/i);
    if (last) break;
  }
  await expect(page.getByRole('button', { name: /print/i })).toBeVisible({ timeout: 15000 });
}

const goto = (path: string) => async (page: Page) => {
  await page.goto(path);
};

const SCREENS: { name: string; go: (page: Page) => Promise<void> }[] = [
  { name: 'landing', go: goto('/') },
  { name: 'privacy', go: goto('/privacy') },
  { name: 'ethics', go: goto('/ethics') },
  { name: 'prepare', go: goto('/prepare') },
  { name: 'not-found', go: goto('/no-such-page') },
  { name: 'analysis', go: toAnalysis },
  { name: 'tailor', go: (page) => toTab(page, 'Tailor resume') },
  { name: 'resume', go: (page) => toTab(page, 'Resume') },
  { name: 'interview', go: toInterview },
  { name: 'report', go: toReport },
];

async function findSmallTargets(page: Page) {
  return page.evaluate(() => {
    const sel =
      'button, a[href], [role="tab"], input:not([type="hidden"]), textarea, select, summary';
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden') continue;
      // Off-screen skip links and visually hidden file inputs are not touch targets.
      if (r.bottom <= 0 || r.right <= 0 || (r.width <= 1 && r.height <= 1)) continue;
      // sr-only elements (clipped, absolutely positioned) are visually hidden.
      if (style.position === 'absolute' && style.overflow === 'hidden') continue;
      // Inline links inside running text are exempt (WCAG 2.5.8 inline exception).
      if (el.tagName === 'A' && el.closest('p, li') && style.display === 'inline') continue;
      if (r.height < 44 || r.width < 44) {
        const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40);
        bad.push(
          `${el.tagName.toLowerCase()} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
      }
    }
    return bad;
  });
}

for (const width of WIDTHS) {
  test.describe(`audit @${width}px`, () => {
    // The audit sets its own widths, so it runs in the desktop projects only. Mobile
    // projects cover the real journey in demo-journey.spec.ts; overriding a mobile
    // preset's viewport here made Linux WebKit report the submit button off-screen.
    test.skip(({ isMobile }) => isMobile, 'width audit runs in desktop projects');
    test.use({ viewport: { width, height: 800 } });
    for (const screen of SCREENS) {
      test(`${screen.name}`, async ({ page }) => {
        test.setTimeout(90_000);
        await screen.go(page);
        await page.waitForLoadState('networkidle');

        const axe = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
        expect(
          axe.violations.map(
            (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
          ),
          'axe violations',
        ).toEqual([]);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(0);

        expect(await findSmallTargets(page), 'targets under 44px').toEqual([]);
      });
    }
  });
}

test.describe('keyboard', () => {
  test('landing: Tab reaches every control with a visible focus indicator', async ({
    page,
    browserName,
  }) => {
    // Safari does not Tab to links unless Option+Tab is used, so this run is Chromium-only.
    test.skip(browserName !== 'chromium', 'Safari link tabbing differs by OS setting');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return {
          id: `${el.tagName}:${(el.textContent ?? '').trim().slice(0, 30)}`,
          outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2,
          shadow: s.boxShadow !== 'none',
        };
      });
      if (!info) continue;
      seen.add(info.id);
      expect(info.outline || info.shadow, `no visible focus on ${info.id}`).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(4);
  });

  test('tailor: add a skill and confirm experience with the keyboard only', async ({ page }) => {
    await toAnalysis(page);
    await page.getByRole('button', { name: 'Tailor my resume' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Tailor resume' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const add = page.getByRole('button', { name: 'Add REST APIs to Skills' });
    await add.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Remove REST APIs from Skills' }),
    ).toHaveAttribute('aria-pressed', 'true');
    const trigger = page.getByRole('button', { name: /i have this experience/i }).first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
  test('interview: Type tab, textarea and submit are keyboard operable', async ({ page }) => {
    await toInterview(page);
    await page.getByRole('tab', { name: /type/i }).focus();
    await page.keyboard.press('Enter');
    const box = page.getByPlaceholder(/type your answer/i);
    await box.focus();
    await page.keyboard.type('I improved checkout latency by 35% over two quarters.');
    await page.getByRole('button', { name: /submit answer/i }).focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: /continue to next|view your report/i }),
    ).toBeVisible({ timeout: 15000 });
  });

  test('report: delete dialog opens, closes with Escape and returns focus', async ({ page }) => {
    test.setTimeout(90_000);
    await toReport(page);
    const trigger = page.getByRole('button', { name: /delete my data/i });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe('reduced motion', () => {
  test('no long animations or transitions when reduced motion is requested', async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await toReport(page);
    const long = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('*'))
        .map((el) => {
          const s = getComputedStyle(el);
          const dur = (v: string) => Math.max(...v.split(',').map((x) => parseFloat(x) || 0));
          return { tag: el.tagName, a: dur(s.animationDuration), t: dur(s.transitionDuration) };
        })
        .filter((x) => x.a > 0.3 || x.t > 0.3)
        .map((x) => `${x.tag} anim=${x.a}s trans=${x.t}s`)
        .slice(0, 10),
    );
    expect(long).toEqual([]);
  });
});
