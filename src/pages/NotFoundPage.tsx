import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Compass, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export function NotFoundPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  return (
    <div className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
      {/* Background orb */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/5 blur-3xl" />
      </div>

      <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.12 } } }} className="relative">
        <motion.div variants={fadeUp} className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500/20 to-brand-500/5 ring-1 ring-brand-500/20">
          <Compass className="h-12 w-12 text-brand-400" />
        </motion.div>

        <motion.h1 variants={fadeUp} className="text-7xl font-extrabold tracking-tighter text-[var(--tw-text)]">
          404
        </motion.h1>

        <motion.p variants={fadeUp} className="mt-4 text-lg font-bold text-[var(--tw-text)]">
          {isAr ? 'الصفحة غير موجودة' : 'Page Not Found'}
        </motion.p>
        <motion.p variants={fadeUp} className="mt-2 text-sm text-[var(--tw-text-muted)]">
          {t('misc.pageNotFoundHint')}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-3">
          <Link to="/">
            <Button variant="primary" size="lg">
              <Snowflake className="h-4 w-4" />
              {t('misc.goHome')}
            </Button>
          </Link>
          <Link to="/menu">
            <Button variant="outline" size="lg">
              {isAr ? 'تصفح المنتجات' : 'Browse Menu'}
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
