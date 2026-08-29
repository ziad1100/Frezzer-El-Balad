import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps extends ComponentProps<'div'> {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizes = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[90vw]',
};

export function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-[var(--tw-overlay)] backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'relative w-full rounded-2xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface)] shadow-2xl',
              sizes[size],
              className,
            )}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.1 }}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-[var(--tw-border)] px-6 py-4">
                <h2 className="text-lg font-bold text-[var(--tw-text)]">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="close"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--tw-text-subtle)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="max-h-[80vh] overflow-y-auto p-6">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
