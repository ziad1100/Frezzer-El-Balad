import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, Eye, Send, Image, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, Label } from '@/components/ui/Input';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { ReceiptData } from '@/lib/receiptFormatter';
import { generateReceiptText } from '@/lib/receiptFormatter';
import { renderReceiptToCanvas, canvasToDataURL, hasArabic } from '@/lib/receiptImage';

export interface PrinterConfig {
  id: string;
  name: string;
  paperWidth: '58' | '80';
  connection: 'usb' | 'lan' | 'bluetooth' | 'wifi';
  ipAddress: string;
  port: string;
  isDefault: boolean;
  isActive: boolean;
}

interface PrintInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  orderNo: string;
  receipt: ReceiptData;
  printers: PrinterConfig[];
  onPrint: (printerId: string, paperWidth: '58' | '80', copies: number) => void;
  onBrowserPrint: (paperWidth: '58' | '80') => void;
  printLoading?: boolean;
}

export function PrintInvoiceDialog({
  open,
  onClose,
  orderNo,
  receipt,
  printers,
  onPrint,
  onBrowserPrint,
  printLoading = false,
}: PrintInvoiceDialogProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const activePrinters = printers.filter((p) => p.isActive);
  const defaultPrinter = activePrinters.find((p) => p.isDefault) ?? activePrinters[0];

  const [selectedPrinterId, setSelectedPrinterId] = useState(defaultPrinter?.id ?? '');
  const [paperWidth, setPaperWidth] = useState<'58' | '80'>(defaultPrinter?.paperWidth ?? '80');
  const [copies, setCopies] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'text' | 'image'>('text');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  // Detect if receipt contains Arabic text
  const containsArabic = useMemo(() => {
    return hasArabic(receipt.storeNameAr) || receipt.language === 'ar' ||
      receipt.items.some((i) => hasArabic(i.name));
  }, [receipt]);

  // Build receipt text for the selected paper width
  const previewReceipt = useMemo(() => {
    const receiptForPaper = { ...receipt, paperWidth };
    return generateReceiptText(receiptForPaper);
  }, [receipt, paperWidth]);

  // Render image preview when Arabic is detected or user requests it
  useEffect(() => {
    if (!showPreview) return;
    if (previewMode === 'image' || containsArabic) {
      const canvas = renderReceiptToCanvas({ ...receipt, paperWidth });
      setImageDataUrl(canvasToDataURL(canvas));
    }
  }, [showPreview, previewMode, receipt, paperWidth, containsArabic]);

  const handlePrint = () => {
    if (selectedPrinterId) {
      onPrint(selectedPrinterId, paperWidth, copies);
    } else {
      onBrowserPrint(paperWidth);
    }
  };

  const handleBrowserPrint = () => {
    onBrowserPrint(paperWidth);
  };

  const selectedPrinter = activePrinters.find((p) => p.id === selectedPrinterId);

  const connectionLabel = (c: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      usb: { ar: 'USB', en: 'USB' },
      lan: { ar: 'شبكة', en: 'LAN' },
      bluetooth: { ar: 'بلوتوث', en: 'Bluetooth' },
      wifi: { ar: 'واي فاي', en: 'Wi-Fi' },
    };
    return labels[c]?.[lang === 'ar' ? 'ar' : 'en'] ?? c.toUpperCase();
  };

  return (
    <Modal open={open} onClose={onClose} title={lang === 'ar' ? 'طباعة الفاتورة' : 'Print Invoice'} size="lg">
      <div className="space-y-5">
        {/* Order number */}
        <div className="flex items-center justify-between rounded-xl border border-night-800 px-4 py-3">
          <span className="text-sm font-bold text-night-300">
            {lang === 'ar' ? 'رقم الطلب' : 'Order'}
          </span>
          <span className="font-extrabold text-night-50">#{orderNo}</span>
        </div>

        {/* Printer Selection */}
        <div>
          <Label>{lang === 'ar' ? 'اختر الطابعة' : 'Select Printer'}</Label>
          {activePrinters.length > 0 ? (
            <Select
              value={selectedPrinterId}
              onChange={(e) => {
                setSelectedPrinterId(e.target.value);
                const p = activePrinters.find((pr) => pr.id === e.target.value);
                if (p) setPaperWidth(p.paperWidth);
              }}
            >
              {activePrinters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {connectionLabel(p.connection)} · {p.paperWidth}mm
                  {p.isDefault ? (lang === 'ar' ? ' ★' : ' ★') : ''}
                </option>
              ))}
            </Select>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-night-500">
                {lang === 'ar'
                  ? 'لا توجد طابعات متاحة. الطبع سيتم من المتصفح.'
                  : 'No printers configured. Will print via browser.'}
              </p>
              <a
                href="/admin/printers"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                {lang === 'ar' ? 'بحث عن الطابعات' : 'Scan for Printers'}
              </a>
            </div>
          )}
        </div>

        {/* Print Format */}
        <div>
          <Label>{lang === 'ar' ? 'نوع الطباعة' : 'Print Format'}</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              { id: 'thermal_58', ar: 'حرارية 58mm', en: 'Thermal 58mm' },
              { id: 'thermal_80', ar: 'حرارية 80mm', en: 'Thermal 80mm' },
              { id: 'a4', ar: 'فاتورة A4', en: 'A4 Invoice' },
              { id: 'pdf', ar: 'ملف PDF', en: 'PDF File' },
            ] as const).map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => {
                  if (fmt.id === 'thermal_58') setPaperWidth('58');
                  else if (fmt.id === 'thermal_80') setPaperWidth('80');
                }}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                  ((fmt.id === 'thermal_58' && paperWidth === '58') ||
                   (fmt.id === 'thermal_80' && paperWidth === '80') ||
                   (fmt.id === 'pdf'))
                    ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                    : 'border-night-700 text-night-400 hover:border-night-600 hover:text-night-300',
                )}
              >
                {lang === 'ar' ? fmt.ar : fmt.en}
              </button>
            ))}
          </div>
        </div>

        {/* Paper Width & Copies */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{lang === 'ar' ? 'عرض الورق' : 'Paper Width'}</Label>
            <Select value={paperWidth} onChange={(e) => setPaperWidth(e.target.value as '58' | '80')}>
              <option value="80">80mm</option>
              <option value="58">58mm</option>
            </Select>
          </div>
          <div>
            <Label>{lang === 'ar' ? 'عدد النسخ' : 'Copies'}</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              dir="ltr"
            />
          </div>
        </div>

        {/* Receipt Preview Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors"
          >
            <Eye className="h-4 w-4" />
            {showPreview
              ? (lang === 'ar' ? 'إخفاء المعاينة' : 'Hide Preview')
              : (lang === 'ar' ? 'معاينة الفاتورة' : 'Preview Invoice')}
          </button>
          {showPreview && (
            <div className="flex items-center gap-1 rounded-lg border border-night-800 p-0.5">
              <button
                type="button"
                onClick={() => setPreviewMode('text')}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                  previewMode === 'text' ? 'bg-night-700 text-night-100' : 'text-night-500 hover:text-night-300',
                )}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('image')}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                  previewMode === 'image' ? 'bg-night-700 text-night-100' : 'text-night-500 hover:text-night-300',
                )}
              >
                <Image className="inline h-3 w-3" />
                {' '}Image
              </button>
            </div>
          )}
        </div>

        {/* Receipt Preview */}
        {showPreview && (
          <div className="rounded-xl border border-night-800 bg-night-950 p-4">
            {previewMode === 'image' || containsArabic ? (
              /* Image-based preview — renders Arabic correctly */
              <div className="flex flex-col items-center gap-2">
                {containsArabic && previewMode !== 'image' ? (
                  <p className="text-xs text-gold-400">
                    {lang === 'ar'
                      ? '⚠️ العربية تُعرض كصورة لضمان الطباعة الصحيحة'
                      : '⚠️ Arabic rendered as image for correct printing'}
                  </p>
                ) : null}
                {imageDataUrl ? (
                  <img
                    src={imageDataUrl}
                    alt={lang === 'ar' ? 'معاينة الفاتورة' : 'Invoice Preview'}
                    className={cn(
                      'rounded-lg border border-night-700',
                      paperWidth === '80' ? 'max-w-[300px]' : 'max-w-[220px]',
                    )}
                  />
                ) : (
                  <p className="text-sm text-night-500">
                    {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                  </p>
                )}
              </div>
            ) : (
              /* Text-based preview */
              <div
                className={cn(
                  'mx-auto font-mono text-xs leading-relaxed text-night-200 whitespace-pre-wrap',
                  paperWidth === '80' ? 'max-w-[300px]' : 'max-w-[220px]',
                )}
              >
                {previewReceipt}
              </div>
            )}
          </div>
        )}

        {/* Print Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handlePrint}
            loading={printLoading}
            className="flex-1"
          >
            <Printer className="h-4 w-4" />
            {selectedPrinter
              ? (lang === 'ar' ? `طباعة على ${selectedPrinter.name}` : `Print to ${selectedPrinter.name}`)
              : (lang === 'ar' ? 'طباعة الفاتورة' : 'Print Invoice')}
            {copies > 1 ? ` ×${copies}` : ''}
          </Button>
          <Button
            variant="outline"
            onClick={handleBrowserPrint}
            loading={printLoading}
          >
            <Send className="h-4 w-4" />
            {lang === 'ar' ? 'طباعة من المتصفح' : 'Browser Print'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
