import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Wifi, Usb, Bluetooth, Monitor, RefreshCw, CheckCircle, AlertTriangle, Loader2, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { discoverPrinters, testDiscoveredPrinter, type DiscoveredPrinter, type DiscoveryResult } from '@/api/print';

interface PrinterScannerProps {
  agentUrl: string;
  onAgentUrlChange: (url: string) => void;
  onSelectPrinter: (printer: DiscoveredPrinter) => void;
  onClose?: () => void;
}

const connectionIcons: Record<string, typeof Printer> = {
  usb: Usb,
  lan: Wifi,
  wifi: Wifi,
  bluetooth: Bluetooth,
  serial: Usb,
  windows: Monitor,
};

const connectionLabels: Record<string, { ar: string; en: string }> = {
  usb: { ar: 'USB', en: 'USB' },
  lan: { ar: 'شبكة', en: 'LAN' },
  wifi: { ar: 'واي فاي', en: 'Wi-Fi' },
  bluetooth: { ar: 'بلوتوث', en: 'Bluetooth' },
  serial: { ar: 'تسلسلي', en: 'Serial' },
  windows: { ar: 'Windows', en: 'Windows' },
};

export function PrinterScanner({ agentUrl, onAgentUrlChange, onSelectPrinter, onClose }: PrinterScannerProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const [scanning, setScanning] = useState(false);
  const [printers, setPrinters] = useState<DiscoveredPrinter[]>([]);
  const [summary, setSummary] = useState<DiscoveryResult['summary'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [scanned, setScanned] = useState(false);

  const handleScan = useCallback(async () => {
    if (!agentUrl.trim()) {
      setError(lang === 'ar' ? 'أدخل عنوان خدمة الطباعة المحلية' : 'Enter the local print agent URL');
      return;
    }

    setScanning(true);
    setError(null);
    setPrinters([]);
    setTestResults({});

    try {
      const result = await discoverPrinters(agentUrl.trim());
      setPrinters(result.printers || []);
      setSummary(result.summary || null);
      setScanned(true);

      if ((result.printers || []).length === 0) {
        setError(lang === 'ar'
          ? 'لم يتم العثور على طابعات. تأكد من أن خدمة الطباعة المحلية تعمل.'
          : 'No printers found. Ensure the local print service is running.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(lang === 'ar'
        ? `فشل البحث: ${message}`
        : `Discovery failed: ${message}`);
    } finally {
      setScanning(false);
    }
  }, [agentUrl, lang]);

  const handleTestPrinter = useCallback(async (printer: DiscoveredPrinter) => {
    setTestingId(printer.id);
    setTestResults((prev) => ({ ...prev, [printer.id]: { success: false, message: lang === 'ar' ? 'جاري الفحص...' : 'Testing...' } }));

    try {
      const result = await testDiscoveredPrinter(agentUrl, printer.name);
      setTestResults((prev) => ({
        ...prev,
        [printer.id]: {
          success: result.reachable,
          message: result.reachable
            ? (lang === 'ar' ? '✓ الطابعة جاهزة' : '✓ Printer ready')
            : (lang === 'ar' ? `✗ ${result.error || 'غير متاحة'}` : `✗ ${result.error || 'Unavailable'}`),
        },
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setTestResults((prev) => ({
        ...prev,
        [printer.id]: { success: false, message: `✗ ${message}` },
      }));
    } finally {
      setTimeout(() => setTestingId(null), 1000);
    }
  }, [agentUrl, lang]);

  return (
    <Card className="border-brand-500/30">
      <CardContent className="p-5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-night-200">
            <Search className="h-4 w-4 text-brand-400" />
            {lang === 'ar' ? 'البحث عن الطابعات المتاحة' : 'Scan for Available Printers'}
          </h3>
          {onClose && (
            <button onClick={onClose} className="text-night-500 hover:text-night-300">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Agent URL Input */}
        <div className="mb-4 space-y-2">
          <label className="text-xs font-semibold text-night-400">
            {lang === 'ar' ? 'عنوان خدمة الطباعة المحلية' : 'Local Print Agent URL'}
          </label>
          <div className="flex gap-2">
            <Input
              dir="ltr"
              value={agentUrl}
              onChange={(e) => onAgentUrlChange(e.target.value)}
              placeholder="http://192.168.1.50:9200"
              className="flex-1 font-mono text-sm"
            />
            <Button
              onClick={handleScan}
              loading={scanning}
              className="shrink-0"
            >
              {scanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {lang === 'ar' ? 'بحث' : 'Scan'}
            </Button>
          </div>
          <p className="text-xs text-night-500">
            {lang === 'ar'
              ? 'عنوان IP المحلي لجهاز الكمبيوتر الذي عليه خدمة الطباعة (مثال: http://192.168.1.50:9200)'
              : 'Local IP of the machine running the print service (e.g. http://192.168.1.50:9200)'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Summary */}
        {summary && scanned && (
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="rounded-md bg-night-800 px-2 py-1 text-xs font-bold text-night-300">
              {lang === 'ar' ? 'المجموع' : 'Total'}: {summary.total}
            </span>
            {summary.usb > 0 && (
              <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-400">
                USB: {summary.usb}
              </span>
            )}
            {summary.lan > 0 && (
              <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-400">
                LAN: {summary.lan}
              </span>
            )}
            {summary.bluetooth > 0 && (
              <span className="rounded-md bg-purple-500/10 px-2 py-1 text-xs font-bold text-purple-400">
                BT: {summary.bluetooth}
              </span>
            )}
            {summary.windows > 0 && (
              <span className="rounded-md bg-cyan-500/10 px-2 py-1 text-xs font-bold text-cyan-400">
                Win: {summary.windows}
              </span>
            )}
            {summary.serial > 0 && (
              <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-400">
                Serial: {summary.serial}
              </span>
            )}
          </div>
        )}

        {/* Printer List */}
        {printers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-night-400">
              {lang === 'ar' ? 'الطابعات المكتشفة' : 'Discovered Printers'}
            </p>
            {printers.map((printer) => {
              const Icon = connectionIcons[printer.connection] || Monitor;
              const connLabel = connectionLabels[printer.connection]?.[lang === 'ar' ? 'ar' : 'en'] ?? printer.connection.toUpperCase();
              const testResult = testResults[printer.id];

              return (
                <div
                  key={printer.id}
                  className="flex items-center justify-between rounded-xl border border-night-700 bg-night-900/50 px-4 py-3 transition-colors hover:border-night-600"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-night-800">
                      <Icon className="h-5 w-5 text-night-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-night-50">{printer.name}</p>
                        {printer.model && (
                          <span className="text-xs text-night-500">{printer.model}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-night-400">
                        <span className="font-semibold">{connLabel}</span>
                        {printer.paperWidth && <span>• {printer.paperWidth}mm</span>}
                        {printer.ip && <span>• {printer.ip}</span>}
                        {printer.port && !printer.ip && <span>• {printer.port}</span>}
                        <span className={cn(
                          'font-semibold',
                          printer.status === 'available' ? 'text-emerald-400' : 'text-amber-400',
                        )}>
                          • {printer.status === 'available'
                            ? (lang === 'ar' ? 'متاحة' : 'Available')
                            : printer.status}
                        </span>
                      </div>
                      {testResult && (
                        <p className={cn('mt-1 text-xs font-semibold', testResult.success ? 'text-emerald-400' : 'text-red-400')}>
                          {testResult.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={lang === 'ar' ? 'اختبار الطابعة' : 'Test Printer'}
                      loading={testingId === printer.id}
                      onClick={() => void handleTestPrinter(printer)}
                      className="text-blue-400 hover:bg-blue-500/10"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onSelectPrinter(printer)}
                      className="text-xs"
                    >
                      {testResult?.success ? (
                        <CheckCircle className="mr-1 h-3 w-3" />
                      ) : null}
                      {lang === 'ar' ? 'اختيار' : 'Select'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No results after scan */}
        {scanned && printers.length === 0 && !error && !scanning && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Printer className="h-8 w-8 text-night-600" />
            <p className="text-sm text-night-500">
              {lang === 'ar'
                ? 'لم يتم العثور على طابعات. جرب إضافة طابعة يدوياً.'
                : 'No printers found. Try adding a printer manually.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
