import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileDown, Loader2 } from 'lucide-react';
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

export function PdfPreviewDialog({ open, onClose, order }: PdfPreviewDialogProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang === 'ar';

  const [pdfLang, setPdfLang] = useState<'ar' | 'en'>(isAr ? 'ar' : 'en');
  const [generating, setGenerating] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate PDF preview when dialog opens or language changes
  useMemo(() => {
    if (!open) {
      setPdfDataUrl(null);
      setError(null);
      return;
    }

    setGenerating(true);
    setError(null);

    // Use requestAnimationFrame to avoid blocking the UI
    const timer = setTimeout(() => {
      try {
        const dataUrl = generateOrderPdfDataUrl(order, pdfLang);
        setPdfDataUrl(dataUrl);
      } catch (err) {
        setError(isAr ? 'تعذر إنشاء المعاينة' : 'Failed to generate preview');
      } finally {
        setGenerating(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [open, order, pdfLang, isAr]);

  const handleDownload = () => {
    try {
      generateOrderPdf(order, pdfLang);
    } catch {
      // Error already handled by the utility
    }
  };

  const fileName = `Freezer-Elbalad-Order-${order.orderNo}.pdf`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAr ? 'معاينة PDF' : 'PDF Preview'}
      size="lg"
    >
      <div className="space-y-4">
        {/* Order info bar */}
        <div className="flex items-center justify-between rounded-xl border border-night-800 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-night-300">
              {isAr ? 'رقم الطلب' : 'Order'}
            </p>
            <p className="font-extrabold text-night-50">#{order.orderNo}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-night-500">{fileName}</p>
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

        {/* PDF Preview */}
        <div className="rounded-xl border border-night-800 bg-night-950 overflow-hidden">
          {generating ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
              <p className="text-sm text-night-400">
                {isAr ? 'جاري إنشاء المعاينة...' : 'Generating preview...'}
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : pdfDataUrl ? (
            <iframe
              src={pdfDataUrl}
              className="w-full border-0 bg-white"
              style={{ height: '500px' }}
              title={isAr ? 'معاينة الفاتورة' : 'Invoice Preview'}
            />
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
