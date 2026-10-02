import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import NotFoundPage from './NotFoundPage';
import { RequireSession } from './RequireSession';
import { RootLayout } from './RootLayout';
import { RouteErrorBoundary } from './RouteErrorBoundary';

/** Lazy-load a default-exported page component. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

/** Every route gets its own error boundary so one failing screen never blanks the app. */
const withBoundary = (route: RouteObject): RouteObject => ({
  ...route,
  ErrorBoundary: RouteErrorBoundary,
});

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      withBoundary({
        path: 'dev/design',
        lazy: page(() => import('../features/dev/DesignGalleryPage')),
      }),
    ]
  : [];

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      withBoundary({ index: true, lazy: page(() => import('../features/landing/LandingPage')) }),
      withBoundary({ path: 'prepare', lazy: page(() => import('../features/setup/PreparePage')) }),
      withBoundary({ path: 'demo', lazy: page(() => import('../features/demo/DemoPage')) }),
      // Session screens require a stored token for this session (Req 2.3, design §10).
      withBoundary({
        path: 's/:id',
        Component: RequireSession,
        children: [
          withBoundary({
            path: 'analysis',
            lazy: page(() => import('../features/analysis/AnalysisPage')),
          }),
          withBoundary({
            path: 'interview',
            lazy: page(() => import('../features/interview/InterviewPage')),
          }),
          withBoundary({
            path: 'report',
            lazy: page(() => import('../features/report/ReportPage')),
          }),
        ],
      }),
      withBoundary({
        path: 'privacy',
        lazy: page(() => import('../features/landing/PrivacyPage')),
      }),
      withBoundary({ path: 'ethics', lazy: page(() => import('../features/landing/EthicsPage')) }),
      ...devRoutes,
      // Static: the error boundary also renders it, so it's already in the main chunk.
      withBoundary({ path: '*', Component: NotFoundPage }),
    ],
  },
];
