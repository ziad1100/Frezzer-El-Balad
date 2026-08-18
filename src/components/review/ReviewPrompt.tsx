import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Pizza, X } from 'lucide-react';
import { getPendingReviewOrders } from '@/api/reviews';
import { getSettings } from '@/api/orders';
import { useAppSelector } from '@/hooks';
import { Button } from '@/components/ui/Button';

// Prompt rules are stored locally so the banner is never annoying:
//  - a cooldown between showings (settings: reviewPromptCooldownDays, default 3)
//  - a delay after the order was delivered (settings: reviewPromptDelayHours, default 24)
//  - a permanent per-order dismissal ("Maybe later")
const LS_KEY = 'orabi:reviewPrompt';

interface StoredState {
  lastShownAt?: number;
  dismissed?: string[];
}

const readStored = (): StoredState => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as StoredState;
  } catch {
    return {};
  }
};

const writeStored = (state: StoredState): void => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — the prompt simply won't persist */
  }
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function ReviewPrompt() {
  const { t } = useTranslation();
  const user = useAppSelector((s) => s.auth.user);
  const [hidden, setHidden] = useState(false);
  // Read localStorage once (lazy initializer) — never during render.
  const [stored, setStored] = useState<StoredState>(() => readStored());
  // Ticking clock so cooldown/delay math stays pure during render; refreshed
  // from an interval subscription (external system → callback setState).
  const [now, setNow] = useState(() => Date.now());
  const shownForOrder = useRef<string | null>(null);

  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings, staleTime: 5 * 60_000 });
  const pending = useQuery({
    queryKey: ['reviews', 'pending-orders'],
    queryFn: getPendingReviewOrders,
    enabled: user !== null,
  });

  const cooldownMs = (Number(settings.data?.reviewPromptCooldownDays ?? 3) || 3) * DAY;
  const delayMs = (Number(settings.data?.reviewPromptDelayHours ?? 24) || 24) * HOUR;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const target = useMemo(() => {
    if (hidden || !user) return null;
    if (stored.lastShownAt && now - stored.lastShownAt < cooldownMs) return null;
    const dismissed = stored.dismissed ?? [];
    return (pending.data ?? []).find((o) => {
      if (dismissed.includes(o.orderId)) return false;
      const deliveredAt = new Date(o.createdAt).getTime();
      if (now - deliveredAt < delayMs) return false;
      return true;
    }) ?? null;
  }, [hidden, user, stored, pending.data, cooldownMs, delayMs, now]);

  // Record the showing so the cooldown starts now. Only persists to localStorage
  // (an external side effect) — once per order, no React state is touched here.
  useEffect(() => {
    if (target && shownForOrder.current !== target.orderId) {
      shownForOrder.current = target.orderId;
      writeStored({ ...stored, lastShownAt: Date.now() });
    }
  }, [target, stored]);

  if (!target) return null;

  const dismiss = (): void => {
    const at = Date.now();
    const next: StoredState = {
      ...stored,
      lastShownAt: at,
      dismissed: [...(stored.dismissed ?? []), target.orderId],
    };
    writeStored(next);
    setStored(next);
    setHidden(true);
  };

  return (
    <div className="container-px">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-600/30 bg-gradient-to-r from-brand-600/10 via-night-900 to-gold-500/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600/15 text-brand-400">
            <Pizza className="h-6 w-6" />
          </span>
          <div>
            <p className="font-bold text-night-50">{t('review.promptTitle')}</p>
            <p className="text-sm text-night-400">{t('review.promptSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/orders">
            <Button variant="gold" size="sm">
              {t('review.promptCta')}
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={dismiss}>
            {t('review.promptDismiss')}
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('common.close')}
            className="ms-1 flex h-8 w-8 items-center justify-center rounded-lg text-night-400 transition-colors hover:bg-night-800 hover:text-night-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
