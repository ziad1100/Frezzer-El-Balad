import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { createOrder, getSettings } from '@/api/orders';
import { validateCoupon } from '@/api/coupons';
import { clearCoupon, clearCart, selectSubtotal, setCoupon } from '@/store/slices/cartSlice';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'vodafone_cash'>('cash');

  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });
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

  // Admin: schema with optional customer info
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

  const buildOrderPayload = (values: FormValues | AdminFormValues) => {
    const hasAddress = values.city && values.street && values.building;
    return {
      items: lines.map((line) => ({
        product: line.productId,
        size: line.size,
        sizeName: line.sizeName,
        extras: line.extras.map((e) => ({ name: e.name, price: e.price })),
        qty: line.qty,
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

  const orderMutation = useMutation({
    mutationFn: (values: FormValues) => createOrder(buildOrderPayload(values)),
    onSuccess: () => {
      dispatch(clearCoupon());
      dispatch(clearCart());
      toast.success(t('checkout.orderSuccess'));
      navigate(isAdmin ? '/admin/orders' : '/orders', { replace: true });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const adminOrderMutation = useMutation({
    mutationFn: (values: AdminFormValues) => createOrder(buildOrderPayload(values)),
    onSuccess: () => {
      dispatch(clearCoupon());
      dispatch(clearCart());
      toast.success(t('checkout.orderSuccess'));
      navigate('/admin/orders', { replace: true });
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
              <Button variant="gold">{t('cart.browseMenu')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const effectiveFee = freeDeliveryOver > 0 && subtotal >= freeDeliveryOver ? 0 : deliveryFee;
  const total = subtotal + effectiveFee - couponDiscount;

  return (
    <div className="container-px py-12">
      <h1 className="mb-8 text-3xl font-extrabold text-night-50">{t('checkout.title')}</h1>
      <div className="grid gap-8 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent>
            {isAdmin ? (
              /* ── Admin: compact order-for-customer form ── */
              <form onSubmit={adminHandleSubmit((values) => adminOrderMutation.mutate(values))} className="space-y-5">
                <div className="rounded-lg border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm font-semibold text-gold-400">
                  {i18n.language === 'ar' ? 'إنشاء طلب للعميل' : 'Creating order for customer'}
                </div>

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

                <Section title={t('checkout.notes')}>
                  <Textarea rows={3} value={note} onChange={(e) => dispatch({ type: 'cart/setNote', payload: e.target.value })} />
                </Section>

                <Section title={t('checkout.paymentMethod')}>
                  <PaymentMethodSelector lang={i18n.language} value={selectedPaymentMethod} onChange={setSelectedPaymentMethod} />
                </Section>

                <Button type="submit" size="lg" className="w-full" loading={adminOrderMutation.isPending}>
                  <Lock className="h-5 w-5" />
                  {i18n.language === 'ar' ? 'إنشاء الطلب' : t('checkout.placeOrder')}
                </Button>
              </form>
            ) : (
              /* ── Customer: existing checkout form (unchanged) ── */
              <form onSubmit={handleSubmit((values) => orderMutation.mutate(values))} className="space-y-5">
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
                  <PaymentMethodSelector lang={i18n.language} value={selectedPaymentMethod} onChange={setSelectedPaymentMethod} />
                </Section>

                <Button type="submit" size="lg" className="w-full" loading={orderMutation.isPending}>
                  <Lock className="h-5 w-5" />
                  {t('checkout.placeOrder')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit lg:col-span-2">
          <CardContent>
            <h2 className="mb-4 text-lg font-bold text-night-50">{t('cart.title')}</h2>
            <div className="space-y-3 border-b border-night-800 pb-4">
              {lines.map((line) => (
                <div key={`${line.productId}-${line.size ?? ''}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="line-clamp-1 text-night-200">
                    {i18n.language === 'ar' ? line.name : line.nameEn || line.name}
                    <span className="text-night-500"> × {line.qty}</span>
                  </span>
                  <span className="shrink-0 font-bold text-night-100">
                    {formatPrice(line.unitPrice * line.qty, i18n.language)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <Input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder={t('cart.couponPlaceholder')}
                className="uppercase"
              />
              <Button
                variant="outline"
                onClick={() => couponMutation.mutate(couponInput.trim())}
                loading={couponMutation.isPending}
              >
                {t('cart.couponApply')}
              </Button>
            </div>
            {couponError ? <p className="mt-1 text-sm text-red-400">{couponError}</p> : null}

            <div className="mt-4 space-y-2 text-sm">
              <Row label={t('cart.subtotal')} value={formatPrice(subtotal, i18n.language)} />
              <Row
                label={t('cart.delivery')}
                value={effectiveFee === 0 ? t('common.freeDelivery') : formatPrice(effectiveFee, i18n.language)}
              />
              {couponDiscount > 0 ? (
                <Row label={`${t('cart.discount')} (${couponCode})`} value={formatPrice(-couponDiscount, i18n.language)} accent />
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-night-800 pt-4">
              <span className="font-bold text-night-50">{t('cart.total')}</span>
              <span className="text-2xl font-extrabold text-brand-500">
                {formatPrice(Math.max(0, total), i18n.language)}
              </span>
            </div>
            {subtotal < minimumOrder ? (
              <p className="mt-3 rounded-lg border border-gold-500/40 bg-gold-500/10 p-2 text-xs text-gold-400">
                {t('checkout.minOrderRequired')}: {formatPrice(minimumOrder, i18n.language)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-night-300">
        <span className="h-px flex-1 bg-night-800" />
        {title}
        <span className="h-px flex-1 bg-night-800" />
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-night-400">{label}</span>
      <span className={cn('font-bold', accent ? 'text-gold-400' : 'text-night-100')}>{value}</span>
    </div>
  );
}

const PAYMENT_METHODS = [
  { value: 'cash' as const, icon: '💵', labelAr: 'الدفع عند الاستلام', labelEn: 'Cash on Delivery' },
  { value: 'card' as const, icon: '💳', labelAr: 'بطاقة ائتمان', labelEn: 'Credit Card' },
  { value: 'vodafone_cash' as const, icon: '📱', labelAr: 'فودافون كاش', labelEn: 'Vodafone Cash' },
];

function PaymentMethodSelector({ lang, value, onChange }: { lang: string; value: 'cash' | 'card' | 'vodafone_cash'; onChange: (v: 'cash' | 'card' | 'vodafone_cash') => void }) {
  return (
    <div className="space-y-2">
      {PAYMENT_METHODS.map((method) => (
        <label
          key={method.value}
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
            value === method.value
              ? 'border-brand-500 bg-brand-500/10 text-night-50'
              : 'border-night-700 text-night-400 hover:border-night-600',
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
          <span className="text-lg">{method.icon}</span>
          <span className="text-sm font-semibold">
            {lang === 'ar' ? method.labelAr : method.labelEn}
          </span>
          {value === method.value && (
            <span className="ms-auto h-2 w-2 rounded-full bg-brand-500" />
          )}
        </label>
      ))}
    </div>
  );
}