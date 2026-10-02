import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from 'lucide-react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn, focusRing } from '../../lib/cn';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastApi {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneConfig: Record<ToastTone, { Icon: LucideIcon; className: string }> = {
  info: { Icon: Info, className: 'text-indigo-700' },
  success: { Icon: CircleCheck, className: 'text-emerald-700' },
  error: { Icon: CircleAlert, className: 'text-red-700' },
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((options: ToastOptions) => {
    setItems((prev) => [...prev, { id: nextId++, ...options }]);
  }, []);
  const api = useMemo(() => ({ show }), [show]);

  const remove = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={api}>
      <ToastPrimitive.Provider swipeDirection="right" duration={6000}>
        {children}
        {items.map(({ id, title, description, tone = 'info' }) => {
          const { Icon, className } = toneConfig[tone];
          return (
            <ToastPrimitive.Root
              key={id}
              type={tone === 'error' ? 'foreground' : 'background'}
              onOpenChange={(open) => {
                if (!open) remove(id);
              }}
              className="flex items-start gap-3 rounded-lg border border-line-200 bg-paper-0 p-4 shadow-md"
            >
              <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', className)} />
              <div className="flex-1">
                <ToastPrimitive.Title className="text-small font-semibold text-ink-950">
                  {title}
                </ToastPrimitive.Title>
                {description && (
                  <ToastPrimitive.Description className="text-small text-ink-700">
                    {description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close
                className={cn(
                  '-m-2 inline-flex size-11 items-center justify-center rounded-md text-ink-700 hover:bg-paper-50',
                  focusRing,
                )}
              >
                <X aria-hidden="true" className="size-4" />
                <span className="sr-only">Dismiss</span>
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-50 flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
