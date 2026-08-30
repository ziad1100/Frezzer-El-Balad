import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronRight, Clock, Flame, Heart, Minus, Plus, ShoppingBag, Star, Weight, Shield, Truck } from 'lucide-react';
import { getProduct } from '@/api/products';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { addLine } from '@/store/slices/cartSlice';
import { toggle as toggleWishlist } from '@/store/slices/wishlistSlice';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Card';
import { ReviewsSection } from '@/components/review/ReviewsSection';
import { cn, formatPrice } from '@/lib/utils';
import type { Role } from '@/types';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const wishlist = useAppSelector((state) => state.wishlist.ids);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProduct(slug ?? ''),
    enabled: Boolean(slug),
  });

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === ('admin' as Role) || user?.role === ('manager' as Role);
  const [customWeightEnabled, setCustomWeightEnabled] = useState(false);
  const [customWeightValue, setCustomWeightValue] = useState('');
  const [customWeightUnit, setCustomWeightUnit] = useState<'g' | 'kg'>('g');
  const navigate = useNavigate();
  const lang = i18n.language;

  const size = useMemo(
    () => product?.sizes.find((s) => String(s._id) === selectedSize) ?? product?.sizes[0],
    [product, selectedSize],
  );

  const customWeightGrams = useMemo(() => {
    if (!customWeightEnabled) return 0;
    const val = parseFloat(customWeightValue);
    if (isNaN(val) || val <= 0) return 0;
    return customWeightUnit === 'kg' ? val * 1000 : val;
  }, [customWeightEnabled, customWeightValue, customWeightUnit]);

  const customWeightDisplay = useMemo(() => {
    if (!customWeightEnabled || customWeightGrams <= 0) return '';
    if (customWeightUnit === 'kg') {
      const kg = parseFloat(customWeightValue);
      return `${kg} ${lang === 'ar' ? 'كيلو' : 'kg'}`;
    }
    return `${customWeightValue} ${lang === 'ar' ? 'جم' : 'g'}`;
  }, [customWeightEnabled, customWeightValue, customWeightUnit, customWeightGrams, lang]);

  const isCustomWeightValid = customWeightEnabled ? customWeightGrams > 0 : true;

  const pricePerGram = useMemo(() => {
    if (!product || product.sizes.length === 0) return 0;
    const sizesWithGrams = product.sizes
      .map((s) => {
        const name = (s.nameEn || s.name).toLowerCase();
        const match500 = name.includes('500');
        const match1kilo = name.includes('1') && (name.includes('kilo') || name.includes('كيلو') || name.includes('1kg'));
        if (match500) return { grams: 500, price: s.price };
        if (match1kilo) return { grams: 1000, price: s.price };
        return null;
      })
      .filter(Boolean) as Array<{ grams: number; price: number }>;
    if (sizesWithGrams.length === 0) return product.basePrice / 500;
    const smallest = sizesWithGrams.reduce((a, b) => (a.grams < b.grams ? a : b));
    return smallest.price / smallest.grams;
  }, [product]);

  const customWeightPrice = useMemo(
    () => Math.round(pricePerGram * customWeightGrams * 100) / 100,
    [pricePerGram, customWeightGrams],
  );
  const extras = useMemo(
    () => (product?.extras ?? []).filter((e) => selectedExtras.includes(String(e._id))),
    [product, selectedExtras],
  );
  const unitPrice = customWeightEnabled && customWeightGrams > 0
    ? customWeightPrice + extras.reduce((s, e) => s + e.price, 0)
    : (size?.price ?? product?.basePrice ?? 0) + extras.reduce((s, e) => s + e.price, 0);
  const lineTotal = unitPrice;
  const isWished = product ? wishlist.includes(product._id) : false;

  if (isLoading) {
    return (
      <div className="container-px py-14">
        <div className="grid gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container-px flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--tw-surface)]">
          <ShoppingBag className="h-10 w-10 text-[var(--tw-text-subtle)]" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-[var(--tw-text)]">{t('product.notFound')}</h1>
        <p className="mt-2 text-sm text-[var(--tw-text-muted)]">
          {lang === 'ar' ? 'المنتج غير موجود أو تم حذفه' : 'This product may have been removed or is unavailable'}
        </p>
        <Link to="/menu" className="mt-6">
          <Button>{lang === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}</Button>
        </Link>
      </div>
    );
  }

  const image = product.images[0];

  const toggleExtra = (id: string): void => {
    setSelectedExtras((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);
  };

  const handleAdd = (): void => {
    const cw = customWeightEnabled && customWeightGrams > 0
      ? { grams: customWeightGrams, display: customWeightDisplay }
      : undefined;
    dispatch(
      addLine({
        productId: product._id, name: product.name, nameEn: product.nameEn,
        image: image ?? '', slug: product.slug,
        size: cw ? null : (size?._id ?? null),
        sizeName: cw ? cw.display : (size ? (lang === 'ar' ? size.name : size.nameEn || size.name) : ''),
        extras, qty, unitPrice, customWeight: cw,
      }),
    );
  };

  const handleAdminCheckout = (): void => {
    const cw = customWeightEnabled && customWeightGrams > 0
      ? { grams: customWeightGrams, display: customWeightDisplay }
      : undefined;
    dispatch(
      addLine({
        productId: product._id, name: product.name, nameEn: product.nameEn,
        image: image ?? '', slug: product.slug,
        size: cw ? null : (size?._id ?? null),
        sizeName: cw ? cw.display : (size ? (lang === 'ar' ? size.name : size.nameEn || size.name) : ''),
        extras, qty, unitPrice, customWeight: cw,
      }),
    );
    navigate('/checkout');
  };

  return (
    <div className="overflow-hidden">
      {/* ═══ Breadcrumb ═══ */}
      <div className="container-px">
        <nav className="flex items-center gap-1.5 py-5 text-xs text-[var(--tw-text-muted)]">
          <Link to="/" className="transition-colors hover:text-brand-500">{t('nav.home')}</Link>
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          <Link to="/menu" className="transition-colors hover:text-brand-500">{t('nav.menu')}</Link>
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          <span className="truncate text-[var(--tw-text)]">{lang === 'ar' ? product.name : product.nameEn || product.name}</span>
        </nav>
      </div>

      {/* ═══ Main Product Layout ═══ */}
      <div className="container-px pb-16">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* ── Image Column ── */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="relative overflow-hidden rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)]">
              {image ? (
                <img
                  src={image}
                  alt={lang === 'ar' ? product.name : product.nameEn || product.name}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center">
                  <ShoppingBag className="h-20 w-20 text-[var(--tw-text-subtle)]" />
                </div>
              )}

              {/* Floating badges */}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
                {product.isBestSeller ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-bold text-white shadow-lg">
                    <Flame className="h-3.5 w-3.5" />
                    {t('menu.bestSeller')}
                  </span>
                ) : <span />}
                <button
                  onClick={() => dispatch(toggleWishlist(product._id))}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 shadow-lg',
                    isWished
                      ? 'bg-brand-500 text-white'
                      : 'bg-[var(--tw-bg)]/80 text-[var(--tw-text-muted)] backdrop-blur-sm hover:text-brand-500',
                  )}
                  aria-label="wishlist"
                >
                  <Heart className={cn('h-5 w-5', isWished && 'fill-current')} />
                </button>
              </div>
            </div>

            {/* Trust signals under image */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { icon: Shield, label: lang === 'ar' ? 'جودة مضمونة' : 'Quality Assured' },
                { icon: Truck, label: lang === 'ar' ? 'توصيل سريع' : 'Fast Delivery' },
                { icon: Clock, label: `${product.preparationTime} ${t('menu.minutes')}` },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 rounded-xl border border-[var(--tw-border)] bg-[var(--tw-card-bg)] px-3 py-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-brand-400" />
                  <span className="text-[11px] font-semibold text-[var(--tw-text-muted)] leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Details Column ── */}
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
            {/* Labels */}
            {product.labels && product.labels.length > 0 ? (
              <motion.div variants={fadeUp} className="mb-3 flex flex-wrap gap-2">
                {product.labels.map((lbl) => (
                  <span
                    key={lbl._id}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      backgroundColor: `${lbl.color}15`,
                      color: lbl.color,
                      border: `1px solid ${lbl.color}30`,
                    }}
                  >
                    {lbl.icon ? `${lbl.icon} ` : ''}{lang === 'ar' ? lbl.name : (lbl.nameEn || lbl.name)}
                  </span>
                ))}
              </motion.div>
            ) : null}

            {/* Title + Rating */}
            <motion.div variants={fadeUp}>
              <h1 className="text-2xl font-extrabold tracking-tight text-[var(--tw-text)] md:text-3xl">
                {lang === 'ar' ? product.name : product.nameEn || product.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[var(--tw-text-muted)]">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="font-bold">{product.rating.toFixed(1)}</span>
                </span>
                <span className="text-[var(--tw-text-subtle)]">|</span>
                <span>{t('review.reviews', { count: product.reviewsCount })}</span>
                <span className="text-[var(--tw-text-subtle)]">|</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-brand-400" />
                  {product.preparationTime} {t('menu.minutes')}
                </span>
              </div>
            </motion.div>

            {/* Description */}
            <motion.p variants={fadeUp} className="mt-5 text-sm leading-relaxed text-[var(--tw-text-muted)]">
              {lang === 'ar' ? product.description : product.descriptionEn || product.description}
            </motion.p>

            {/* Ingredients */}
            {product.ingredients.length > 0 ? (
              <motion.div variants={fadeUp} className="mt-6">
                <h3 className="mb-2.5 text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
                  {t('menu.ingredients')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.ingredients.map((ing) => (
                    <span key={ing} className="rounded-full border border-[var(--tw-border-strong)] bg-[var(--tw-surface-alt)] px-3 py-1.5 text-xs font-medium text-[var(--tw-text-muted)]">
                      {ing}
                    </span>
                  ))}
                </div>
              </motion.div>
            ) : null}

            {/* Size Selector */}
            {product.sizes.length > 0 ? (
              <motion.div variants={fadeUp} className="mt-6">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
                  <Weight className="h-3.5 w-3.5" />
                  {t('menu.size')}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {product.sizes.map((s) => {
                    const active = String(s._id) === String(size?._id);
                    return (
                      <button
                        key={String(s._id)}
                        onClick={() => setSelectedSize(String(s._id))}
                        className={cn(
                          'group relative rounded-2xl border-2 p-4 text-center transition-all duration-200',
                          active
                            ? 'border-brand-500 bg-brand-500/10 shadow-md shadow-brand-500/10'
                            : 'border-[var(--tw-border-strong)] hover:border-brand-500/40 hover:bg-[var(--tw-surface-alt)]',
                        )}
                      >
                        <p className={cn('text-sm font-bold', active ? 'text-[var(--tw-text)]' : 'text-[var(--tw-text-muted)]')}>
                          {lang === 'ar' ? s.name : s.nameEn || s.name}
                        </p>
                        <p className={cn('mt-1.5 text-lg font-extrabold', active ? 'text-brand-500' : 'text-[var(--tw-text)]')}>
                          {formatPrice(s.price, lang)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}

            {/* Extras */}
            {product.extras.length > 0 ? (
              <motion.div variants={fadeUp} className="mt-6">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
                  {t('menu.extras')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.extras.map((e) => {
                    const active = selectedExtras.includes(String(e._id));
                    return (
                      <button
                        key={String(e._id)}
                        onClick={() => toggleExtra(String(e._id))}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm transition-all duration-200',
                          active
                            ? 'border-fresh-500 bg-fresh-500/10 font-bold text-[var(--tw-text)]'
                            : 'border-[var(--tw-border-strong)] text-[var(--tw-text-muted)] hover:border-fresh-500/40',
                        )}
                      >
                        <span>{lang === 'ar' ? e.name : e.nameEn || e.name}</span>
                        <span className={cn('text-xs font-bold', active ? 'text-fresh-500' : 'text-fresh-400')}>
                          +{formatPrice(e.price, lang)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}

            {/* Custom Weight (Admin) */}
            {isAdmin && (
              <motion.div variants={fadeUp} className="mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setCustomWeightEnabled((v) => !v);
                    if (customWeightEnabled) { setCustomWeightValue(''); setCustomWeightUnit('g'); }
                  }}
                  className={cn(
                    'rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all duration-200',
                    customWeightEnabled
                      ? 'border-brand-500 bg-brand-500/20 text-brand-500 shadow-sm'
                      : 'border-[var(--tw-border-strong)] text-[var(--tw-text-muted)] hover:border-brand-500/40',
                  )}
                >
                  {lang === 'ar' ? '⚖️ وزن مخصص' : '⚖️ Custom Weight'}
                </button>
                {customWeightEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 rounded-2xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface-alt)] p-5"
                  >
                    <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
                      {lang === 'ar' ? 'الوزن المخصص' : 'Custom Weight'}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number" min="1" step="0.1"
                        value={customWeightValue}
                        onChange={(e) => setCustomWeightValue(e.target.value)}
                        placeholder={lang === 'ar' ? 'أدخل الوزن' : 'Enter weight'}
                        className="w-32 rounded-xl border border-[var(--tw-input-border)] bg-[var(--tw-input-bg)] px-4 py-2.5 text-sm text-[var(--tw-text)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                        dir="ltr"
                      />
                      <select
                        value={customWeightUnit}
                        onChange={(e) => setCustomWeightUnit(e.target.value as 'g' | 'kg')}
                        className="rounded-xl border border-[var(--tw-input-border)] bg-[var(--tw-input-bg)] px-4 py-2.5 text-sm text-[var(--tw-text)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      >
                        <option value="g">{lang === 'ar' ? 'جم' : 'g'}</option>
                        <option value="kg">{lang === 'ar' ? 'كيلو' : 'kg'}</option>
                      </select>
                    </div>
                    {customWeightEnabled && customWeightValue && !isCustomWeightValid && (
                      <p className="mt-2 text-xs text-red-400">
                        {lang === 'ar' ? 'أدخل وزناً صحيحًا أكبر من صفر' : 'Enter a valid weight greater than 0'}
                      </p>
                    )}
                    {customWeightEnabled && isCustomWeightValid && customWeightGrams > 0 && (
                      <p className="mt-3 text-sm text-[var(--tw-text-muted)]">
                        {lang === 'ar' ? 'السعر:' : 'Price:'}{' '}
                        <span className="font-extrabold text-brand-500">{formatPrice(customWeightPrice, lang)}</span>
                      </p>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Quantity + Add to Cart */}
            <motion.div variants={fadeUp} className="mt-8 flex items-center gap-4">
              {/* Quantity */}
              <div className="flex items-center gap-0 rounded-2xl border-2 border-[var(--tw-border-strong)]">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-12 w-12 items-center justify-center text-[var(--tw-text-muted)] transition-colors hover:text-brand-500"
                  aria-label="minus"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-12 text-center text-lg font-extrabold tabular-nums text-[var(--tw-text)]">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="flex h-12 w-12 items-center justify-center text-[var(--tw-text-muted)] transition-colors hover:text-brand-500"
                  aria-label="plus"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Add to Cart */}
              <Button
                variant="fresh"
                size="lg"
                className="flex-1"
                onClick={handleAdd}
                disabled={customWeightEnabled && !isCustomWeightValid}
              >
                <ShoppingBag className="h-5 w-5" />
                {t('menu.addToCart')}
              </Button>
            </motion.div>

            {/* Admin Checkout */}
            {isAdmin && (
              <motion.div variants={fadeUp} className="mt-3">
                <Button variant="outline" size="lg" className="w-full" onClick={handleAdminCheckout} disabled={customWeightEnabled && !isCustomWeightValid}>
                  {lang === 'ar' ? '⚡ إتمام الطلب' : '⚡ Checkout Now'}
                </Button>
              </motion.div>
            )}

            {/* Price Summary */}
            <motion.div variants={fadeUp} className="mt-6 overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-600/10 via-brand-500/5 to-transparent p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
                    {lang === 'ar' ? 'الإجمالي' : 'Total'}
                  </p>
                  <p className="text-xs text-[var(--tw-text-subtle)]">
                    {qty} × {formatPrice(unitPrice, lang)}
                  </p>
                </div>
                <span className="text-3xl font-extrabold tracking-tight text-brand-500">
                  {formatPrice(lineTotal * qty, lang)}
                </span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ═══ Reviews Section ═══ */}
      <div className="container-px pb-16">
        <ReviewsSection productId={product._id} productName={lang === 'ar' ? product.name : product.nameEn || product.name} />
      </div>
    </div>
  );
}
