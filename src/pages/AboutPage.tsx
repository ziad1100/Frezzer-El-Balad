import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ChefHat, HeartHandshake, Leaf, Truck, Shield, Award, Snowflake, Clock, Star, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const values = [
  { icon: Leaf, title: 'home.whyIngredients', desc: 'home.whyIngredientsDesc', color: 'emerald' },
  { icon: ChefHat, title: 'home.whyDough', desc: 'home.whyDoughDesc', color: 'brand' },
  { icon: Truck, title: 'home.whyDelivery', desc: 'home.whyDeliveryDesc', color: 'ice' },
  { icon: HeartHandshake, title: 'home.ctaTitle', desc: 'footer.tagline', color: 'gold' },
] as const;

const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/20' },
  brand: { bg: 'bg-brand-500/10', text: 'text-brand-400', ring: 'ring-brand-500/20' },
  ice: { bg: 'bg-ice-500/10', text: 'text-ice-400', ring: 'ring-ice-500/20' },
  gold: { bg: 'bg-gold-500/10', text: 'text-gold-400', ring: 'ring-gold-500/20' },
};

const stats = [
  { icon: Shield, value: '100%', label: 'about.statQuality' },
  { icon: Snowflake, value: '−18°C', label: 'about.statFresh' },
  { icon: Clock, value: '24h', label: 'about.statDelivery' },
  { icon: Star, value: '4.9', label: 'about.statRating' },
] as const;

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

export function AboutPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  return (
    <div className="overflow-hidden">
      {/* ═══ Hero Section ═══ */}
      <section className="relative bg-gradient-to-b from-brand-900/40 via-[var(--tw-bg)] to-[var(--tw-bg)]">
        <div className="container-px py-16 sm:py-24">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.div variants={fadeUp} className="mb-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-brand-400 uppercase">
                <Snowflake className="h-3.5 w-3.5" />
                {isAr ? 'فريزر البلد' : 'Freezer El Balad'}
              </span>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-3xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-4xl lg:text-5xl"
            >
              {isAr ? 'من نحن' : 'About Us'}
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--tw-text-muted)] sm:text-lg"
            >
              {t('footer.tagline')}
            </motion.p>
          </motion.div>
        </div>
        {/* Decorative gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-500/5 blur-3xl" />
        </div>
      </section>

      {/* ═══ Brand Story ═══ */}
      <section className="container-px py-12 sm:py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2 lg:items-center"
        >
          <motion.div variants={fadeUp}>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-400">
              {isAr ? 'قصتنا' : 'Our Story'}
            </span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-3xl">
              {isAr
                ? 'جودة Egyptians تبدأ من هنا'
                : 'Quality Egyptian Products Start Here'}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--tw-text-muted)] sm:text-base">
              {isAr
                ? 'فريزر البلد هو المتجر المتخصص في اللحوم الطازجة والمجمدات عالية الجودة. نعمل مع أفضل المزارع والمصانع المصرية لنقدم لك منتجات طازجة بأسعار مناسبة، مع خدمة توصيل سريعة وآمنة تضمن وصول المنتجات مجمّدة وبحالة ممتازة.'
                : 'Freezer El Balad is a premium destination for fresh meat and frozen products. We partner with the best Egyptian farms and factories to deliver top-quality products at affordable prices, with fast and secure delivery that keeps everything frozen and fresh.'}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Link to="/menu">
                <Button variant="primary" size="lg">
                  {isAr ? 'تصفح المنتجات' : 'Browse Products'}
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--tw-border)] bg-gradient-to-br from-emerald-500/10 to-transparent p-5">
                  <Shield className="h-8 w-8 text-emerald-400" />
                  <p className="mt-3 text-sm font-bold text-[var(--tw-text)]">{isAr ? 'جودة مضمونة' : 'Guaranteed Quality'}</p>
                  <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{isAr ? 'منتجات مختارة بعناية' : 'Handpicked products'}</p>
                </div>
                <div className="rounded-2xl border border-[var(--tw-border)] bg-gradient-to-br from-ice-500/10 to-transparent p-5">
                  <Snowflake className="h-8 w-8 text-ice-400" />
                  <p className="mt-3 text-sm font-bold text-[var(--tw-text)]">{isAr ? 'تبريد احترافي' : 'Cold Chain'}</p>
                  <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{isAr ? 'من المخزن لحد بابك' : 'From storage to your door'}</p>
                </div>
              </div>
              <div className="mt-8 space-y-4">
                <div className="rounded-2xl border border-[var(--tw-border)] bg-gradient-to-br from-brand-500/10 to-transparent p-5">
                  <Truck className="h-8 w-8 text-brand-400" />
                  <p className="mt-3 text-sm font-bold text-[var(--tw-text)]">{isAr ? 'توصيل سريع' : 'Fast Delivery'}</p>
                  <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{isAr ? 'وصول سريع وآمن' : 'Quick & safe arrival'}</p>
                </div>
                <div className="rounded-2xl border border-[var(--tw-border)] bg-gradient-to-br from-gold-500/10 to-transparent p-5">
                  <Award className="h-8 w-8 text-gold-400" />
                  <p className="mt-3 text-sm font-bold text-[var(--tw-text)]">{isAr ? 'أسعار مناسبة' : 'Fair Prices'}</p>
                  <p className="mt-1 text-xs text-[var(--tw-text-muted)]">{isAr ? 'جودة عالية بسعر عادل' : 'Premium quality, fair price'}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══ Stats Bar ═══ */}
      <section className="border-y border-[var(--tw-border)] bg-[var(--tw-surface)]/50">
        <div className="container-px py-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
            className="grid grid-cols-2 gap-6 sm:grid-cols-4"
          >
            {stats.map(({ icon: Icon, value, label }) => (
              <motion.div key={label} variants={fadeUp} className="text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
                  <Icon className="h-5 w-5 text-brand-400" />
                </div>
                <p className="text-2xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-3xl">{value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--tw-text-muted)]">{t(label)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ Values ═══ */}
      <section className="container-px py-12 sm:py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="mx-auto max-w-5xl"
        >
          <motion.div variants={fadeUp} className="mb-10 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-400">
              {isAr ? 'قيمنا' : 'Our Values'}
            </span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-3xl">
              {isAr ? 'لماذا فريزر البلد؟' : 'Why Freezer El Balad?'}
            </h2>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2">
            {values.map(({ icon: Icon, title, desc, color }) => {
              const c = colorMap[color];
              return (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  whileHover={{ y: -4 }}
                  className="group rounded-2xl border border-[var(--tw-border)] bg-[var(--tw-card-bg)] p-6 transition-all hover:shadow-lg hover:shadow-black/5"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.bg} ring-1 ${c.ring} transition-transform group-hover:scale-110`}>
                    <Icon className={`h-6 w-6 ${c.text}`} />
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-tight text-[var(--tw-text)]">{t(title)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--tw-text-muted)]">{t(desc)}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ═══ CTA Section ═══ */}
      <section className="container-px pb-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-brand-500/20 bg-gradient-to-br from-brand-600/20 via-brand-500/10 to-transparent p-8 text-center sm:p-12"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/20">
            <Snowflake className="h-7 w-7 text-brand-400" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-2xl">
            {t('home.ctaTitle')}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--tw-text-muted)]">
            {isAr
              ? 'تصفح مجموعتنا المتنوعة من اللحوم الطازجة والمجمدات واطلب الآن.'
              : 'Explore our wide range of fresh meat and frozen products and order now.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link to="/menu">
              <Button variant="primary" size="lg">
                {isAr ? 'تصفح المنيو' : 'Browse Menu'}
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg">
                {isAr ? 'تواصل معنا' : 'Contact Us'}
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
