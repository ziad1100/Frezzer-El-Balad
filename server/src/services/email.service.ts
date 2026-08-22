import env from '../config/env';
import { smtpConfigured, sendMail } from '../config/mailer';
import { getEmailQueue } from '../jobs/queue';

export { smtpConfigured };

const shellHtml = (body: string): string =>
  `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#0d0d0d;color:#fff;border-radius:12px">
    <h1 style="color:#38bdf8;text-align:center">فريزر البلد | Freezer El Balad</h1>
    ${body}
  </div>`;

interface EmailJob {
  name: string;
  data: Record<string, unknown>;
}

const ENQUEUE_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 500 },
};

/**
 * Offloads an email to the BullMQ queue when Redis is configured. If Redis is
 * unavailable (tests/dev without a broker) it sends inline, preserving the
 * original synchronous behaviour and the SMTP-less dev log fallback.
 */
export const enqueueEmail = async (job: EmailJob): Promise<void> => {
  const queue = getEmailQueue();
  if (!queue) {
    await dispatchEmailJob(job);
    return;
  }
  try {
    await queue.add(job.name, job.data, ENQUEUE_OPTS);
  } catch (err) {
    console.warn(`[jobs] email queue unavailable (${(err as Error).message}); sending inline`);
    await dispatchEmailJob(job);
  }
};

export const dispatchEmailJob = async (job: EmailJob): Promise<void> => {
  const { to, subject, html } = job.data as { to: string; subject: string; html: string };
  await sendMail(to, subject, html);
};

export const emailJobs = {
  verification: (to: string, token: string): EmailJob => ({
    name: 'notification.verification',
    data: {
      to,
      subject: 'تفعيل حسابك - فريزر البلد',
      html: shellHtml(`
        <p>أهلا بك! اضغط الزر التالي لتفعيل حسابك:</p>
        <a href="${env.clientUrl}/verify-email?token=${token}" style="display:inline-block;padding:12px 24px;background:#1E3A5F;color:#fff;text-decoration:none;border-radius:8px;margin:12px 0">تفعيل الحساب</a>
        <p style="color:#888;font-size:12px">إذا لم تطلب هذا، تجاهل الرسالة.</p>`),
    },
  }),
  emailChangeVerification: (to: string, token: string): EmailJob => ({
    name: 'notification.email-change',
    data: {
      to,
      subject: 'تأكيد تغيير البريد الإلكتروني - فريزر البلد',
      html: shellHtml(`
        <p>لقد طلبت تغيير بريدك الإلكتروني إلى <strong>${to}</strong>. اضغط الزر التالي لتأكيد التغيير:</p>
        <a href="${env.clientUrl}/admin/account?verify-email=${token}" style="display:inline-block;padding:12px 24px;background:#1E3A5F;color:#fff;text-decoration:none;border-radius:8px;margin:12px 0">تأكيد تغيير البريد</a>
        <p style="color:#888;font-size:12px">الرابط صالح لمدة 24 ساعة. إذا لم تطلب هذا، تجاهل الرسالة.</p>`),
    },
  }),
  resetOtp: (to: string, code: string): EmailJob => ({
    name: 'notification.reset-otp',
    data: {
      to,
      subject: 'كود إعادة تعيين كلمة المرور - فريزر البلد',
      html: shellHtml(`
        <p style="font-size:15px;line-height:1.6">استخدم الكود التالي لإعادة تعيين كلمة المرور. الكود صالح لمدة 15 دقيقة:</p>
        <div style="text-align:center;margin:16px 0">
          <span style="display:inline-block;font-size:34px;font-weight:800;letter-spacing:8px;background:#1E3A5F;color:#fff;padding:14px 26px;border-radius:10px">${code}</span>
        </div>
        <p style="color:#888;font-size:12px">أدخل الكود في صفحة إعادة تعيين كلمة المرور. إذا لم تطلب هذا، تجاهل الرسالة.</p>`),
    },
  }),
  orderConfirmation: (to: string, orderNo: string, total: number): EmailJob => ({
    name: 'notification.order-confirmation',
    data: {
      to,
      subject: `تأكيد الطلب ${orderNo} - فريزر البلد`,
      html: shellHtml(`
        <p>تم استلام طلبك <strong>${orderNo}</strong> ✅</p>
        <p>الإجمالي: <strong style="color:#f6b100">${total} ج.م</strong></p>
        <p style="color:#888">سنصلك في أقرب وقت 🍕</p>`),
    },
  }),
};

export const enqueueVerificationEmail = (to: string, token: string): Promise<void> =>
  enqueueEmail(emailJobs.verification(to, token));

export const enqueuePasswordResetOtp = (to: string, code: string): Promise<void> =>
  enqueueEmail(emailJobs.resetOtp(to, code));

export const enqueueEmailChangeVerification = (to: string, token: string): Promise<void> =>
  enqueueEmail(emailJobs.emailChangeVerification(to, token));

export const enqueueOrderConfirmation = (to: string, orderNo: string, total: number): Promise<void> =>
  enqueueEmail(emailJobs.orderConfirmation(to, orderNo, total));

/**
 * Legacy sync entry points, retained for the worker/dispatch path and any
 * external callers. Controllers should prefer `enqueue*`.
 */
export const sendVerificationEmail = async (to: string, token: string): Promise<void> =>
  dispatchEmailJob(emailJobs.verification(to, token));

export const sendPasswordResetOtpEmail = async (to: string, code: string): Promise<void> =>
  dispatchEmailJob(emailJobs.resetOtp(to, code));

export const sendOrderConfirmation = async (to: string, orderNo: string, total: number): Promise<void> =>
  dispatchEmailJob(emailJobs.orderConfirmation(to, orderNo, total));
