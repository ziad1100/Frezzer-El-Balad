import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, Send, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminSettings, updateSettings } from '@/api/admin';
import { listRecentPrintJobs, retryPrintJob } from '@/api/print';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, Skeleton } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { PageHeader } from '@/components/admin/primitives';
import { cn } from '@/lib/utils';

interface PrinterConfig {
  name: string;
  type: string;
  paperWidth: '58' | '80';
  connection: 'usb' | 'lan' | 'bluetooth' | 'wifi';
  ipAddress: string;
  port: string;
  isActive: boolean;
}

const defaultConfig: PrinterConfig = {
  name: '',
  type: 'thermal',
  paperWidth: '80',
  connection: 'lan',
  ipAddress: '',
  port: '9100',
  isActive: true,
};

const statusIcons: Record<string, typeof Printer> = {
  pending: AlertTriangle,
  printing: Send,
  printed: CheckCircle,
  failed: XCircle,
};

const statusColors: Record<string, string> = {
  pending: 'text-amber-400',
  printing: 'text-blue-400',
  printed: 'text-emerald-400',
  failed: 'text-red-400',
};

export function AdminPrinterPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: getAdminSettings });
  const printJobs = useQuery({ queryKey: ['admin', 'print-jobs'], queryFn: listRecentPrintJobs, refetchInterval: 10000 });

  const savedConfig = (settings.data?.printerConfig as PrinterConfig | undefined) ?? defaultConfig;
  const [config, setConfig] = useState<PrinterConfig>(savedConfig);
  const [testPrinting, setTestPrinting] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => updateSettings({ printerConfig: config }),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: () => toast.error(t('admin.saveFailed')),
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => retryPrintJob(jobId),
    onSuccess: () => {
      toast.success(lang === 'ar' ? 'تمت إعادة الإرسال' : 'Retried');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'print-jobs'] });
    },
  });

  const handleTestPrint = (): void => {
    setTestPrinting(true);
    // Build a test receipt and trigger browser print as a fallback test
    const w = config.paperWidth === '80' ? 48 : 32;
    const divider = '-'.repeat(w);
    const center = (s: string) => {
      const pad = Math.max(0, Math.floor((w - s.length) / 2));
      return ' '.repeat(pad) + s;
    };
    const testReceipt = [
      center('FREEZER ELBALAD'),
      center('فريزر البلد'),
      divider,
      center(lang === 'ar' ? 'اختبار الطباعة' : 'PRINTER TEST'),
      divider,
      `${lang === 'ar' ? 'الطابعة' : 'Printer'}: ${config.name || (lang === 'ar' ? 'غير محدد' : 'Not set')}`,
      `${lang === 'ar' ? 'الورق' : 'Paper'}: ${config.paperWidth}mm`,
      `${lang === 'ar' ? 'الاتصال' : 'Connection'}: ${config.connection.toUpperCase()}`,
      divider,
      center(lang === 'ar' ? 'اختبار ناجح!' : 'TEST PRINT SUCCESSFUL!'),
      '',
    ].join('\n');

    // Open in new window for browser print
    const printWindow = window.open('', '_blank', 'width=350,height=500');
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>Test Print</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 14px; white-space: pre; margin: 20px; }
          @media print { body { margin: 0; } }
        </style></head>
        <body>${testReceipt}</body></html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
    setTimeout(() => setTestPrinting(false), 1000);
  };

  if (settings.isLoading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader title={lang === 'ar' ? 'إعدادات الطابعة' : 'Printer Settings'} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Printer Configuration */}
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-night-300">
              <Printer className="h-4 w-4" />
              {lang === 'ar' ? 'إعدادات الطابعة' : 'Printer Configuration'}
            </h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="p-name">{lang === 'ar' ? 'اسم الطابعة' : 'Printer Name'}</Label>
                <Input
                  id="p-name"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  placeholder={lang === 'ar' ? 'مثال: طابعة الكاونتر الرئيسي' : 'e.g. Main Counter Printer'}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-width">{lang === 'ar' ? 'عرض الورق' : 'Paper Width'}</Label>
                  <Select
                    id="p-width"
                    value={config.paperWidth}
                    onChange={(e) => setConfig({ ...config, paperWidth: e.target.value as '58' | '80' })}
                  >
                    <option value="80">80mm</option>
                    <option value="58">58mm</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="p-conn">{lang === 'ar' ? 'الاتصال' : 'Connection'}</Label>
                  <Select
                    id="p-conn"
                    value={config.connection}
                    onChange={(e) => setConfig({ ...config, connection: e.target.value as PrinterConfig['connection'] })}
                  >
                    <option value="lan">{lang === 'ar' ? 'شبكة / إيثرنت' : 'LAN / Ethernet'}</option>
                    <option value="usb">USB</option>
                    <option value="bluetooth">Bluetooth</option>
                    <option value="wifi">Wi-Fi</option>
                  </Select>
                </div>
              </div>

              {(config.connection === 'lan' || config.connection === 'wifi') && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="p-ip">{lang === 'ar' ? 'عنوان IP' : 'IP Address'}</Label>
                    <Input
                      id="p-ip"
                      dir="ltr"
                      value={config.ipAddress}
                      onChange={(e) => setConfig({ ...config, ipAddress: e.target.value })}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="p-port">{lang === 'ar' ? 'المنفذ' : 'Port'}</Label>
                    <Input
                      id="p-port"
                      dir="ltr"
                      value={config.port}
                      onChange={(e) => setConfig({ ...config, port: e.target.value })}
                      placeholder="9100"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-night-800 px-4 py-3">
                <span className="text-sm font-semibold text-night-200">
                  {lang === 'ar' ? ' الطابعة نشطة' : 'Printer Active'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.isActive}
                  onClick={() => setConfig({ ...config, isActive: !config.isActive })}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                    config.isActive ? 'bg-emerald-500' : 'bg-night-700',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform',
                      config.isActive ? 'translate-x-5.5' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>

              <div className="flex gap-3">
                <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  {t('common.save')}
                </Button>
                <Button
                  variant="outline"
                  loading={testPrinting}
                  onClick={handleTestPrint}
                >
                  <Send className="h-4 w-4" />
                  {lang === 'ar' ? 'اختبار الطباعة' : 'Test Print'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Print Queue */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-night-300">
                {lang === 'ar' ? 'قائمة الطباعة' : 'Print Queue'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin', 'print-jobs'] })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {printJobs.isLoading ? (
              <Skeleton className="h-48" />
            ) : printJobs.data && printJobs.data.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {printJobs.data.map((job) => {
                  const StatusIcon = statusIcons[job.status] ?? Printer;
                  return (
                    <div
                      key={job.id}
                      className="flex items-center justify-between rounded-xl border border-night-800 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon className={cn('h-4 w-4', statusColors[job.status])} />
                        <div>
                          <p className="text-sm font-bold text-night-100">#{job.orderNo}</p>
                          <p className="text-xs text-night-500">
                            {new Date(job.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-bold capitalize', statusColors[job.status])}>
                          {job.status}
                        </span>
                        {job.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryMutation.mutate(job.id)}
                            loading={retryMutation.isPending}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-night-500">
                {lang === 'ar' ? 'لا توجد jobs طباعة' : 'No print jobs yet'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
