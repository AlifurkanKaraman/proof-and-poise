import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RootLayout } from './RootLayout';

function renderLayout() {
  const router = createMemoryRouter([
    {
      path: '/',
      Component: RootLayout,
      children: [
        { index: true, element: <p>Home</p> },
        { path: 'privacy', element: <p>Privacy content</p> },
      ],
    },
  ]);
  render(<RouterProvider router={router} />);
}

describe('SiteNav mobile menu (Req 1.3)', () => {
  it('opens, closes on Escape, and returns focus to the toggle', async () => {
    const user = userEvent.setup();
    renderLayout();

    const nav = screen.getByRole('navigation', { name: 'Main' });
    const toggle = within(nav).getByRole('button', { name: 'Menu' });
    const menuId = toggle.getAttribute('aria-controls');
    expect(menuId).toBeTruthy();
    const menu = document.getElementById(menuId ?? '');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(menu).not.toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(menu).toBeVisible();
    const firstLink = within(menu as HTMLElement).getByRole('link', { name: 'Try the demo' });
    expect(firstLink).toHaveAttribute('href', '/demo');

    // Move focus into the menu, then escape out of it.
    await user.tab();
    expect(firstLink).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(menu).not.toBeVisible();
    expect(toggle).toHaveFocus();
  });

  it('toggles closed with the button and closes after a link is chosen', async () => {
    const user = userEvent.setup();
    renderLayout();
    const toggle = screen.getByRole('button', { name: 'Menu' });

    await user.click(toggle);
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    const menu = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    await user.click(within(menu as HTMLElement).getByRole('link', { name: 'Privacy' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
