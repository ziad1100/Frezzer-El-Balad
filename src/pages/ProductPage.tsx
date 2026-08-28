import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Clock, Flame, Heart, Minus, Plus, ShoppingBag, Star } from 'lucide-react';
import { getProduct } from '@/api/products';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { addLine } from '@/store/slices/cartSlice';
import { toggle as toggleWishlist } from '@/store/slices/wishlistSlice';
import { Button } from '@/components/ui/Button';
import { Badge, Skeleton } from '@/components/ui/Card';
import { ReviewsSection } from '@/components/review/ReviewsSection';
import { cn, formatPrice } from '@/lib/utils';
import type { Role } from '@/types';

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

  // Admin-only state
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

  // Custom weight in grams
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

  // Price per gram from existing sizes (for custom weight pricing)
  const pricePerGram = useMemo(() => {
    if (!product || product.sizes.length === 0) return 0;
    // Find the smallest size to compute a base price-per-gram
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
    // Use the smallest known size for the base rate
    const smallest = sizesWithGrams.reduce((a, b) => (a.grams < b.grams ? a : b));
    return smallest.price / smallest.grams;
  }, [product]);

  // Custom weight price: pricePerGram × customWeightGrams
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
      <div className="container-px grid gap-10 py-14 lg:grid-cols-2">
        <Skeleton className="aspect-square" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container-px py-24 text-center">
        <h1 className="text-2xl font-bold text-night-50">{t('product.notFound')}</h1>
        <Link to="/menu" className="mt-4 inline-block text-brand-500 hover:underline">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  const image = product.images[0];

  const toggleExtra = (id: string): void => {
    setSelectedExtras((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  };

  const handleAdd = (): void => {
    const cw = customWeightEnabled && customWeightGrams > 0
      ? { grams: customWeightGrams, display: customWeightDisplay }
      : undefined;
    dispatch(
      addLine({
        productId: product._id,
        name: product.name,
        nameEn: product.nameEn,
        image: image ?? '',
        slug: product.slug,
        size: cw ? null : (size?._id ?? null),
        sizeName: cw ? cw.display : (size ? (lang === 'ar' ? size.name : size.nameEn || size.name) : ''),
        extras,
        qty,
        unitPrice,
        customWeight: cw,
      }),
    );
  };

  // Admin: add to cart AND navigate to checkout
  const handleAdminCheckout = (): void => {
    const cw = customWeightEnabled && customWeightGrams > 0
      ? { grams: customWeightGrams, display: customWeightDisplay }
      : undefined;
    dispatch(
      addLine({
        productId: product._id,
        name: product.name,
        nameEn: product.nameEn,
        image: image ?? '',
        slug: product.slug,
        size: cw ? null : (size?._id ?? null),
        sizeName: cw ? cw.display : (size ? (lang === 'ar' ? size.name : size.nameEn || size.name) : ''),
        extras,
        qty,
        unitPrice,
        customWeight: cw,
      }),
    );
    navigate('/checkout');
  };

  return (
    <div className="container-px py-14">
      <nav className="mb-8 flex items-center gap-1.5 text-sm text-night-400">
        <Link to="/" className="hover:text-brand-500">
          {t('nav.home')}
        </Link>
        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        <Link to="/menu" className="hover:text-brand-500">
          {t('nav.menu')}
        </Link>
        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        <span className="text-night-200">
          {lang === 'ar' ? product.name : product.nameEn || product.name}
        </span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl border border-night-800 bg-night-900">
          {image ? (
            <img
              src={image}
              alt={lang === 'ar' ? product.name : product.nameEn || product.name}
              className="aspect-square h-full w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center">
              <ShoppingBag className="h-16 w-16 text-night-600" />
            </div>
          )}
        </div>

        <div>
        {product.isBestSeller ? (
          <Badge tone="brand" className="mb-3 text-sm">
            <Flame className="h-4 w-4" />
            {t('menu.bestSeller')}
          </Badge>
        ) : null}
        {product.labels && product.labels.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {product.labels.map((lbl) => (
              <span
                key={lbl._id}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: `${lbl.color}20`,
                  color: lbl.color,
                  border: `1px solid ${lbl.color}40`,
                }}
              >
                {lbl.icon ? `${lbl.icon} ` : ''}{lang === 'ar' ? lbl.name : (lbl.nameEn || lbl.name)}
              </span>
            ))}
          </div>
        ) : null}
        <h1 className="text-3xl font-extrabold text-night-50 md:text-4xl">
          {lang === 'ar' ? product.name : product.nameEn || product.name}
        </h1>
          <div className="mt-3 flex items-center gap-3 text-sm text-night-400">
            <span className="flex items-center gap-1 text-gold-500">
              <Star className="h-4 w-4 fill-current" />
              {product.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1 text-night-500">
              {t('review.reviews', { count: product.reviewsCount })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {t('menu.preparationTime')}: {product.preparationTime} {t('menu.minutes')}
            </span>
          </div>
          <p className="mt-4 leading-relaxed text-night-300">
            {lang === 'ar' ? product.description : product.descriptionEn || product.description}
          </p>

          {product.ingredients.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-night-300">
                {t('menu.ingredients')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {product.ingredients.map((ing) => (
                  <span key={ing} className="rounded-full border border-night-700 px-3 py-1 text-xs text-night-300">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {product.sizes.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-night-300">
                {t('menu.size')}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {product.sizes.map((s) => {
                  const active = String(s._id) === String(size?._id);
                  return (
                    <button
                      key={String(s._id)}
                      onClick={() => setSelectedSize(String(s._id))}
                      className={cn(
                        'rounded-xl border p-3 text-center transition-colors',
                        active
                          ? 'border-brand-500 bg-brand-600/10 text-night-50'
                          : 'border-night-700 text-night-300 hover:border-night-500',
                      )}
                    >
                      <p className="text-sm font-bold">{lang === 'ar' ? s.name : s.nameEn || s.name}</p>
                      <p className="mt-1 text-sm font-extrabold text-brand-500">{formatPrice(s.price, lang)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {product.extras.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-night-300">
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
                        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
                        active
                          ? 'border-gold-500 bg-gold-500/10 text-night-50'
                          : 'border-night-700 text-night-300 hover:border-night-500',
                      )}
                    >
                      <span>{lang === 'ar' ? e.name : e.nameEn || e.name}</span>
                      <span className="text-xs text-gold-400">+{formatPrice(e.price, lang)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* ── Admin: Custom Weight ── */}
          {isAdmin && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  setCustomWeightEnabled((v) => !v);
                  if (customWeightEnabled) {
                    setCustomWeightValue('');
                    setCustomWeightUnit('g');
                  }
                }}
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-semibold transition-colors',
                  customWeightEnabled
                    ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                    : 'border-night-700 text-night-300 hover:border-night-500',
                )}
              >
                {lang === 'ar' ? 'وزن مخصص' : 'Custom Weight'}
              </button>

              {customWeightEnabled && (
                <div className="mt-3 rounded-xl border border-night-700 bg-night-900/60 p-4">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-night-400">
                    {lang === 'ar' ? 'الوزن المخصص' : 'Custom Weight'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={customWeightValue}
                      onChange={(e) => setCustomWeightValue(e.target.value)}
                      placeholder={lang === 'ar' ? 'أدخل الوزن' : 'Enter weight'}
                      className="w-28 rounded-lg border border-night-700 bg-night-800 px-3 py-2 text-sm text-night-100 outline-none focus:border-brand-500"
                      dir="ltr"
                    />
                    <select
                      value={customWeightUnit}
                      onChange={(e) => setCustomWeightUnit(e.target.value as 'g' | 'kg')}
                      className="rounded-lg border border-night-700 bg-night-900 px-3 py-2 text-sm text-night-100 outline-none"
                    >
                      <option value="g">{lang === 'ar' ? 'جم' : 'g'}</option>
                      <option value="kg">{lang === 'ar' ? 'كيلو' : 'kg'}</option>
                    </select>
                  </div>
                  {customWeightEnabled && customWeightValue && !isCustomWeightValid && (
                    <p className="mt-2 text-xs text-red-400">
                      {lang === 'ar' ? 'أدخل وزناً صحيحاً أكبر من صفر' : 'Enter a valid weight greater than 0'}
                    </p>
                  )}
                  {customWeightEnabled && isCustomWeightValid && customWeightGrams > 0 && (
                    <p className="mt-2 text-xs text-night-400">
                      {lang === 'ar' ? 'السعر:' : 'Price:'}{' '}
                      <span className="font-bold text-brand-400">{formatPrice(customWeightPrice, lang)}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-night-700">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="p-3 text-night-300 hover:text-brand-500"
                aria-label="minus"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-8 text-center font-bold text-night-50">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="p-3 text-night-300 hover:text-brand-500"
                aria-label="plus"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => dispatch(toggleWishlist(product._id))}
              className={cn(
                'flex h-13 w-13 items-center justify-center rounded-xl border transition-colors',
                isWished
                  ? 'border-brand-500 bg-brand-600/10 text-brand-500'
                  : 'border-night-700 text-night-300 hover:text-brand-500',
              )}
              aria-label="wishlist"
            >
              <Heart className={cn('h-5 w-5', isWished && 'fill-current')} />
            </button>
            <Button
              variant="gold"
              size="lg"
              className="flex-1"
              onClick={handleAdd}
              disabled={customWeightEnabled && !isCustomWeightValid}
            >
              <Plus className="h-5 w-5" />
              {t('menu.addToCart')}
            </Button>
          </div>

          {/* ── Admin: Checkout button ── */}
          {isAdmin && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleAdminCheckout}
                disabled={customWeightEnabled && !isCustomWeightValid}
              >
                {lang === 'ar' ? 'إتمام الطلب' : 'Checkout Now'}
              </Button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between rounded-2xl border border-night-800 bg-night-900 p-4">
            <span className="text-night-300">{t('cart.subtotal')}</span>
            <span className="text-2xl font-extrabold text-brand-500">
              {formatPrice(lineTotal * qty, lang)}
            </span>
          </div>
        </div>
      </div>

      <ReviewsSection productId={product._id} productName={lang === 'ar' ? product.name : product.nameEn || product.name} />
    </div>
  );
}