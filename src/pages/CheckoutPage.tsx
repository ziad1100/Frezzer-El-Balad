import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Lock, AlertTriangle, Tag, ShoppingBag, Check, CreditCard, Banknote, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createOrder, getSettings } from '@/api/orders';
import { getPaymentSettings, type PaymentSettings } from '@/api/payment';
import { VodafoneCashFlow } from '@/components/payment/VodafoneCashFlow';
import { CardPaymentFlow } from '@/components/payment/CardPaymentFlow';
import { InstaPayFlow } from '@/components/payment/InstaPayFlow';
import { validateCoupon } from '@/api/coupons';
import { clearCoupon, clearCart, selectSubtotal, setCoupon } from '@/store/slices/cartSlice';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ProductSearch, type SearchableProduct } from '@/components/ProductSearch';
import { FieldError, Input, Label, Textarea } from '@/components/ui/Input';
import { EGYPTIAN_MOBILE_REGEX } from '@/lib/validation';
import { cn, formatPrice } from '@/lib/utils';
import type { Role } from '@/types';
import vodafoneLogo from '@/assets/vodafone.jpeg';
import instapayLogo from '@/assets/instapay.jpeg';

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const lines = useAppSelector((state) => state.cart.lines);
  const subtotal = useAppSelector(selectSubtotal);
  const couponCode = useAppSelector((state) => state.cart.couponCode);
  const couponDiscount = useAppSelector((state) => state.cart.couponDiscount);
  const note = useAppSelector((state) => state.cart.note);
  type PaymentMethod = 'cash' | 'card' | 'vodafone_cash' | 'instapay';
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

  const isManualPayment = selectedPaymentMethod === 'vodafone_cash' || selectedPaymentMethod === 'instapay';
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
      <div className="container-px flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--tw-surface)]">
          <ShoppingBag className="h-10 w-10 text-[var(--tw-text-subtle)]" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-[var(--tw-text)]">{t('cart.empty')}</h1>
        <p className="mt-2 text-sm text-[var(--tw-text-muted)]">{t('cart.emptyHint')}</p>
        <Link to="/menu" className="mt-6">
          <Button>{t('cart.browseMenu')}</Button>
        </Link>
      </div>
    );
  }

  const effectiveFee = freeDeliveryOver > 0 && subtotal >= freeDeliveryOver ? 0 : deliveryFee;
  const total = subtotal + effectiveFee - couponDiscount;

  return (
    <div className="overflow-hidden">
      {/* ═══ Header ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-900/30 via-[var(--tw-bg)] to-[var(--tw-bg)]">
        <div className="container-px py-10 sm:py-14">
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
            <motion.h1 variants={fadeUp} className="text-2xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-3xl">
              {t('checkout.title')}
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-2 text-sm text-[var(--tw-text-muted)]">
              {i18n.language === 'ar' ? 'أكمل بياناتك لإتمام الطلب' : 'Complete your details to place the order'}
            </motion.p>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-500/5 blur-3xl" />
        </div>
      </section>

      {/* ═══ Main Content ═══ */}
      <div className="container-px pb-16">
        <div className="grid gap-6 lg:grid-cols-5">
          {/* ── Form ── */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="lg:col-span-3">
            <div className="rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-6 sm:p-8">
              {isAdmin ? (
                <form onSubmit={adminHandleSubmit((values) => adminOrderMutation.mutate(values))} className="space-y-8">
                  <AdminSearchSection
                    lang={i18n.language}
                    selectedSearchProduct={selectedSearchProduct}
                    searchSizeId={searchSizeId}
                    searchQty={searchQty}
                    onSearchSizeIdChange={setSearchSizeId}
                    onSearchQtyChange={setSearchQty}
                    onSelect={handleSearchProductPicked}
                    onAdd={handleAddSearchedProduct}
                    onClear={() => { setSelectedSearchProduct(null); setSearchSizeId(null); }}
                  />

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
                          <div key={`${line.productId}-${line.size ?? ''}`} className="rounded-2xl border border-[var(--tw-border)] bg-[var(--tw-surface-alt)] p-4">
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
                <form onSubmit={handleSubmit((values) => orderMutation.mutate(values))} className="space-y-8">
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
            </div>
          </motion.div>

          {/* ── Order Summary Sidebar ── */}
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { delay: 0.15, duration: 0.5 } } }} className="lg:col-span-2">
            <div className="sticky top-24 rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
                  <ShoppingBag className="h-5 w-5 text-brand-500" />
                </span>
                <h2 className="text-base font-bold text-[var(--tw-text)]">{t('cart.title')}</h2>
                <span className="ms-auto rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-bold text-brand-500">
                  {lines.length}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-3 border-b border-[var(--tw-border)] pb-4">
                {lines.map((line) => {
                  const effectivePrice = line.isCustomPrice && typeof line.customPrice === 'number' ? line.customPrice : line.unitPrice;
                  return (
                    <div key={`${line.productId}-${line.size ?? ''}`} className="flex items-center gap-3">
                      {line.image ? (
                        <img src={line.image} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--tw-surface)]">
                          <ShoppingBag className="h-4 w-4 text-[var(--tw-text-subtle)]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[var(--tw-text)]">
                          {i18n.language === 'ar' ? line.name : line.nameEn || line.name}
                        </p>
                        <p className="text-xs text-[var(--tw-text-muted)]">
                          ×{line.qty}
                          {line.sizeName && <span> · {line.sizeName}</span>}
                          {line.isCustomPrice && <span className="ms-1 text-gold-400">★</span>}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-[var(--tw-text)]">
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
                <span className="text-2xl font-extrabold tracking-tight text-brand-500">
                  {formatPrice(Math.max(0, total), i18n.language)}
                </span>
              </div>

              {subtotal < minimumOrder && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p className="text-xs leading-relaxed text-amber-400">
                    {t('checkout.minOrderRequired')}: {formatPrice(minimumOrder, i18n.language)}
                  </p>
                </div>
              )}

              {/* Free delivery hint */}
              {freeDeliveryOver > 0 && subtotal > 0 && subtotal < freeDeliveryOver && (
                <div className="mt-3 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-3 text-center">
                  <p className="text-xs text-brand-400">
                    {i18n.language === 'ar'
                      ? `أضف ${formatPrice(freeDeliveryOver - subtotal, i18n.language)} للتوصيل المجاني`
                      : `Add ${formatPrice(freeDeliveryOver - subtotal, i18n.language)} for free delivery`}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══ Payment Flow ═══ */}
      {createdOrderId && (
        <div className="container-px pb-16">
          <div className="mx-auto max-w-2xl rounded-3xl border border-[var(--tw-card-border)] bg-[var(--tw-card-bg)] p-6 sm:p-8">
            <h2 className="mb-4 text-xl font-extrabold tracking-tight text-[var(--tw-text)]">
              {i18n.language === 'ar' ? '💳 إتمام الدفع' : '💳 Complete Payment'}
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
            {selectedPaymentMethod === 'instapay' && paymentSettings.data?.instapay && (
              <InstaPayFlow
                orderId={createdOrderId}
                amount={Math.max(0, total)}
                settings={paymentSettings.data.instapay}
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
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Helper Components ═══ */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold tracking-tight text-[var(--tw-text)]">{title}</h3>
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

type PaymentMethod = 'cash' | 'card' | 'vodafone_cash' | 'instapay';

/* ── Payment Method Config ───────────────────────────────────── */
const PAYMENT_METHODS: Array<{
  value: PaymentMethod;
  icon: ReactNode;
  image?: string;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  requiresSettings?: keyof PaymentSettings;
}> = [
  { value: 'cash', icon: <Banknote className="h-5 w-5" />, labelAr: 'الدفع عند الاستلام', labelEn: 'Cash on Delivery', descAr: 'ادفع عند استلام الطلب', descEn: 'Pay when you receive your order', requiresSettings: 'cashOnDelivery' },
  { value: 'vodafone_cash', icon: <Banknote className="h-5 w-5" />, image: vodafoneLogo, labelAr: 'Vodafone Cash', labelEn: 'Vodafone Cash', descAr: 'محفظة إلكترونية', descEn: 'Digital wallet transfer', requiresSettings: 'vodafoneCash' },
  { value: 'instapay', icon: <Banknote className="h-5 w-5" />, image: instapayLogo, labelAr: 'InstaPay', labelEn: 'InstaPay', descAr: 'تحويل فوري عبر InstaPay', descEn: 'Instant transfer via InstaPay', requiresSettings: 'instapay' },
  { value: 'card', icon: <CreditCard className="h-5 w-5" />, labelAr: 'بطاقة ائتمان', labelEn: 'Card', descAr: 'دفع إلكتروني آمن', descEn: 'Secure online payment', requiresSettings: 'card' },
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {enabledMethods.map((method) => (
        <label
          key={method.value}
          className={cn(
            'group relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-4 transition-all duration-200',
            value === method.value
              ? 'border-brand-500 bg-brand-500/10 shadow-sm shadow-brand-500/5'
              : 'border-[var(--tw-border-strong)] hover:border-brand-500/30 hover:bg-[var(--tw-surface-alt)]',
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
          {/* Logo / Icon */}
          {method.image ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--tw-surface)]">
              <img
                src={method.image}
                alt={lang === 'ar' ? method.labelAr : method.labelEn}
                className="h-full w-full object-contain p-1"
              />
            </span>
          ) : (
            <span className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
              value === method.value ? 'bg-brand-500/20 text-brand-500' : 'bg-[var(--tw-surface)] text-[var(--tw-text-subtle)] group-hover:text-brand-400',
            )}>
              {method.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <span className={cn('text-sm font-bold', value === method.value ? 'text-[var(--tw-text)]' : 'text-[var(--tw-text-muted)]')}>
              {lang === 'ar' ? method.labelAr : method.labelEn}
            </span>
            <p className="text-xs text-[var(--tw-text-subtle)]">
              {lang === 'ar' ? method.descAr : method.descEn}
            </p>
          </div>
          {value === method.value && (
            <span className="absolute end-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm">
              <Check className="h-3.5 w-3.5" />
            </span>
          )}
        </label>
      ))}
    </div>
  );
}

function AdminSearchSection({ lang, selectedSearchProduct, searchSizeId, searchQty, onSearchSizeIdChange, onSearchQtyChange, onSelect, onAdd, onClear }: {
  lang: string;
  selectedSearchProduct: AdminSearchProduct | null;
  searchSizeId: string | null;
  searchQty: number;
  onSearchSizeIdChange: (id: string | null) => void;
  onSearchQtyChange: (qty: number) => void;
  onSelect: (product: SearchableProduct) => void;
  onAdd: () => void;
  onClear: () => void;
}) {
  return (
    <Section title={lang === 'ar' ? '🔍 بحث سريع عن منتج' : '🔍 Quick Product Search'}>
      <ProductSearch
        onSelect={onSelect}
        searchFn={adminSearchProducts}
        placeholder={lang === 'ar' ? 'اكتب اسم المنتج...' : 'Type product name...'}
      />

      {selectedSearchProduct && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4">
          <div className="mb-3 flex items-start gap-3">
            {selectedSearchProduct.images?.[0] && (
              <img
                src={selectedSearchProduct.images[0]}
                alt={lang === 'ar' ? selectedSearchProduct.name : selectedSearchProduct.nameEn || selectedSearchProduct.name}
                className="h-14 w-14 rounded-xl object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[var(--tw-text)]">
                {lang === 'ar' ? selectedSearchProduct.name : selectedSearchProduct.nameEn || selectedSearchProduct.name}
              </p>
              <p className="text-sm font-extrabold text-brand-500">
                {formatPrice(selectedSearchProduct.basePrice, lang)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
            >
              ✕
            </button>
          </div>

          {selectedSearchProduct.sizes && selectedSearchProduct.sizes.length > 0 && (
            <div className="mb-3">
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
                {lang === 'ar' ? 'النوع / الوزن' : 'Variant / Weight'}
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedSearchProduct.sizes.map((size) => (
                  <button
                    key={size._id}
                    type="button"
                    disabled={!size.isAvailable}
                    onClick={() => onSearchSizeIdChange(size._id!)}
                    className={cn(
                      'rounded-xl border-2 px-3 py-2 text-xs font-bold transition-all duration-200',
                      searchSizeId === size._id
                        ? 'border-brand-500 bg-brand-500/15 text-brand-400 shadow-sm'
                        : size.isAvailable
                          ? 'border-[var(--tw-border-strong)] text-[var(--tw-text-muted)] hover:border-brand-500/50'
                          : 'border-[var(--tw-border)] text-[var(--tw-border-strong)] opacity-50',
                    )}
                  >
                    {lang === 'ar' ? size.name : (size.nameEn || size.name)}
                    {' — '}{formatPrice(size.price, lang)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-3 flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-widest text-[var(--tw-text-muted)]">
              {lang === 'ar' ? 'الكمية' : 'Qty'}
            </label>
            <div className="flex items-center gap-0 rounded-xl border-2 border-[var(--tw-border-strong)] bg-[var(--tw-surface)]">
              <button
                type="button"
                onClick={() => onSearchQtyChange(Math.max(1, searchQty - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-l-xl text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-10 text-center text-sm font-bold tabular-nums text-[var(--tw-text)]">{searchQty}</span>
              <button
                type="button"
                onClick={() => onSearchQtyChange(Math.min(99, searchQty + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-r-xl text-[var(--tw-text-muted)] transition-colors hover:bg-[var(--tw-hover)] hover:text-[var(--tw-text)]"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <Button onClick={onAdd} className="w-full" size="sm">
            {lang === 'ar' ? 'إضافة للطلب' : 'Add to Order'}
          </Button>
        </motion.div>
      )}
    </Section>
  );
}

// Import type for AdminSearchProduct
import type { AdminSearchProduct } from '@/api/admin';
import { adminSearchProducts } from '@/api/admin';
