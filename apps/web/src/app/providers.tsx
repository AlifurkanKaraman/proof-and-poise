import { MotionConfig } from 'framer-motion';
import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';
import { ToastProvider } from '../components/ui/Toast';

/** App-wide providers. `reducedMotion="user"` makes every Framer animation honor the OS setting. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <Tooltip.Provider delayDuration={300}>
        <ToastProvider>{children}</ToastProvider>
      </Tooltip.Provider>
    </MotionConfig>
  );
}
