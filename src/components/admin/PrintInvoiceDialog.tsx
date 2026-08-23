import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, X, Eye, Send, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, Label } from '@/components/ui/Input';
import { Input } from '@/components/ui/Input';
import { cn, formatPrice } from '@/lib/utils';
import type { ReceiptData } from '@/lib/receiptFormatter';
import { generateReceiptText } from '@/lib/receiptFormatter';

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

  // Build receipt text for the selected paper width
  const previewReceipt = useMemo(() => {
    const receiptForPaper = { ...receipt, paperWidth };
    return generateReceiptText(receiptForPaper);
  }, [receipt, paperWidth]);

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
            <p className="mt-2 text-sm text-night-500">
              {lang === 'ar'
                ? 'لا توجد طابعات متاحة. الطبع سيتم من المتصفح.'
                : 'No printers configured. Will print via browser.'}
            </p>
          )}
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
        <div>
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
        </div>

        {/* Receipt Preview */}
        {showPreview && (
          <div className="rounded-xl border border-night-800 bg-night-950 p-4">
            <div
              className={cn(
                'mx-auto font-mono text-xs leading-relaxed text-night-200 whitespace-pre-wrap',
                paperWidth === '80' ? 'max-w-[300px]' : 'max-w-[220px]',
              )}
            >
              {previewReceipt}
            </div>
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
