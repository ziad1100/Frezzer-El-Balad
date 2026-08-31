import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Send, Phone, Mail, MapPin, Clock, MessageCircle, Headphones, Snowflake } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FieldError, Input, Label, Textarea } from '@/components/ui/Input';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(8),
  message: z.string().min(10),
});
type FormValues = z.infer<typeof schema>;

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

export function ContactPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.post('/contacts', values),
    onSuccess: () => {
      toast.success(isAr ? 'تم إرسال رسالتك بنجاح!' : 'Your message has been sent!');
      reset();
    },
    onError: () => toast.error(t('misc.error')),
  });

  const contactInfo = [
    { icon: Phone, label: isAr ? 'الهاتف' : 'Phone', value: '01204019307', href: 'tel:01204019307', color: 'emerald' },
    { icon: MessageCircle, label: 'WhatsApp', value: isAr ? 'راسلنا على واتساب' : 'Chat on WhatsApp', href: '#', color: 'fresh' },
    { icon: Mail, label: isAr ? 'البريد الإلكتروني' : 'Email', value: 'info@freezerelbalad.com', href: 'mailto:info@freezerelbalad.com', color: 'brand' },
    { icon: MapPin, label: isAr ? 'العنوان' : 'Address', value: isAr ? 'القاهرة، مصر' : 'Cairo, Egypt', href: '#', color: 'gold' },
    { icon: Clock, label: isAr ? 'ساعات العمل' : 'Working Hours', value: isAr ? 'يومياً 9 صباحاً - 11 مساءً' : 'Daily 9AM - 11PM', href: undefined, color: 'ice' },
  ] as const;

  const colorMap: Record<string, { bg: string; text: string; hover: string }> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', hover: 'hover:bg-emerald-500/20' },
    fresh: { bg: 'bg-fresh-500/10', text: 'text-fresh-400', hover: 'hover:bg-fresh-500/20' },
    brand: { bg: 'bg-brand-500/10', text: 'text-brand-400', hover: 'hover:bg-brand-500/20' },
    gold: { bg: 'bg-gold-500/10', text: 'text-gold-400', hover: 'hover:bg-gold-500/20' },
    ice: { bg: 'bg-ice-500/10', text: 'text-ice-400', hover: 'hover:bg-ice-500/20' },
  };

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
                <Headphones className="h-3.5 w-3.5" />
                {isAr ? 'نحن هنا لمساعدتك' : 'We\'re Here to Help'}
              </span>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-3xl font-extrabold tracking-tight text-[var(--tw-text)] sm:text-4xl lg:text-5xl"
            >
              {t('nav.contact')}
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--tw-text-muted)] sm:text-lg"
            >
              {isAr
                ? 'نسعد بتواصلكم معنا لأي استفسار أو ملاحظة. فريقنا جاهز لمساعدتك.'
                : 'We\'d love to hear from you. Our team is ready to assist with any questions or feedback.'}
            </motion.p>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-500/5 blur-3xl" />
        </div>
      </section>

      {/* ═══ Contact Info Cards ═══ */}
      <section className="container-px py-12 sm:py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {contactInfo.map(({ icon: Icon, label, value, href, color }) => {
            const c = colorMap[color];
            const Wrapper = href ? 'a' : 'div';
            const wrapperProps = href ? { href, target: href.startsWith('http') ? '_blank' : undefined, rel: href.startsWith('http') ? 'noopener noreferrer' : undefined } : {};
            return (
              <motion.div key={label} variants={fadeUp} whileHover={{ y: -4 }}>
                <Wrapper
                  {...wrapperProps}
                  className={`group flex items-start gap-4 rounded-2xl border border-[var(--tw-border)] bg-[var(--tw-card-bg)] p-5 transition-all hover:shadow-lg hover:shadow-black/5 ${href ? 'cursor-pointer' : ''}`}
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.bg} ring-1 ring-inset ring-white/5 transition-transform group-hover:scale-110`}>
                    <Icon className={`h-5 w-5 ${c.text}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tw-text-muted)]">{label}</p>
                    <p className="mt-1 text-sm font-bold text-[var(--tw-text)] truncate">{value}</p>
                  </div>
                </Wrapper>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* ═══ Contact Form ═══ */}
      <section className="container-px pb-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeUp}
          className="mx-auto max-w-2xl"
        >
          <div className="rounded-3xl border border-[var(--tw-border)] bg-[var(--tw-card-bg)] p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
                <Send className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-[var(--tw-text)]">
                  {isAr ? 'أرسل لنا رسالة' : 'Send Us a Message'}
                </h2>
                <p className="text-xs text-[var(--tw-text-muted)]">
                  {isAr ? 'وسنرد عليك في أقرب وقت' : 'We\'ll get back to you as soon as possible'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t('auth.fullName')}</Label>
                  <Input {...register('name')} error={Boolean(errors.name)} placeholder={isAr ? 'الاسم الكامل' : 'Full name'} />
                  <FieldError message={errors.name?.message} />
                </div>
                <div>
                  <Label>{t('auth.email')} <span className="text-[var(--tw-text-muted)]">({isAr ? 'اختياري' : 'optional'})</span></Label>
                  <Input type="email" dir="ltr" {...register('email')} error={Boolean(errors.email)} placeholder="email@example.com" />
                  <FieldError message={errors.email?.message} />
                </div>
              </div>
              <div>
                <Label>{t('auth.phone')}</Label>
                <Input dir="ltr" {...register('phone')} error={Boolean(errors.phone)} placeholder="010 000 000 000" />
                <FieldError message={errors.phone?.message} />
              </div>
              <div>
                <Label>{t('checkout.notes')}</Label>
                <Textarea rows={5} {...register('message')} error={Boolean(errors.message)} placeholder={isAr ? 'اكتب رسالتك هنا...' : 'Write your message here...'} />
                <FieldError message={errors.message?.message} />
              </div>
              <Button type="submit" className="w-full" loading={mutation.isPending} size="lg">
                <Send className="h-5 w-5" />
                {isAr ? 'إرسال الرسالة' : 'Send Message'}
              </Button>
            </form>
          </div>
        </motion.div>
      </section>

      {/* ═══ CTA Banner ═══ */}
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
            {isAr ? 'هل تفضل الاتصال المباشر؟' : 'Prefer to call us directly?'}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--tw-text-muted)]">
            {isAr
              ? 'فريق خدمة العملاء متاح يومياً لمساعدتك.'
              : 'Our customer service team is available daily to assist you.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="tel:01204019307">
              <Button variant="primary" size="lg">
                <Phone className="h-4 w-4" />
                {isAr ? 'اتصل الآن' : 'Call Now'}
              </Button>
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
