# Accessibility Audit Checklist (Task 22)

This checklist covers manual accessibility tests for Proof & Poise (Req 14, WCAG 2.2 Level AA).

## Automated Tests

- [x] Playwright e2e with axe-core WCAG 2.2 AA checks on every screen
- [x] Run against 1280px (desktop) and 375px (mobile) viewports

## Manual Keyboard Navigation

Test each screen with keyboard only (no mouse):

### Landing Page (`/`)
- [ ] Tab reaches "Try the demo" button
- [ ] Tab reaches "For job seekers" button
- [ ] Tab reaches footer links
- [ ] Focus indicator visible (3:1 contrast, ≥2px outline)
- [ ] Enter/Space activates buttons
- [ ] Shift+Tab reverses order

### Demo Page (`/demo`)
- [ ] Tab through all interactive elements
- [ ] "Start demo" button keyboard-accessible

### Prepare Page (`/s/{id}/prepare`)
- [ ] Tab into resume textarea
- [ ] Tab to "Next" button
- [ ] Job description textarea keyboard-accessible
- [ ] "Back" and "Analyze" buttons reachable
- [ ] Field validation errors announced

### Analysis Page (`/s/{id}/analysis`)
- [ ] Tab switches between tabs (Overview, Competencies, Recommendations, Keywords)
- [ ] Arrow keys navigate within tab list (optional enhancement)
- [ ] "Start Interview" button keyboard-accessible
- [ ] Accordion/disclosure widgets keyboard-operable

### Interview Page (`/s/{id}/interview`)
- [ ] Tab switches Record/Type tabs
- [ ] "Request microphone" button keyboard-accessible
- [ ] Record/Stop/Play buttons keyboard-accessible
- [ ] Textarea keyboard-accessible in Type mode
- [ ] "Submit answer" button reachable
- [ ] Prep timer "Pause" and "Hide" buttons keyboard-accessible

### Report Page (`/s/{id}/report`)
- [ ] Tab through all sections
- [ ] "Print report" button keyboard-accessible
- [ ] "Practice this question again" buttons reachable
- [ ] "Delete data" button keyboard-accessible
- [ ] Confirmation dialog keyboard-operable (Escape closes, Enter confirms)

## Focus Order

For each screen, verify:
- [ ] Focus order follows visual/logical reading order (top-to-bottom, left-to-right)
- [ ] Focus never trapped (can always escape modals/dialogs)
- [ ] Focus visible at all times (no invisible focus states)

## Contrast Checks

Use browser DevTools or a contrast checker:

- [ ] Body text on white background: ≥4.5:1 (WCAG AA)
- [ ] Large text (18px+): ≥3:1
- [ ] Focus indicators: ≥3:1 against adjacent colors
- [ ] Status badges (verified/weak/missing): ≥4.5:1 text, ≥3:1 icon
- [ ] Error messages: ≥4.5:1

## Touch Targets (Mobile)

At 375px width, verify all interactive elements:

- [ ] Buttons ≥44px tall
- [ ] Links with adequate spacing
- [ ] Form fields ≥44px tall
- [ ] Tab triggers ≥44px tall

## Responsive Breakpoints

Test at 375px, 768px, 1280px:

- [ ] 375px (iPhone 12): All content visible, no horizontal scroll, buttons ≥44px
- [ ] 768px (iPad): Layout adapts, no overlapping elements
- [ ] 1280px (desktop): Optimal reading width, no awkward wrapping

## Reduced Motion

Set `prefers-reduced-motion: reduce` in browser or OS:

- [ ] Animations are instant or significantly reduced
- [ ] Page transitions still functional
- [ ] PrepTimer still works (WCAG 2.2.1 - moving content can be paused/stopped)
- [ ] No flashing content (WCAG 2.3.1)

## Screen Reader Tests (Optional, not required for MVP)

Using NVDA (Windows) or VoiceOver (macOS):

- [ ] Page title announced
- [ ] Headings structure makes sense (h1, h2, h3)
- [ ] Form labels associated with inputs
- [ ] Button purpose clear from label alone
- [ ] Status messages announced (aria-live)
- [ ] Error messages announced
- [ ] Loading states announced

## Loading, Empty, Error States

For each screen, verify:

- [ ] Loading state: Loading spinner or skeleton with accessible label
- [ ] Empty state: Clear message, icon is decorative (aria-hidden), action button provided
- [ ] Error state: Clear error message, recovery action (retry/go back), no jargon
- [ ] Success state: Clear confirmation, next action offered

## Status Never by Color Alone (WCAG 1.4.1)

- [ ] StatusBadge includes icon + text (not just color)
- [ ] Success/error messages include icon + text
- [ ] Score rings include numeric label + text (not just color gradient)

## Specific WCAG 2.2.1 Checks

- [ ] **2.2.2 Pause, Stop, Hide**: PrepTimer can be paused and hidden (✓)
- [ ] **1.3.1 Info and Relationships**: Form labels programmatically associated (✓)
- [ ] **1.4.13 Content on Hover**: No hover-only content (tooltips, if added, must persist on focus)
- [ ] **2.4.7 Focus Visible**: All focusable elements have visible indicator (✓)
- [ ] **3.2.1 On Focus**: Focus alone doesn't trigger context change (✓)
- [ ] **4.1.3 Status Messages**: Role="status" or aria-live for dynamic updates (interview feedback, analysis stages)

## Notes

- Playwright `axe` tests cover ~50% of WCAG automatically
- Manual keyboard and screen reader tests catch the rest
- Document any known issues with remediation plan
- Re-test after fixing issues
