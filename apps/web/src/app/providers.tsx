import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Tooltip } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { ToastProvider } from '../components/ui/Toast';
import { createQueryClient } from '../lib/api/queries';

/**
 * App-wide providers. `reducedMotion="user"` makes every Framer animation honor the OS setting.
 * Tests can pass their own `queryClient` to isolate server state.
 */
export function Providers({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient?: QueryClient;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <Tooltip.Provider delayDuration={300}>
          <ToastProvider>{children}</ToastProvider>
        </Tooltip.Provider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
