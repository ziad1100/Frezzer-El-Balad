import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, AlertTriangle, Tag, ShoppingBag, Check, CreditCard, Banknote, Smartphone, Building, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { createOrder, getSettings } from '@/api/orders';
import { getPaymentSettings, type PaymentSettings } from '@/api/payment';
import { VodafoneCashFlow } from '@/components/payment/VodafoneCashFlow';
import { CardPaymentFlow } from '@/components/payment/CardPaymentFlow';
import { BankTransferFlow } from '@/components/payment/BankTransferFlow';
import { validateCoupon } from '@/api/coupons';
import { clearCoupon, clearCart, selectSubtotal, setCoupon } from '@/store/slices/cartSlice';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ProductSearch, type SearchableProduct } from '@/components/ProductSearch';
import { Card, CardContent, EmptyState } from '@/components/ui/Card';
import { FieldError, Input, Label, Textarea } from '@/components/ui/Input';
import { EGYPTIAN_MOBILE_REGEX } from '@/lib/validation';
import { cn, formatPrice } from '@/lib/utils';
import type { Role } from '@/types';

export function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const lines = useAppSelector((state) => state.cart.lines);
  const subtotal = useAppSelector(selectSubtotal);
  const couponCode = useAppSelector((state) => state.cart.couponCode);
  const couponDiscount = useAppSelector((state) => state.cart.couponDiscount);
  const note = useAppSelector((state) => state.cart.note);
  type PaymentMethod = 'cash' | 'card' | 'vodafone_cash' | 'bank_transfer' | 'instapay';
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const paymentSettings = useQuery({ queryKey: ['payment-settings'], queryFn: getPaymentSettings });
  const deliveryFee = useMemo(
    () => Number((settings.data?.deliveryFee ?? 0) as number),
    [settings.data],
  );
  const minimumOrder = Number((settings.data?.minimumOrder ?? 100) as number);
  const freeDeliveryOver = Number((settings.data?.freeDeliveryOver ?? 0) as number);

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');

  const schema = z.object({
    phone: z.string().trim().regex(EGYPTIAN_MOBILE_REGEX, t('common.phoneInvalid')),
    customerName: z.string().min(2),
    city: z.string().min(2),
    street: z.string().min(2),
    building: z.string().min(1),
  });
  type FormValues = z.infer<typeof schema>;

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { customerName: '', phone: '', city: '', street: '', building: '' },
  });

  const couponMutation = useMutation({
    mutationFn: (code: string) => validateCoupon(code, subtotal),
    onSuccess: (result) => {
      dispatch(setCoupon({ code: result.code, discount: result.amount }));
      setCouponError('');
      toast.success(t('cart.couponApplied'));
    },
    onError: (error) => setCouponError(getErrorMessage(error)),
  });

  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === ('admin' as Role) || user?.role === ('manager' as Role);

  const adminSchema = z.object({
    customerName: z.string().optional(),
    phone: z.string().optional(),
    city: z.string().optional(),
    street: z.string().optional(),
    building: z.string().optional(),
  });
  type AdminFormValues = z.infer<typeof adminSchema>;

  const { register: adminRegister, handleSubmit: adminHandleSubmit, formState: { errors: adminErrors } } = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    mode: 'onBlur',
    defaultValues: { customerName: '', phone: '', city: '', street: '', building: '' },
  });

  const [selectedSearchProduct, setSelectedSearchProduct] = useState<AdminSearchProduct | null>(null);
  const [searchSizeId, setSearchSizeId] = useState<string | null>(null);
  const [searchQty, setSearchQty] = useState(1);

  const [customPrices, setCustomPrices] = useState<Record<number, number>>({});
  const [customPriceEnabled, setCustomPriceEnabled] = useState<Record<number, boolean>>({});

  const toggleCustomPrice = (index: number) => {
    setCustomPriceEnabled((prev) => ({ ...prev, [index]: !prev[index] }));
    if (customPriceEnabled[index]) {
      setCustomPrices((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      dispatch({ type: 'cart/setCustomPrice', payload: { index, customPrice: undefined, isCustomPrice: false } });
    }
  };

  const updateCustomPrice = (index: number, value: string) => {
    const num = parseFloat(value);
    if (!Number.isNaN(num) && num >= 0) {
      setCustomPrices((prev) => ({ ...prev, [index]: num }));
      dispatch({ type: 'cart/setCustomPrice', payload: { index, customPrice: num, isCustomPrice: true } });
    }
  };

  const handleSearchProductPicked = (product: SearchableProduct) => {
    const ap = product as unknown as AdminSearchProduct;
    setSelectedSearchProduct(ap);
    const firstSize = ap.sizes?.find((s) => s.isAvailable);
    setSearchSizeId(firstSize?._id ?? null);
    setSearchQty(1);
  };

  const handleAddSearchedProduct = () => {
    if (!selectedSearchProduct) return;
    const size = selectedSearchProduct.sizes?.find((s) => s._id === searchSizeId);
    const unitPrice = size?.price ?? selectedSearchProduct.basePrice;
    dispatch({
      type: 'cart/addLine',
      payload: {
        productId: selectedSearchProduct._id,
        name: selectedSearchProduct.name,
        nameEn: selectedSearchProduct.nameEn || selectedSearchProduct.name,
        image: selectedSearchProduct.images?.[0] ?? '',
        slug: selectedSearchProduct.nameEn?.toLowerCase().replace(/\s+/g, '-') ?? selectedSearchProduct.name,
        size: searchSizeId,
        sizeName: size ? (i18n.language === 'ar' ? size.name : (size.nameEn || size.name)) : '',
        extras: [],
        qty: searchQty,
        unitPrice,
      },
    });
    toast.success(
      i18n.language === 'ar'
        ? `تمت إضافة ${selectedSearchProduct.name} للطلب`
        : `Added ${selectedSearchProduct.nameEn || selectedSearchProduct.name} to order`,
    );
    setSelectedSearchProduct(null);
    setSearchSizeId(null);
    setSearchQty(1);
  };

  const buildOrderPayload = (values: FormValues | AdminFormValues) => {
    const hasAddress = values.city && values.street && values.building;
    return {
      items: lines.map((line) => ({
        product: line.productId,
        size: line.customWeight ? null : line.size,
        sizeName: line.customWeight ? line.customWeight.display : line.sizeName,
        extras: line.extras.map((e) => ({ name: e.name, price: e.price })),
        qty: line.qty,
        ...(isAdmin && line.isCustomPrice && typeof line.customPrice === 'number'
          ? { customPrice: line.customPrice }
          : {}),
        ...(line.customWeight ? { customWeight: line.customWeight } : {}),
      })),
      couponCode: couponCode || undefined,
      ...(hasAddress
        ? {
            address: {
              label: 'Home',
              city: values.city!,
              street: values.street!,
              building: values.building!,
            },
          }
        : {}),
      ...(values.phone ? { phone: values.phone } : {}),
      ...(values.customerName ? { customerName: values.customerName } : {}),
      notes: note,
      paymentMethod: selectedPaymentMethod,
    };
  };

  const isManualPayment = selectedPaymentMethod === 'vodafone_cash' || selectedPaymentMethod === 'bank_transfer' || selectedPaymentMethod === 'instapay';
  const isCardPayment = selectedPaymentMethod === 'card';

  const orderMutation = useMutation({
    mutationFn: (values: FormValues) => createOrder(buildOrderPayload(values)),
    onSuccess: (order) => {
      if (isManualPayment || isCardPayment) {
        setCreatedOrderId(order._id);
        toast.success(t('checkout.orderSuccess'));
      } else {
        dispatch(clearCoupon());
        dispatch(clearCart());
        toast.success(t('checkout.orderSuccess'));
        navigate(isAdmin ? '/admin/orders' : '/orders', { replace: true });
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const adminOrderMutation = useMutation({
    mutationFn: (values: AdminFormValues) => createOrder(buildOrderPayload(values)),
    onSuccess: (order) => {
      if (isManualPayment || isCardPayment) {
        setCreatedOrderId(order._id);
        toast.success(t('checkout.orderSuccess'));
      } else {
        dispatch(clearCoupon());
        dispatch(clearCart());
        toast.success(t('checkout.orderSuccess'));
        navigate('/admin/orders', { replace: true });
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (lines.length === 0) {
    return (
      <div className="container-px py-24">
        <EmptyState
          title={t('cart.empty')}
          hint={t('cart.emptyHint')}
          action={
            <Link to="/menu">
              <Button variant="fresh">{t('cart.browseMenu')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const effectiveFee = freeDeliveryOver > 0 && subtotal >= freeDeliveryOver ? 0 : deliveryFee;
  const total = subtotal + effectiveFee - couponDiscount;

  return (
    <div className="container-px py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--tw-text)]">{t('checkout.title')}</h1>
        <p className="mt-1.5 text-sm text-[var(--tw-text-muted)]">
          {i18n.language === 'ar' ? 'أكمل بياناتك لإتمام الطلب' : 'Complete your details to place the order'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <Card className="lg:col-span-3">
          <CardContent className="p-6">
            {isAdmin ? (
              <form onSubmit={adminHandleSubmit((values) => adminOrderMutation.mutate(values))} className="space-y-6">
                <Section title={i18n.language === 'ar' ? 'بحث سريع عن منتج' : 'Quick Product Search'}>
                  <ProductSearch
                    onSelect={handleSearchProductPicked}
                    searchFn={adminSearchProducts}
                    placeholder={i18n.language === 'ar' ? 'اكتب اسم المنتج...' : 'Type product name...'}
                  />

                  {selectedSearchProduct && (
                    <div className="mt-3 rounded-xl border border-[var(--tw-border-strong)] bg-[var(--tw-surface-alt)]/50 p-4">
                      <div className="mb-3 flex items-start gap-3">
                        {selectedSearchProduct.images?.[0] && (
                          <img
                            src={selectedSearchProduct.images[0]}
                            alt={i18n.language === 'ar' ? selectedSearchProduct.name : selectedSearchProduct.nameEn || selectedSearchProduct.name}
                            className="h-12 w-12 rounded-xl object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[var(--tw-text)]">
                            {i18n.language === 'ar' ? selectedSearchProduct.name : selectedSearchProduct.nameEn || selectedSearchProduct.name}
                          </p>
                          <p className="text-xs text-brand-400">
                            {formatPrice(selectedSearchProduct.basePrice, i18n.language)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSelectedSearchProduct(null); setSearchSizeId(null); }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
                        >
                          ✕
                        </button>
                      </div>

                      {selectedSearchProduct.sizes && selectedSearchProduct.sizes.length > 0 && (
                        <div className="mb-3">
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
                            {i18n.language === 'ar' ? 'النوع / الوزن' : 'Variant / Weight'}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {selectedSearchProduct.sizes.map((size) => (
                              <button
                                key={size._id}
                                type="button"
                                disabled={!size.isAvailable}
                                onClick={() => setSearchSizeId(size._id!)}
                                className={cn(
                                  'rounded-xl border-2 px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                                  searchSizeId === size._id
                                    ? 'border-brand-500 bg-brand-500/15 text-brand-400 shadow-sm'
                                    : size.isAvailable
                                      ? 'border-[var(--tw-border-strong)] text-[var(--tw-text-muted)] hover:border-brand-500/50 hover:text-brand-400'
                                      : 'border-[var(--tw-border)] text-[var(--tw-border-strong)] opacity-50',
                                )}
                              >
                                {i18n.language === 'ar' ? size.name : (size.nameEn || size.name)}
                                {' — '}{formatPrice(size.price, i18n.language)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mb-3 flex items-center gap-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
                          {i18n.language === 'ar' ? 'الكمية' : 'Qty'}
                        </label>
                        <div className="flex items-center gap-0.5 rounded-xl border-2 border-[var(--tw-border-strong)] bg-[var(--tw-surface)]">
                          <button
                            type="button"
                            onClick={() => setSearchQty((q) => Math.max(1, q - 1))}
                            className="flex h-7 w-7 items-center justify-center rounded-l-xl text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={searchQty}
                            onChange={(e) => setSearchQty(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                            className="w-12 border-0 bg-transparent px-1 py-1 text-center text-sm font-bold tabular-nums text-[var(--tw-text)] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setSearchQty((q) => Math.min(99, q + 1))}
                            className="flex h-7 w-7 items-center justify-center rounded-r-xl text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <Button onClick={handleAddSearchedProduct} className="w-full" size="sm">
                        {i18n.language === 'ar' ? 'إضافة للطلب' : 'Add to Order'}
                      </Button>
                    </div>
                  )}
                </Section>

                <Section title={i18n.language === 'ar' ? 'معلومات العميل (اختياري)' : 'Customer Info (optional)'}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>{t('checkout.name')}</Label>
                      <Input {...adminRegister('customerName')} error={Boolean(adminErrors.customerName)} />
                      <FieldError message={adminErrors.customerName?.message} />
                    </div>
                    <div>
                      <Label>{t('checkout.phone')}</Label>
                      <Input dir="ltr" inputMode="numeric" maxLength={11} {...adminRegister('phone')} error={Boolean(adminErrors.phone)} />
                      <FieldError message={adminErrors.phone?.message} />
                    </div>
                  </div>
                </Section>

                <Section title={i18n.language === 'ar' ? 'عنوان التوصيل (اختياري)' : 'Delivery Address (optional)'}>
                  <div className="space-y-4">
                    <div>
                      <Label>{t('checkout.city')}</Label>
                      <Input {...adminRegister('city')} error={Boolean(adminErrors.city)} />
                      <FieldError message={adminErrors.city?.message} />
                    </div>
                    <div>
                      <Label>{t('checkout.street')}</Label>
                      <Input {...adminRegister('street')} error={Boolean(adminErrors.street)} />
                      <FieldError message={adminErrors.street?.message} />
                    </div>
                    <div>
                      <Label>{t('checkout.building')}</Label>
                      <Input {...adminRegister('building')} error={Boolean(adminErrors.building)} />
                      <FieldError message={adminErrors.building?.message} />
                    </div>
                  </div>
                </Section>

                <Section title={i18n.language === 'ar' ? 'السعر المخصص' : 'Custom Pricing'}>
                  <div className="space-y-3">
                    {lines.map((line, idx) => {
                      const normalPrice = line.unitPrice;
                      const isEnabled = customPriceEnabled[idx] ?? line.isCustomPrice ?? false;
                      const currentCustom = customPrices[idx] ?? line.customPrice;
                      return (
                        <div key={`${line.productId}-${line.size ?? ''}`} className="rounded-xl border border-[var(--tw-border)] bg-[var(--tw-card-bg)] p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-[var(--tw-text-muted)]">
                              {i18n.language === 'ar' ? line.name : line.nameEn || line.name}
                              {line.sizeName && <span className="text-[var(--tw-text-muted)]"> ({line.sizeName})</span>}
                              <span className="text-[var(--tw-text-muted)]"> × {line.qty}</span>
                            </span>
                            <span className="text-sm font-bold text-[var(--tw-text)]">
                              {formatPrice(normalPrice, i18n.language)}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-[var(--tw-text-muted)]">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={() => toggleCustomPrice(idx)}
                                className="h-4 w-4 rounded border-[var(--tw-border-strong)] bg-[var(--tw-surface-alt)] text-brand-500 focus:ring-brand-500"
                              />
                              {i18n.language === 'ar' ? 'سعر مخصص' : 'Custom Price'}
                            </label>
                            {isEnabled && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={currentCustom ?? ''}
                                  onChange={(e) => updateCustomPrice(idx, e.target.value)}
                                  className="w-24"
                                  dir="ltr"
                                  placeholder={i18n.language === 'ar' ? 'السعر' : 'Price'}
                                />
                                <span className="text-xs text-[var(--tw-text-muted)]">EGP</span>
                              </div>
                            )}
                          </div>
                          {isEnabled && typeof currentCustom === 'number' && (
                            <div className="mt-1.5 text-xs font-semibold text-gold-400">
                              {i18n.language === 'ar' ? 'السعر المطبق' : 'Applied Price'}: {formatPrice(currentCustom, i18n.language)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Section>

                <Section title={t('checkout.notes')}>
                  <Textarea rows={3} value={note} onChange={(e) => dispatch({ type: 'cart/setNote', payload: e.target.value })} />
                </Section>

                <Section title={t('checkout.paymentMethod')}>
                  <PaymentMethodSelector lang={i18n.language} value={selectedPaymentMethod} onChange={setSelectedPaymentMethod} paymentSettings={paymentSettings.data} />
                </Section>

                <Button type="submit" size="lg" className="w-full" loading={adminOrderMutation.isPending}>
                  <Lock className="h-5 w-5" />
                  {i18n.language === 'ar' ? 'إنشاء الطلب' : t('checkout.placeOrder')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit((values) => orderMutation.mutate(values))} className="space-y-6">
                <Section title={t('checkout.contact')}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>{t('checkout.name')}</Label>
                      <Input {...register('customerName')} error={Boolean(errors.customerName)} />
                      <FieldError message={errors.customerName?.message} />
                    </div>
                    <div>
                      <Label>{t('checkout.phone')}</Label>
                      <Input dir="ltr" inputMode="numeric" maxLength={11} {...register('phone')} error={Boolean(errors.phone)} />
                      <FieldError message={errors.phone?.message} />
                    </div>
                  </div>
                </Section>

                <Section title={t('checkout.address')}>
                  <div className="space-y-4">
                    <div>
                      <Label>{t('checkout.city')}</Label>
                      <Input {...register('city')} error={Boolean(errors.city)} />
                      <FieldError message={errors.city?.message} />
                    </div>
                    <div>
                      <Label>{t('checkout.street')}</Label>
                      <Input {...register('street')} error={Boolean(errors.street)} />
                      <FieldError message={errors.street?.message} />
                    </div>
                    <div>
                      <Label>{t('checkout.building')}</Label>
                      <Input {...register('building')} error={Boolean(errors.building)} />
                      <FieldError message={errors.building?.message} />
                    </div>
                  </div>
                </Section>

                <Section title={t('checkout.notes')}>
                  <Textarea rows={3} value={note} onChange={(e) => dispatch({ type: 'cart/setNote', payload: e.target.value })} />
                </Section>

                <Section title={t('checkout.paymentMethod')}>
                  <PaymentMethodSelector lang={i18n.language} value={selectedPaymentMethod} onChange={setSelectedPaymentMethod} paymentSettings={paymentSettings.data} />
                </Section>

                <Button type="submit" size="lg" className="w-full" loading={orderMutation.isPending}>
                  <Lock className="h-5 w-5" />
                  {t('checkout.placeOrder')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card className="h-fit lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <h2 className="text-base font-bold text-[var(--tw-text)]">{t('cart.title')}</h2>
            </div>

            <div className="space-y-3 border-b border-[var(--tw-border)] pb-4">
              {lines.map((line) => {
                const effectivePrice = line.isCustomPrice && typeof line.customPrice === 'number' ? line.customPrice : line.unitPrice;
                return (
                  <div key={`${line.productId}-${line.size ?? ''}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="line-clamp-1 text-[var(--tw-text-muted)]">
                      {i18n.language === 'ar' ? line.name : line.nameEn || line.name}
                      <span className="text-[var(--tw-text-muted)]"> × {line.qty}</span>
                      {line.isCustomPrice && (
                        <span className="ms-1 text-xs text-gold-400">★</span>
                      )}
                    </span>
                    <span className="shrink-0 font-bold text-[var(--tw-text)]">
                      {formatPrice(effectivePrice * line.qty, i18n.language)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Coupon */}
            <div className="mt-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--tw-text-subtle)]" />
                  <Input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder={t('cart.couponPlaceholder')}
                    className="uppercase ps-9 text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => couponMutation.mutate(couponInput.trim())}
                  loading={couponMutation.isPending}
                >
                  {t('cart.couponApply')}
                </Button>
              </div>
              {couponError && <p className="mt-1.5 text-xs text-red-400">{couponError}</p>}
            </div>

            {/* Totals */}
            <div className="mt-5 space-y-3 text-sm">
              <Row label={t('cart.subtotal')} value={formatPrice(subtotal, i18n.language)} />
              <Row
                label={t('cart.delivery')}
                value={effectiveFee === 0 ? t('common.freeDelivery') : formatPrice(effectiveFee, i18n.language)}
                free={effectiveFee === 0}
              />
              {couponDiscount > 0 && (
                <Row label={`${t('cart.discount')} (${couponCode})`} value={formatPrice(-couponDiscount, i18n.language)} accent />
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[var(--tw-border)] pt-5">
              <span className="font-bold text-[var(--tw-text)]">{t('cart.total')}</span>
              <span className="text-2xl font-extrabold text-brand-500">
                {formatPrice(Math.max(0, total), i18n.language)}
              </span>
            </div>

            {subtotal < minimumOrder && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-xs leading-relaxed text-amber-400">
                  {t('checkout.minOrderRequired')}: {formatPrice(minimumOrder, i18n.language)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Flow */}
      {createdOrderId && (
        <div className="mt-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 text-xl font-bold text-[var(--tw-text)]">
                {i18n.language === 'ar' ? 'إتمام الدفع' : 'Complete Payment'}
              </h2>
              {selectedPaymentMethod === 'vodafone_cash' && paymentSettings.data?.vodafoneCash && (
                <VodafoneCashFlow
                  orderId={createdOrderId}
                  amount={Math.max(0, total)}
                  settings={paymentSettings.data.vodafoneCash}
                  onSuccess={() => {
                    dispatch(clearCoupon());
                    dispatch(clearCart());
                    navigate(isAdmin ? '/admin/orders' : '/orders', { replace: true });
                  }}
                  onCancel={() => setCreatedOrderId(null)}
                />
              )}
              {selectedPaymentMethod === 'bank_transfer' && paymentSettings.data?.bankTransfer && (
                <BankTransferFlow
                  orderId={createdOrderId}
                  amount={Math.max(0, total)}
                  settings={paymentSettings.data.bankTransfer}
                  onSuccess={() => {
                    dispatch(clearCoupon());
                    dispatch(clearCart());
                    navigate(isAdmin ? '/admin/orders' : '/orders', { replace: true });
                  }}
                  onCancel={() => setCreatedOrderId(null)}
                />
              )}
              {selectedPaymentMethod === 'card' && (
                <CardPaymentFlow
                  orderId={createdOrderId}
                  amount={Math.max(0, total)}
                  provider={paymentSettings.data?.card?.provider ?? 'none'}
                  onSuccess={() => {
                    dispatch(clearCoupon());
                    dispatch(clearCart());
                    navigate(isAdmin ? '/admin/orders' : '/orders', { replace: true });
                  }}
                  onCancel={() => setCreatedOrderId(null)}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-bold text-[var(--tw-text)]">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value, accent, free }: { label: string; value: string; accent?: boolean; free?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--tw-text-muted)]">{label}</span>
      <span className={cn('font-bold', accent ? 'text-gold-400' : free ? 'text-fresh-400' : 'text-[var(--tw-text)]')}>{value}</span>
    </div>
  );
}

type PaymentMethod = 'cash' | 'card' | 'vodafone_cash' | 'bank_transfer' | 'instapay';

const PAYMENT_METHODS: Array<{ value: PaymentMethod; icon: ReactNode; labelAr: string; labelEn: string; requiresSettings?: keyof PaymentSettings }> = [
  { value: 'cash', icon: <Banknote className="h-5 w-5" />, labelAr: 'الدفع عند الاستلام', labelEn: 'Cash on Delivery', requiresSettings: 'cashOnDelivery' },
  { value: 'vodafone_cash', icon: <Smartphone className="h-5 w-5" />, labelAr: 'فودافون كاش', labelEn: 'Vodafone Cash', requiresSettings: 'vodafoneCash' },
  { value: 'bank_transfer', icon: <Building className="h-5 w-5" />, labelAr: 'تحويل بنكي', labelEn: 'Bank Transfer', requiresSettings: 'bankTransfer' },
  { value: 'instapay', icon: <Zap className="h-5 w-5" />, labelAr: 'انستاباي', labelEn: 'InstaPay', requiresSettings: 'instapay' },
  { value: 'card', icon: <CreditCard className="h-5 w-5" />, labelAr: 'بطاقة ائتمان', labelEn: 'Credit Card', requiresSettings: 'card' },
];

function PaymentMethodSelector({ lang, value, onChange, paymentSettings }: {
  lang: string;
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
  paymentSettings?: PaymentSettings;
}) {
  const enabledMethods = PAYMENT_METHODS.filter((method) => {
    if (!paymentSettings || !method.requiresSettings) return true;
    const config = paymentSettings[method.requiresSettings];
    if (config && typeof config === 'object' && 'enabled' in config) {
      return config.enabled;
    }
    return true;
  });

  return (
    <div className="space-y-2">
      {enabledMethods.map((method) => (
        <label
          key={method.value}
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-all duration-200',
            value === method.value
              ? 'border-brand-500 bg-brand-500/10 shadow-sm shadow-brand-500/5'
              : 'border-[var(--tw-border-strong)] hover:border-brand-500/30 hover:bg-[var(--tw-hover)]',
          )}
        >
          <input
            type="radio"
            name="paymentMethod"
            value={method.value}
            checked={value === method.value}
            onChange={() => onChange(method.value)}
            className="sr-only"
          />
          <span className={cn('text-brand-500', value === method.value ? '' : 'text-[var(--tw-text-subtle)]')}>{method.icon}</span>
          <span className={cn('text-sm font-semibold', value === method.value ? 'text-[var(--tw-text)]' : 'text-[var(--tw-text-muted)]')}>
            {lang === 'ar' ? method.labelAr : method.labelEn}
          </span>
          {value === method.value && (
            <span className="ms-auto flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
              <Check className="h-3 w-3" />
            </span>
          )}
        </label>
      ))}
    </div>
  );
}

// Import type for AdminSearchProduct
import type { AdminSearchProduct } from '@/api/admin';
import { adminSearchProducts } from '@/api/admin';
