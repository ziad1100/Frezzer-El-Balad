import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
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

  const size = useMemo(
    () => product?.sizes.find((s) => String(s._id) === selectedSize) ?? product?.sizes[0],
    [product, selectedSize],
  );
  const extras = useMemo(
    () => (product?.extras ?? []).filter((e) => selectedExtras.includes(String(e._id))),
    [product, selectedExtras],
  );
  const lineTotal = (size?.price ?? product?.basePrice ?? 0) + extras.reduce((s, e) => s + e.price, 0);
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
  const lang = i18n.language;

  const toggleExtra = (id: string): void => {
    setSelectedExtras((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  };

  const handleAdd = (): void => {
    dispatch(
      addLine({
        productId: product._id,
        name: product.name,
        nameEn: product.nameEn,
        image: image ?? '',
        slug: product.slug,
        size: size?._id ?? null,
        sizeName: size ? (lang === 'ar' ? size.name : size.nameEn || size.name) : '',
        extras,
        qty,
        unitPrice: (size?.price ?? product.basePrice) + extras.reduce((s, e) => s + e.price, 0),
      }),
    );
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
            <Button variant="gold" size="lg" className="flex-1" onClick={handleAdd}>
              <Plus className="h-5 w-5" />
              {t('menu.addToCart')}
            </Button>
          </div>

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