import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, Label } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { Order } from '@/types';
import { generateOrderPdf, generateOrderPdfDataUrl } from '@/lib/orderPdf';

interface PdfPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  order: Order;
}

/** Stages of PDF generation with labels. */
const STAGES = {
  init: { ar: 'تهيئة', en: 'Initializing' },
  header: { ar: 'إنشاء الرأس', en: 'Building header' },
  customer: { ar: 'معلومات العميل', en: 'Customer info' },
  items: { ar: 'المنتجات', en: 'Order items' },
  totals: { ar: 'المجاميع', en: 'Calculating totals' },
  render: { ar: 'المعاينة', en: 'Rendering preview' },
  done: { ar: 'اكتمل', en: 'Complete' },
} as const;

type StageKey = keyof typeof STAGES;

const STAGE_ORDER: StageKey[] = ['init', 'header', 'customer', 'items', 'totals', 'render', 'done'];

export function PdfPreviewDialog({ open, onClose, order }: PdfPreviewDialogProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';

  const [pdfLang, setPdfLang] = useState<'ar' | 'en'>(isAr ? 'ar' : 'en');
  const [generating, setGenerating] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<StageKey>('init');
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(false);

  // Calculate item count for progress estimation
  const itemCount = order.items.length;
  const isLargeOrder = itemCount > 10;

  useEffect(() => {
    if (!open) {
      setPdfDataUrl(null);
      setError(null);
      setStage('init');
      setProgress(0);
      abortRef.current = false;
      return;
    }

    setGenerating(true);
    setError(null);
    setStage('init');
    setProgress(0);
    abortRef.current = false;

    const run = async () => {
      try {
        // Stage 1: Initialize
        setStage('init');
        setProgress(5);
        await tick();
        if (abortRef.current) return;

        // Stage 2: Header
        setStage('header');
        setProgress(15);
        await tick();
        if (abortRef.current) return;

        // Stage 3: Customer info
        setStage('customer');
        setProgress(30);
        await tick();
        if (abortRef.current) return;

        // Stage 4: Items (progress scales with item count)
        setStage('items');
        setProgress(50);
        await tick();
        if (abortRef.current) return;

        // Stage 5: Totals
        setStage('totals');
        setProgress(70);
        await tick();
        if (abortRef.current) return;

        // Stage 6: Generate the actual PDF (the heavy work)
        setStage('render');
        setProgress(80);
        // For large orders, use a longer delay to let the UI update
        await tick(isLargeOrder ? 200 : 50);
        if (abortRef.current) return;

        const dataUrl = await generateOrderPdfDataUrl(order, pdfLang);
        if (abortRef.current) return;

        setPdfDataUrl(dataUrl);
        setProgress(100);
        setStage('done');
      } catch {
        if (!abortRef.current) {
          setError(isAr ? 'تعذر إنشاء المعاينة' : 'Failed to generate preview');
        }
      } finally {
        if (!abortRef.current) setGenerating(false);
      }
    };

    void run();

    return () => { abortRef.current = true; };
  }, [open, order, pdfLang, isAr, itemCount, isLargeOrder]);

  const handleDownload = async () => {
    try {
      await generateOrderPdf(order, pdfLang);
    } catch {
      // Error already handled by the utility
    }
  };

  const fileName = `Welad-Halal-Order-${order.orderNo}.pdf`;
  const stageLabel = STAGES[stage]?.[pdfLang === 'ar' ? 'ar' : 'en'] ?? '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAr ? 'معاينة PDF' : 'PDF Preview'}
      size="lg"
    >
      <div className="space-y-4">
        {/* Order info bar */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--tw-border)] px-4 py-3">
          <div>
            <p className="text-sm font-bold text-[var(--tw-text-muted)]">
              {isAr ? 'رقم الطلب' : 'Order'}
            </p>
            <p className="font-extrabold text-[var(--tw-text)]">#{order.orderNo}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--tw-text-muted)]">{fileName}</p>
            {itemCount > 0 && (
              <p className="text-xs text-[var(--tw-border-strong)]">
                {itemCount} {isAr ? 'منتج' : 'items'}
              </p>
            )}
          </div>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-3">
          <Label>{isAr ? 'لغة الملف' : 'Document Language'}</Label>
          <Select
            value={pdfLang}
            onChange={(e) => setPdfLang(e.target.value as 'ar' | 'en')}
            className="w-40"
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </Select>
        </div>

        {/* PDF Preview with progress indicator */}
        <div className="rounded-xl border border-[var(--tw-border)] bg-[var(--tw-bg)] overflow-hidden">
          {generating ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              {/* Progress bar */}
              <div className="w-64">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-[var(--tw-text-muted)]">
                    <Loader2 className="inline h-3 w-3 animate-spin" /> {stageLabel}
                  </span>
                  <span className="font-bold text-brand-400">{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--tw-surface-alt)]">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300 ease-out',
                      progress < 50 ? 'bg-amber-400' : progress < 100 ? 'bg-brand-400' : 'bg-emerald-400',
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Stage indicators */}
              <div className="flex items-center gap-1 text-xs text-[var(--tw-text-muted)]">
                {STAGE_ORDER.slice(0, -1).map((s, i) => {
                  const currentIdx = STAGE_ORDER.indexOf(stage);
                  const isComplete = i < currentIdx;
                  const isCurrent = i === currentIdx;
                  return (
                    <span key={s} className={cn(
                      'inline-block h-1.5 w-1.5 rounded-full',
                      isComplete ? 'bg-emerald-400' : isCurrent ? 'bg-brand-400 animate-pulse' : 'bg-night-700',
                    )} />
                  );
                })}
              </div>

              <p className="text-xs text-[var(--tw-text-muted)]">
                {isLargeOrder
                  ? (isAr ? `جاري إنشاء الفاتورة لـ ${itemCount} منتج...` : `Generating PDF for ${itemCount} items...`)
                  : (isAr ? 'جاري إنشاء المعاينة...' : 'Generating preview...')}
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
              <Button size="sm" variant="outline" onClick={() => setPdfDataUrl(null)}>
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </Button>
            </div>
          ) : pdfDataUrl ? (
            <div>
              {/* Success indicator */}
              <div className="flex items-center gap-2 border-b border-[var(--tw-border)] px-4 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">
                  {isAr ? 'تم إنشاء المعاينة بنجاح' : 'Preview generated successfully'}
                </span>
              </div>
              <iframe
                src={pdfDataUrl}
                className="w-full border-0 bg-white"
                style={{ height: '500px' }}
                title={isAr ? 'معاينة الفاتورة' : 'Invoice Preview'}
              />
            </div>
          ) : null}
        </div>

        {/* Download button */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            {isAr ? 'إغلاق' : 'Close'}
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!pdfDataUrl || generating}
            loading={generating}
          >
            <Download className="h-4 w-4" />
            {isAr ? 'تحميل PDF' : 'Download PDF'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Yield to the event loop so the UI can repaint. */
function tick(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
