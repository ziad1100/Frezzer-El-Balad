import type { Offer } from '@/types';
import { cn } from '@/lib/utils';

export const offerThemeGradients: Record<Offer['theme'], string> = {
  dark: 'from-[var(--tw-surface-alt)] via-[var(--tw-surface)] to-[var(--tw-bg)]',
  red: 'from-brand-700 via-brand-800 to-brand-900',
  gold: 'from-gold-600 via-gold-700 to-[var(--tw-surface)]',
};

export const offerThemeBorders: Record<Offer['theme'], string> = {
  dark: 'border-[var(--tw-border-strong)]',
  red: 'border-brand-600/50',
  gold: 'border-gold-500/50',
};

export const offerThemeClasses = (theme: Offer['theme']): string =>
  cn(offerThemeGradients[theme], offerThemeBorders[theme]);
