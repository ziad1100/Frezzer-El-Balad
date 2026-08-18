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
    <div className="container-px py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold text-night-50">{t('nav.about')}</h1>
        <p className="mt-4 text-lg leading-relaxed text-night-300">{t('footer.tagline')}</p>
      </div>
      <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
        {values.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl border border-night-800 bg-night-900 p-7 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600/15 text-brand-500">
              <Icon className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-night-50">{t(title)}</h3>
            <p className="mt-2 text-sm text-night-400">{t(desc)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}