import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, Send, RefreshCw, CheckCircle, XCircle, AlertTriangle, Key, Copy, Trash2, Plus, Star, StarOff } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminSettings, updateSettings } from '@/api/admin';
import { listRecentPrintJobs, retryPrintJob, generateServiceToken, listServiceTokens, revokeServiceToken, createTestPrintJob } from '@/api/print';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, Skeleton } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { PageHeader } from '@/components/admin/primitives';
import { cn } from '@/lib/utils';

interface PrinterConfig {
  id: string;
  name: string;
  paperWidth: '58' | '80';
  connection: 'usb' | 'lan' | 'bluetooth' | 'wifi';
  ipAddress: string;
  port: string;
  isDefault: boolean;
  isActive: boolean;
}

/** Migrate legacy single-printer config to the multi-printer array format. */
function migratePrinters(raw: unknown): PrinterConfig[] {
  if (Array.isArray(raw)) return raw as PrinterConfig[];
  if (raw && typeof raw === 'object' && 'name' in raw) {
    const legacy = raw as Record<string, unknown>;
    return [{
      id: crypto.randomUUID(),
      name: String(legacy.name || ''),
      paperWidth: (legacy.paperWidth === '58' ? '58' : '80') as '58' | '80',
      connection: (legacy.connection || 'lan') as PrinterConfig['connection'],
      ipAddress: String(legacy.ipAddress || ''),
      port: String(legacy.port || '9100'),
      isDefault: true,
      isActive: legacy.isActive !== false,
    }];
  }
  return [];
}

let printerIdCounter = 0;
const newPrinterId = () => `printer-${Date.now()}-${++printerIdCounter}`;

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
  const serviceTokens = useQuery({ queryKey: ['admin', 'service-tokens'], queryFn: listServiceTokens });

  const savedPrinters = useMemo(() => migratePrinters(settings.data?.printerConfig), [settings.data?.printerConfig]);
  const [printers, setPrinters] = useState<PrinterConfig[]>(savedPrinters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testPrinting, setTestPrinting] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrinter, setNewPrinter] = useState<Partial<PrinterConfig>>({
    name: '',
    paperWidth: '80',
    connection: 'lan',
    ipAddress: '',
    port: '9100',
    isDefault: false,
    isActive: true,
  });


  const saveMutation = useMutation({
    mutationFn: () => updateSettings({ printerConfig: printers }),
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

  const generateTokenMutation = useMutation({
    mutationFn: () => generateServiceToken(newTokenName || 'Print Service'),
    onSuccess: (data) => {
      setGeneratedToken(data.rawToken);
      setNewTokenName('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'service-tokens'] });
      toast.success(lang === 'ar' ? 'تم إنشاء الرمز' : 'Token created');
    },
    onError: () => toast.error(lang === 'ar' ? 'فشل إنشاء الرمز' : 'Failed to create token'),
  });

  const revokeTokenMutation = useMutation({
    mutationFn: (id: string) => revokeServiceToken(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'service-tokens'] });
      toast.success(lang === 'ar' ? 'تم إلغاء الرمز' : 'Token revoked');
    },
  });

  const handleTestPrint = async (printer: PrinterConfig): Promise<void> => {
    setTestPrinting(printer.id);
    const w = printer.paperWidth === '80' ? 48 : 32;
    const divider = '-'.repeat(w);
    const center = (s: string) => ' '.repeat(Math.max(0, Math.floor((w - s.length) / 2))) + s;
    const testReceiptText = [
      center('WELAD HALAL'),
      center('ولاد حلال'),
      divider,
      center(lang === 'ar' ? 'اختبار الطباعة' : 'PRINTER TEST'),
      divider,
      `${lang === 'ar' ? 'الطابعة' : 'Printer'}: ${printer.name || (lang === 'ar' ? 'غير محدد' : 'Not set')}`,
      `${lang === 'ar' ? 'الورق' : 'Paper'}: ${printer.paperWidth}mm`,
      `${lang === 'ar' ? 'الاتصال' : 'Connection'}: ${printer.connection.toUpperCase()}`,
      divider,
      center(lang === 'ar' ? 'اختبار ناجح!' : 'TEST PRINT SUCCESSFUL!'),
      '',
    ].join('\n');

    const testReceiptPayload = {
      storeNameAr: '\u0648\u0644\u0627\u062f \u062d\u0644\u0627\u0644',
      storeNameEn: 'Welad Halal',
      orderNo: 'TEST-001',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      status: lang === 'ar' ? 'اختبار' : 'Test',
      items: [],
      subtotal: 0,
      deliveryFee: 0,
      discount: 0,
      total: 0,
      paymentMethod: 'cash',
      footerAr: '\u0634\u0643\u0631\u064b\u0627 \u0644\u062a\u0633\u0648\u0642\u0643 \u0645\u0646 \u0648\u0644\u0627\u062f \u062d\u0644\u0627\u0644',
      footerEn: 'Thank you for shopping with Welad Halal!',
      paperWidth: printer.paperWidth,
      language: lang === 'ar' ? 'ar' : 'en',
    };

    try {
      await createTestPrintJob(testReceiptPayload);
      toast.success(lang === 'ar' ? 'تم إرسال اختبار الطباعة' : 'Test print sent to local service');
    } catch {
      // Local service unavailable — fall back to browser print
      const printWindow = window.open('', '_blank', 'width=350,height=500');
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Test Print</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 14px; white-space: pre; margin: 20px; }
            @media print { body { margin: 0; } }
          </style></head>
          <body>${testReceiptText}</body></html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
    setTimeout(() => setTestPrinting(null), 1000);
  };

  const handleAddPrinter = () => {
    const id = newPrinterId();
    const p: PrinterConfig = {
      id,
      name: newPrinter.name || (lang === 'ar' ? 'طابعة جديدة' : 'New Printer'),
      paperWidth: newPrinter.paperWidth ?? '80',
      connection: newPrinter.connection ?? 'lan',
      ipAddress: newPrinter.ipAddress ?? '',
      port: newPrinter.port ?? '9100',
      isDefault: printers.length === 0,
      isActive: true,
    };
    setPrinters([...printers, p]);
    setNewPrinter({ name: '', paperWidth: '80', connection: 'lan', ipAddress: '', port: '9100', isDefault: false, isActive: true });
    setShowAddForm(false);
  };

  const handleRemovePrinter = (id: string) => {
    setPrinters((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (next.length > 0 && !next.some((p) => p.isDefault)) {
        next[0].isDefault = true;
      }
      return next;
    });
  };

  const handleSetDefault = (id: string) => {
    setPrinters((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));
  };

  const handleUpdatePrinter = (id: string, updates: Partial<PrinterConfig>) => {
    setPrinters((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  if (settings.isLoading) return <Skeleton className="h-96" />;

  const connLabel = (c: string) => {
    const m: Record<string, { ar: string; en: string }> = {
      usb: { ar: 'USB', en: 'USB' }, lan: { ar: 'شبكة', en: 'LAN' },
      bluetooth: { ar: 'بلوتوث', en: 'Bluetooth' }, wifi: { ar: 'واي فاي', en: 'Wi-Fi' },
    };
    return m[c]?.[lang === 'ar' ? 'ar' : 'en'] ?? c.toUpperCase();
  };

  return (
    <div>
      <PageHeader title={lang === 'ar' ? 'إعدادات الطابعة' : 'Printer Settings'} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Printer List */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-night-300">
                <Printer className="h-4 w-4" />
                {lang === 'ar' ? 'الطابعات المتاحة' : 'Available Printers'}
                <span className="text-night-500">({printers.length})</span>
              </h3>
              <Button size="sm" onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }}>
                <Plus className="h-4 w-4" />
                {lang === 'ar' ? 'إضافة طابعة' : 'Add Printer'}
              </Button>
            </div>

            {/* Add Printer Form */}
            {showAddForm && !editingId && (
              <div className="mb-4 space-y-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
                <p className="text-sm font-bold text-brand-400">
                  {lang === 'ar' ? 'طابعة جديدة' : 'New Printer'}
                </p>
                <Input
                  value={newPrinter.name ?? ''}
                  onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
                  placeholder={lang === 'ar' ? 'اسم الطابعة' : 'Printer name'}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={newPrinter.paperWidth ?? '80'} onChange={(e) => setNewPrinter({ ...newPrinter, paperWidth: e.target.value as '58' | '80' })}>
                    <option value="80">80mm</option>
                    <option value="58">58mm</option>
                  </Select>
                  <Select value={newPrinter.connection ?? 'lan'} onChange={(e) => setNewPrinter({ ...newPrinter, connection: e.target.value as PrinterConfig['connection'] })}>
                    <option value="lan">{connLabel('lan')}</option>
                    <option value="usb">USB</option>
                    <option value="bluetooth">{connLabel('bluetooth')}</option>
                    <option value="wifi">{connLabel('wifi')}</option>
                  </Select>
                </div>
                {(newPrinter.connection === 'lan' || newPrinter.connection === 'wifi') && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input dir="ltr" value={newPrinter.ipAddress ?? ''} onChange={(e) => setNewPrinter({ ...newPrinter, ipAddress: e.target.value })} placeholder="192.168.1.100" />
                    <Input dir="ltr" value={newPrinter.port ?? '9100'} onChange={(e) => setNewPrinter({ ...newPrinter, port: e.target.value })} placeholder="9100" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddPrinter}>{lang === 'ar' ? 'إضافة' : 'Add'}</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                </div>
              </div>
            )}

            {/* Printer List Items */}
            {printers.length === 0 ? (
              <p className="py-8 text-center text-sm text-night-500">
                {lang === 'ar' ? 'لا توجد طابعات. أضف طابعة للبدء.' : 'No printers configured. Add one to get started.'}
              </p>
            ) : (
              <div className="space-y-3">
                {printers.map((p) => (
                  <div key={p.id} className={cn('rounded-xl border px-4 py-3', p.isDefault ? 'border-brand-500/40 bg-brand-500/5' : 'border-night-800')}>
                    {editingId === p.id ? (
                      /* Edit mode */
                      <div className="space-y-3">
                        <Input value={p.name} onChange={(e) => handleUpdatePrinter(p.id, { name: e.target.value })} placeholder={lang === 'ar' ? 'اسم الطابعة' : 'Printer name'} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Select value={p.paperWidth} onChange={(e) => handleUpdatePrinter(p.id, { paperWidth: e.target.value as '58' | '80' })}>
                            <option value="80">80mm</option>
                            <option value="58">58mm</option>
                          </Select>
                          <Select value={p.connection} onChange={(e) => handleUpdatePrinter(p.id, { connection: e.target.value as PrinterConfig['connection'] })}>
                            <option value="lan">{connLabel('lan')}</option>
                            <option value="usb">USB</option>
                            <option value="bluetooth">{connLabel('bluetooth')}</option>
                            <option value="wifi">{connLabel('wifi')}</option>
                          </Select>
                        </div>
                        {(p.connection === 'lan' || p.connection === 'wifi') && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Input dir="ltr" value={p.ipAddress} onChange={(e) => handleUpdatePrinter(p.id, { ipAddress: e.target.value })} placeholder="192.168.1.100" />
                            <Input dir="ltr" value={p.port} onChange={(e) => handleUpdatePrinter(p.id, { port: e.target.value })} placeholder="9100" />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => { setEditingId(null); }}>
                            {lang === 'ar' ? 'تم' : 'Done'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-night-50">{p.name}</p>
                            {p.isDefault && (
                              <span className="rounded-md bg-brand-500/20 px-2 py-0.5 text-xs font-bold text-brand-400">
                                {lang === 'ar' ? 'الافتراضية' : 'Default'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-night-500">
                            {connLabel(p.connection)} · {p.paperWidth}mm
                            {(p.connection === 'lan' || p.connection === 'wifi') && p.ipAddress ? ` · ${p.ipAddress}:${p.port}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={lang === 'ar' ? 'اختبار الطباعة' : 'Test Print'}
                            loading={testPrinting === p.id}
                            onClick={() => void handleTestPrint(p)}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={p.isDefault ? '' : (lang === 'ar' ? 'تعيين كافتراضية' : 'Set as default')}
                            onClick={() => handleSetDefault(p.id)}
                            disabled={p.isDefault}
                          >
                            {p.isDefault ? <Star className="h-3.5 w-3.5 text-brand-400 fill-brand-400" /> : <StarOff className="h-3.5 w-3.5 text-night-500" />}
                          </Button>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={p.isActive}
                            onClick={() => handleUpdatePrinter(p.id, { isActive: !p.isActive })}
                            className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', p.isActive ? 'bg-emerald-500' : 'bg-night-700')}
                          >
                            <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform', p.isActive ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
                          </button>
                          <Button variant="ghost" size="icon" onClick={() => setEditingId(p.id)}>
                            <span className="text-xs text-night-400">✏️</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-400 hover:bg-red-500/10" onClick={() => handleRemovePrinter(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {t('common.save')}
              </Button>
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

        {/* Service Tokens */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Key className="h-4 w-4 text-night-300" />
              <h3 className="text-sm font-bold text-night-300">
                {lang === 'ar' ? 'رموز الخدمة (للوحة الطباعة المحلية)' : 'Service Tokens (Local Print Service)'}
              </h3>
            </div>

            {/* Generated token warning */}
            {generatedToken ? (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="mb-2 text-sm font-bold text-emerald-400">
                  {lang === 'ar' ? '⚠️ احفظ هذا الرمز — لن يظهر مرة أخرى' : '⚠️ Save this token — it will not be shown again'}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded-lg bg-night-950 p-2 text-xs text-emerald-300">{generatedToken}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { navigator.clipboard.writeText(generatedToken); toast.success(lang === 'ar' ? 'تم النسخ' : 'Copied'); }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-night-400">
                  {lang === 'ar'
                    ? 'الصقه في ملف .env على جهاز الطباعة: API_TOKEN=fps_...'
                    : 'Paste into .env on the print computer: API_TOKEN=fps_...'}
                </p>
              </div>
            ) : null}

            {/* Generate new token */}
            <div className="mb-4 flex gap-2">
              <Input
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder={lang === 'ar' ? 'اسم الرمز (مثال: طابعة الكاونتر)' : 'Token name (e.g. Counter Printer)'}
                className="flex-1"
              />
              <Button
                onClick={() => generateTokenMutation.mutate()}
                loading={generateTokenMutation.isPending}
                disabled={!newTokenName.trim()}
              >
                <Key className="h-4 w-4" />
                {lang === 'ar' ? 'إنشاء رمز' : 'Generate Token'}
              </Button>
            </div>

            {/* Token list */}
            {serviceTokens.isLoading ? (
              <Skeleton className="h-24" />
            ) : serviceTokens.data && serviceTokens.data.length > 0 ? (
              <div className="space-y-2">
                {serviceTokens.data.map((tk) => (
                  <div key={tk.id} className="flex items-center justify-between rounded-xl border border-night-800 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-night-100">{tk.name}</p>
                      <p className="text-xs text-night-500">
                        {tk.scope.join(', ')} · {lang === 'ar' ? 'أنشأ' : 'Created'} {new Date(tk.createdAt).toLocaleDateString()}
                        {tk.lastUsedAt ? ` · ${lang === 'ar' ? 'آخر استخدام' : 'Last used'} ${new Date(tk.lastUsedAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-bold', tk.isActive ? 'text-emerald-400' : 'text-red-400')}>
                        {tk.isActive ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'ملغي' : 'Revoked')}
                      </span>
                      {tk.isActive ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:bg-red-500/10"
                          onClick={() => revokeTokenMutation.mutate(tk.id)}
                          loading={revokeTokenMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-night-500">
                {lang === 'ar' ? 'لا توجد رمز خدمة' : 'No service tokens yet'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
