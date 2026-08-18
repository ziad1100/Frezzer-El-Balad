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

  const price = useMemo(() => Math.min(...product.sizes.map((s) => s.price)), [product.sizes]);
  const cheapestSize = useMemo(
    () => [...product.sizes].sort((a, b) => a.price - b.price)[0],
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
        productId: product._id,
        name: product.name,
        nameEn: product.nameEn,
        image: image ?? '',
        slug: product.slug,
        size: cheapestSize?._id ?? null,
        sizeName: cheapestSize ? (i18n.language === 'ar' ? cheapestSize.name : cheapestSize.nameEn || cheapestSize.name) : '',
        extras: [],
        qty: 1,
        unitPrice: price,
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
    <div className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-night-800 bg-night-900 transition-all duration-300 hover:-translate-y-1 hover:border-night-600 hover:shadow-xl hover:shadow-night-950">
      <Link to={`/product/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-4/3 overflow-hidden bg-night-800">
          {image ? (
            <img
              src={image}
              alt={i18n.language === 'ar' ? product.name : product.nameEn || product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ShoppingBag className="h-12 w-12 text-night-600" />
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
            className="absolute inset-0 flex items-center justify-center bg-night-950/0 opacity-0 transition-all duration-300 group-hover:bg-night-950/30 group-hover:opacity-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm">
              <ShoppingBag className="h-5 w-5" />
            </span>
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              dispatch(toggleWishlist(product._id));
            }}
            className={cn(
              'absolute inset-e-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-colors',
              isWished ? 'bg-brand-600 text-white' : 'bg-night-950/70 text-night-200 hover:text-brand-500',
            )}
            aria-label="wishlist"
          >
            <Heart className={cn('h-4.5 w-4.5', isWished && 'fill-current')} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-1 font-bold text-night-50 transition-colors group-hover:text-brand-500">
            {i18n.language === 'ar' ? product.name : product.nameEn || product.name}
          </h3>
          {product.reviewsCount > 0 ? (
            <div className="flex items-center gap-1.5">
              <StarRating value={Math.round(product.rating)} readOnly size="sm" ariaLabel={commonT('review.averageRating')} />
              <span className="text-xs font-bold text-night-300" dir="ltr">
                {product.rating.toFixed(1)}
              </span>
              <span className="text-xs text-night-500">{commonT('review.reviews', { count: product.reviewsCount })}</span>
            </div>
          ) : (
            <p className="text-xs text-night-500">{commonT('review.noReviews')}</p>
          )}
          <p className="line-clamp-1 text-sm text-night-400">
            {i18n.language === 'ar' ? product.description : product.descriptionEn || product.description}
          </p>
        </div>
      </Link>

      <div className="px-4 pb-4">
        <div className="flex items-center justify-between pt-2">
          <div>
            <span className="text-base font-extrabold text-brand-500">
              {formatPrice(price, i18n.language)}
            </span>
            <span className="ms-1 text-xs text-night-500">{commonT('common.from')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSub}
              disabled={inCartQty === 0}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-night-700 text-night-300 transition-colors hover:border-night-500 hover:text-night-50 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={commonT('cart.remove')}
            >
              <Minus className="h-5 w-5" />
            </button>
            <button
              onClick={handleAdd}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700"
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