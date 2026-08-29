import { useTranslation } from 'react-i18next';
import { ChefHat, HeartHandshake, Leaf, Truck } from 'lucide-react';

const values = [
  { icon: Leaf, title: 'home.whyIngredients', desc: 'home.whyIngredientsDesc' },
  { icon: ChefHat, title: 'home.whyDough', desc: 'home.whyDoughDesc' },
  { icon: Truck, title: 'home.whyDelivery', desc: 'home.whyDeliveryDesc' },
  { icon: HeartHandshake, title: 'home.ctaTitle', desc: 'footer.tagline' },
] as const;

export function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="container-px py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-2xl font-extrabold text-night-50 sm:text-3xl">{t('nav.about')}</h1>
        <p className="mt-3 text-base leading-relaxed text-night-300">{t('footer.tagline')}</p>
      </div>
      <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
        {values.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-night-800/60 bg-night-900/60 p-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/15 text-brand-400">
              <Icon className="h-6 w-6" />
            </span>
            <h3 className="mt-3 text-base font-bold text-night-50">{t(title)}</h3>
            <p className="mt-1.5 text-sm text-night-400">{t(desc)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}