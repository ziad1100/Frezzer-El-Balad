import type { Offer } from '@/types';
import { cn } from '@/lib/utils';

export const offerThemeGradients: Record<Offer['theme'], string> = {
  dark: 'from-night-800 via-night-900 to-night-950',
  red: 'from-brand-700 via-brand-800 to-brand-900',
  gold: 'from-gold-600 via-gold-700 to-night-900',
};

export const offerThemeBorders: Record<Offer['theme'], string> = {
  dark: 'border-night-700',
  red: 'border-brand-600/50',
  gold: 'border-gold-500/50',
};

export const offerThemeClasses = (theme: Offer['theme']): string =>
  cn(offerThemeGradients[theme], offerThemeBorders[theme]);
