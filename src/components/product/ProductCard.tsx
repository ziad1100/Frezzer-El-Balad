import { useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Flame, Heart, Minus, Plus, ShoppingBag } from 'lucide-react';
import type { Product } from '@/types';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { addLine, removeLine, updateQty } from '@/store/slices/cartSlice';
import { toggle as toggleWishlist } from '@/store/slices/wishlistSlice';
import { Badge } from '@/components/ui/Card';
import { StarRating } from '@/components/review/StarRating';
import { cn, formatPrice } from '@/lib/utils';

export function ProductCard({ product }: { product: Product }) {
  const { t: commonT, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const wishlist = useAppSelector((state) => state.wishlist.ids);
  const cartLines = useAppSelector((state) => state.cart.lines);
  const isWished = wishlist.includes(product._id);

  const price = useMemo(() => {
    if (product.sizes.length === 0) return product.basePrice;
    return Math.min(...product.sizes.map((s) => s.price));
  }, [product.sizes, product.basePrice]);
  const cheapestSize = useMemo(
    () => product.sizes.length > 0 ? [...product.sizes].sort((a, b) => a.price - b.price)[0] : null,
    [product.sizes],
  );
  const image = product.images[0];

  const lineIndex = cartLines.findIndex(
    (l) => l.productId === product._id && l.size === (cheapestSize?._id ?? null),
  );
  const inCartQty = lineIndex >= 0 ? cartLines[lineIndex].qty : 0;

  const handleAdd = (): void => {
    dispatch(
      addLine({
        productId: product._id, name: product.name, nameEn: product.nameEn,
        image: image ?? '', slug: product.slug,
        size: cheapestSize?._id ?? null,
        sizeName: cheapestSize ? (i18n.language === 'ar' ? cheapestSize.name : cheapestSize.nameEn || cheapestSize.name) : '',
        extras: [], qty: 1, unitPrice: price,
      }),
    );
  };

  const handleSub = (): void => {
    if (lineIndex < 0) return;
    if (cartLines[lineIndex].qty <= 1) {
      dispatch(removeLine(lineIndex));
    } else {
      dispatch(updateQty({ index: lineIndex, qty: cartLines[lineIndex].qty - 1 }));
    }
  };

  return (
    <div className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
      <Link to={`/product/${product.slug}`} className="flex flex-1 flex-col">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--tw-surface-alt)]">
          {image ? (
            <img
              src={image}
              alt={i18n.language === 'ar' ? product.name : product.nameEn || product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ShoppingBag className="h-12 w-12 text-[var(--tw-text-muted)]" />
            </div>
          )}
          {product.isBestSeller ? (
            <Badge tone="brand" className="absolute inset-s-3 top-3 shadow-lg">
              <Flame className="h-3 w-3" />
              {commonT('menu.bestSeller')}
            </Badge>
          ) : null}
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-[var(--tw-bg)]/0 opacity-0 transition-all duration-300 group-hover:bg-[var(--tw-bg)]/30 group-hover:opacity-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm">
              <ShoppingBag className="h-5 w-5" />
            </span>
          </span>
          <button
            onClick={(e) => { e.preventDefault(); dispatch(toggleWishlist(product._id)); }}
            className={cn(
              'absolute inset-e-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-colors',
              isWished ? 'bg-brand-500 text-white' : 'bg-[var(--tw-bg)]/70 text-[var(--tw-text)] hover:text-brand-500',
            )}
            aria-label="wishlist"
          >
            <Heart className={cn('h-4.5 w-4.5', isWished && 'fill-current')} />
          </button>
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <h3 className="line-clamp-1 text-sm font-semibold text-[var(--tw-text)] transition-colors group-hover:text-brand-500">
            {i18n.language === 'ar' ? product.name : product.nameEn || product.name}
          </h3>
          {product.labels && product.labels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {product.labels.slice(0, 3).map((lbl) => (
                <span
                  key={lbl._id}
                  className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-tight"
                  style={{
                    backgroundColor: `${lbl.color}20`,
                    color: lbl.color,
                    border: `1px solid ${lbl.color}40`,
                  }}
                >
                  {lbl.icon ? `${lbl.icon} ` : ''}{i18n.language === 'ar' ? lbl.name : (lbl.nameEn || lbl.name)}
                </span>
              ))}
              {product.labels.length > 3 ? (
                <span className="inline-flex items-center rounded-full bg-[var(--tw-surface-alt)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--tw-text-muted)]">
                  +{product.labels.length - 3}
                </span>
              ) : null}
            </div>
          ) : null}
          {product.reviewsCount > 0 ? (
            <div className="flex items-center gap-1.5">
              <StarRating value={Math.round(product.rating)} readOnly size="sm" ariaLabel={commonT('review.averageRating')} />
              <span className="text-xs font-bold text-[var(--tw-text-muted)]" dir="ltr">
                {product.rating.toFixed(1)}
              </span>
              <span className="text-xs text-[var(--tw-text-muted)]">{commonT('review.reviews', { count: product.reviewsCount })}</span>
            </div>
          ) : (
            <p className="text-xs text-[var(--tw-text-muted)]">{commonT('review.noReviews')}</p>
          )}
          <p className="line-clamp-1 text-sm text-[var(--tw-text-muted)]">
            {i18n.language === 'ar' ? product.description : product.descriptionEn || product.description}
          </p>
        </div>
      </Link>

      {/* Price + Add to Cart */}
      <div className="px-3.5 pb-3.5">
        <div className="flex items-center justify-between pt-1.5">
          <div>
            <span className="text-sm font-extrabold text-brand-500">
              {formatPrice(price, i18n.language)}
            </span>
            <span className="ms-1 text-xs text-[var(--tw-text-muted)]">{commonT('common.from')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSub}
              disabled={inCartQty === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--tw-border-strong)] text-[var(--tw-text-muted)] transition-colors hover:border-[var(--tw-border-strong)] hover:text-[var(--tw-text)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={commonT('cart.remove')}
            >
              <Minus className="h-5 w-5" />
            </button>
            <button
              onClick={handleAdd}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white transition-colors hover:bg-brand-600"
              aria-label={commonT('menu.addToCart')}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
