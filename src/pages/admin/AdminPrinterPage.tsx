import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, Send, RefreshCw, CheckCircle, XCircle, AlertTriangle, Key, Copy, Trash2, Plus, Star, StarOff, Wifi, Usb, Bluetooth, Monitor, Clock, Search, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminSettings, updateSettings } from '@/api/admin';
import { listRecentPrintJobs, retryPrintJob, generateServiceToken, listServiceTokens, revokeServiceToken, createTestPrintJob, getAgentStatus, type AgentStatus } from '@/api/print';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, Skeleton } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { PageHeader } from '@/components/admin/primitives';
import { cn } from '@/lib/utils';
import { PrinterScanner } from '@/components/admin/PrinterScanner';
import type { DiscoveredPrinter } from '@/api/print';
import {
  THERMAL_PRINTER_PROFILES,
  matchPrinterProfile,
  detectPaperWidth,
  getProfileDefaults,
  getProfileCapabilities,
  type ThermalPrinterProfile,
} from '@/lib/thermalPrinterProfiles';
import { useAgentSSE } from '@/hooks/useAgentSSE';

interface PrinterConfig {
  id: string;
  name: string;
  type: string;
  paperWidth: '58' | '80';
  connection: 'usb' | 'lan' | 'bluetooth' | 'wifi' | 'windows';
  ipAddress: string;
  port: string;
  deviceModel: string;
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
      type: String(legacy.type || 'thermal'),
      paperWidth: (legacy.paperWidth === '58' ? '58' : '80') as '58' | '80',
      connection: (legacy.connection || 'lan') as PrinterConfig['connection'],
      ipAddress: String(legacy.ipAddress || ''),
      port: String(legacy.port || '9100'),
      deviceModel: String(legacy.deviceModel || ''),
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
  const agentStatusQuery = useQuery({ queryKey: ['admin', 'agent-status'], queryFn: getAgentStatus, refetchInterval: 15000 });

  // Real-time agent status via SSE
  const agentSSE = useAgentSSE(true);

  // Refresh print jobs when SSE reports a print event
  useEffect(() => {
    if (agentSSE.recentEvents.length > 0) {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'print-jobs'] });
    }
  }, [agentSSE.recentEvents.length, queryClient]);

  // Connection test state
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [connectionResults, setConnectionResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const savedPrinters = useMemo(() => migratePrinters(settings.data?.printerConfig), [settings.data?.printerConfig]);
  const [printers, setPrinters] = useState<PrinterConfig[]>(savedPrinters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testPrinting, setTestPrinting] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ThermalPrinterProfile | null>(null);
  const [newPrinter, setNewPrinter] = useState<Partial<PrinterConfig>>({
    name: '',
    type: 'thermal',
    paperWidth: '80',
    connection: 'lan',
    ipAddress: '',
    port: '9100',
    deviceModel: '',
    isDefault: false,
    isActive: true,
  });

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [agentUrl, setAgentUrl] = useState(() => {
    // Try to read from saved settings
    const saved = settings.data?.printerAgentUrl;
    return typeof saved === 'string' ? saved : 'http://localhost:9200';
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

  // Connection test handler
  const handleConnectionTest = useCallback(async (printer: PrinterConfig): Promise<void> => {
    setTestingConnection(printer.id);
    setConnectionResults((prev) => ({ ...prev, [printer.id]: { success: false, message: lang === 'ar' ? 'جاري الفحص...' : 'Testing...' } }));

    try {
      // Test by sending a test print job
      const testReceiptPayload = {
        storeNameAr: '\u0648\u0644\u0627\u062f \u062d\u0644\u0627\u0644',
        storeNameEn: 'Welad Halal',
        orderNo: 'TEST-CONN',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        status: 'Connection Test',
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        discount: 0,
        total: 0,
        paymentMethod: 'cash',
        footerAr: 'اختبار الاتصال',
        footerEn: 'Connection Test',
        paperWidth: printer.paperWidth,
        language: 'en',
      };
      await createTestPrintJob(testReceiptPayload);
      setConnectionResults((prev) => ({
        ...prev,
        [printer.id]: {
          success: true,
          message: lang === 'ar' ? '✓ تم إرسال اختبار الاتصال — تحقق من الطابعة' : '✓ Connection test sent — check printer',
        },
      }));
    } catch {
      setConnectionResults((prev) => ({
        ...prev,
        [printer.id]: {
          success: false,
          message: lang === 'ar'
            ? '✗ فشل الاتصال — تأكد من أن خدمة الطباعة المحلية تعمل'
            : '✗ Connection failed — ensure local print service is running',
        },
      }));
    } finally {
      setTimeout(() => setTestingConnection(null), 2000);
    }
  }, [lang]);

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

  const handleSelectDiscoveredPrinter = (printer: DiscoveredPrinter) => {
    const id = newPrinterId();
    const connType = printer.connection === 'serial' ? 'usb' : printer.connection;

    // Auto-detect profile and paper width
    const profile = matchPrinterProfile(printer.name, printer.model, printer.source);
    const autoPaperWidth = detectPaperWidth(printer.name, printer.model, printer.source, printer.port);

    const p: PrinterConfig = {
      id,
      name: printer.name,
      type: profile ? (connType === 'windows' ? 'windows_default' : 'thermal') : 'thermal',
      paperWidth: autoPaperWidth,
      connection: connType as PrinterConfig['connection'],
      ipAddress: printer.ip || '',
      port: printer.port || (connType === 'lan' ? '9100' : ''),
      deviceModel: profile ? profile.name : (printer.model || ''),
      isDefault: printers.length === 0,
      isActive: true,
    };
    setPrinters([...printers, p]);

    if (profile) {
      toast.success(
        lang === 'ar'
          ? `تمت إضافة ${printer.name} — تم التعرف على الطابعة (${profile.name})`
          : `Added ${printer.name} — profile detected (${profile.name})`
      );
    } else {
      toast.success(lang === 'ar' ? `تمت إضافة ${printer.name}` : `Added ${printer.name}`);
    }
    setShowScanner(false);
  };

  const handleAddPrinter = () => {
    const id = newPrinterId();
    const p: PrinterConfig = {
      id,
      name: newPrinter.name || (lang === 'ar' ? 'طابعة جديدة' : 'New Printer'),
      type: newPrinter.type ?? 'thermal',
      paperWidth: newPrinter.paperWidth ?? '80',
      connection: newPrinter.connection ?? 'lan',
      ipAddress: newPrinter.ipAddress ?? '',
      port: newPrinter.port ?? '9100',
      deviceModel: newPrinter.deviceModel ?? '',
      isDefault: printers.length === 0,
      isActive: true,
    };
    setPrinters([...printers, p]);
    setNewPrinter({ name: '', type: 'thermal', paperWidth: '80', connection: 'lan', ipAddress: '', port: '9100', deviceModel: '', isDefault: false, isActive: true });
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

  const connectionIcon = (c: string) => {
    switch (c) {
      case 'usb': return <Usb className="h-3 w-3" />;
      case 'lan': return <Wifi className="h-3 w-3" />;
      case 'wifi': return <Wifi className="h-3 w-3" />;
      case 'bluetooth': return <Bluetooth className="h-3 w-3" />;
      default: return <Monitor className="h-3 w-3" />;
    }
  };

  return (
    <div>
      <PageHeader title={lang === 'ar' ? 'إعدادات الطابعة' : 'Printer Settings'} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Printer List */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--tw-text-muted)]">
                <Printer className="h-4 w-4" />
                {lang === 'ar' ? 'الطابعات المتاحة' : 'Available Printers'}
                <span className="text-[var(--tw-text-muted)]">({printers.length})</span>
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setShowScanner(!showScanner); setShowAddForm(false); setEditingId(null); }}>
                  <Search className="h-4 w-4" />
                  {lang === 'ar' ? 'بحث عن الطابعات' : 'Scan Printers'}
                </Button>
                <Button size="sm" onClick={() => { setShowAddForm(!showAddForm); setShowScanner(false); setEditingId(null); }}>
                  <Plus className="h-4 w-4" />
                  {lang === 'ar' ? 'إضافة طابعة' : 'Add Printer'}
                </Button>
              </div>
            </div>

            {/* Printer Scanner */}
            {showScanner && (
              <div className="mb-4">
                <PrinterScanner
                  agentUrl={agentUrl}
                  onAgentUrlChange={setAgentUrl}
                  onSelectPrinter={handleSelectDiscoveredPrinter}
                  onClose={() => setShowScanner(false)}
                />
              </div>
            )}

            {/* Add Printer Form */}
            {showAddForm && !editingId && (
              <div className="mb-4 space-y-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
                <p className="text-sm font-bold text-brand-400">
                  {lang === 'ar' ? 'طابعة جديدة' : 'New Printer'}
                </p>

                {/* Profile Selector */}
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-[var(--tw-text-muted)]">
                    <Wrench className="h-3 w-3" />
                    {lang === 'ar' ? 'ملف الطابعة (اختياري — يملأ البيانات تلقائياً)' : 'Printer Profile (optional — auto-fills settings)'}
                  </label>
                  <Select
                    value={selectedProfileId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setSelectedProfileId(pid);
                      if (pid) {
                        const defaults = getProfileDefaults(pid);
                        setNewPrinter((prev) => ({
                          ...prev,
                          name: prev.name || defaults.name,
                          type: defaults.type,
                          paperWidth: defaults.paperWidth,
                          connection: defaults.connection,
                          port: defaults.port,
                          deviceModel: defaults.deviceModel,
                        }));
                        setSelectedProfile(THERMAL_PRINTER_PROFILES.find((p) => p.id === pid) || null);
                      } else {
                        setSelectedProfile(null);
                      }
                    }}
                  >
                    <option value="">{lang === 'ar' ? '— بدون ملف —' : '— No profile —'}</option>
                    {THERMAL_PRINTER_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.paperWidth}mm · {p.connection.toUpperCase()})
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Profile Info */}
                {selectedProfile && (
                  <div className="rounded-lg border border-[var(--tw-border-strong)] bg-[var(--tw-surface)]/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Printer className="h-4 w-4 text-brand-400" />
                      <span className="text-xs font-bold text-[var(--tw-text-muted)]">{selectedProfile.name}</span>
                      <span className="text-xs text-[var(--tw-text-muted)]">— {selectedProfile.manufacturer}</span>
                    </div>
                    <p className="text-xs text-[var(--tw-text-muted)] mb-2">
                      {lang === 'ar' ? selectedProfile.notesAr : selectedProfile.notesEn}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {getProfileCapabilities(selectedProfile).map((cap) => (
                        <span
                          key={cap.labelEn}
                          className={cn(
                            'rounded-md px-1.5 py-0.5 text-[10px] font-bold',
                            cap.supported ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[var(--tw-surface-alt)] text-[var(--tw-text-muted)]',
                          )}
                        >
                          {lang === 'ar' ? cap.labelAr : cap.labelEn} {cap.supported ? '✓' : '✗'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <Input
                  value={newPrinter.name ?? ''}
                  onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
                  placeholder={lang === 'ar' ? 'اسم الطابعة (مثال: الكاونتر)' : 'Printer name (e.g. Main Counter)'}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'نوع الطابعة' : 'Printer Type'}</label>
                    <Select value={newPrinter.type ?? 'thermal'} onChange={(e) => setNewPrinter({ ...newPrinter, type: e.target.value })}>
                      <option value="thermal">{lang === 'ar' ? 'طابعة حرارية' : 'Thermal'}</option>
                      <option value="thermal_58mm">{lang === 'ar' ? 'حرارية 58mm' : 'Thermal 58mm'}</option>
                      <option value="thermal_80mm">{lang === 'ar' ? 'حرارية 80mm' : 'Thermal 80mm'}</option>
                      <option value="a4">A4</option>
                      <option value="windows_default">{lang === 'ar' ? 'طابعة Windows' : 'Windows Default'}</option>
                      <option value="network">{lang === 'ar' ? 'طابعة شبكة' : 'Network'}</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'عرض الورق' : 'Paper Width'}</label>
                    <Select value={newPrinter.paperWidth ?? '80'} onChange={(e) => setNewPrinter({ ...newPrinter, paperWidth: e.target.value as '58' | '80' })}>
                      <option value="80">80mm — {lang === 'ar' ? 'قياسي' : 'Standard'}</option>
                      <option value="58">58mm — {lang === 'ar' ? 'مصغّر' : 'Compact'}</option>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'نوع الاتصال' : 'Connection'}</label>
                    <Select value={newPrinter.connection ?? 'lan'} onChange={(e) => setNewPrinter({ ...newPrinter, connection: e.target.value as PrinterConfig['connection'] })}>
                      <option value="lan">{connLabel('lan')}</option>
                      <option value="usb">USB</option>
                      <option value="bluetooth">{connLabel('bluetooth')}</option>
                      <option value="wifi">{connLabel('wifi')}</option>
                      <option value="windows">{lang === 'ar' ? 'طابعة Windows' : 'Windows Printer'}</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'طراز الجهاز' : 'Device Model'}</label>
                    <Input
                      value={newPrinter.deviceModel ?? ''}
                      onChange={(e) => setNewPrinter({ ...newPrinter, deviceModel: e.target.value })}
                      placeholder={lang === 'ar' ? 'مثال: Xprinter XP-80C' : 'e.g. Xprinter XP-80C'}
                    />
                  </div>
                </div>
                {(newPrinter.connection === 'lan' || newPrinter.connection === 'wifi') && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--tw-text-muted)]">IP Address</label>
                      <Input dir="ltr" value={newPrinter.ipAddress ?? ''} onChange={(e) => setNewPrinter({ ...newPrinter, ipAddress: e.target.value })} placeholder="192.168.1.100" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--tw-text-muted)]">{lang === 'ar' ? 'منفذ' : 'Port'}</label>
                      <Input dir="ltr" value={newPrinter.port ?? '9100'} onChange={(e) => setNewPrinter({ ...newPrinter, port: e.target.value })} placeholder="9100" />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddPrinter}>{lang === 'ar' ? 'إضافة' : 'Add'}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setSelectedProfileId(''); setSelectedProfile(null); }}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                </div>
              </div>
            )}

            {/* Printer List Items */}
            {printers.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--tw-text-muted)]">
                {lang === 'ar' ? 'لا توجد طابعات. أضف طابعة للبدء.' : 'No printers configured. Add one to get started.'}
              </p>
            ) : (
              <div className="space-y-3">
                {printers.map((p) => (
                  <div key={p.id} className={cn('rounded-xl border px-4 py-3', p.isDefault ? 'border-brand-500/40 bg-brand-500/5' : 'border-[var(--tw-border)]')}>
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
                            <p className="font-bold text-[var(--tw-text)]">{p.name}</p>
                            {p.isDefault && (
                              <span className="rounded-md bg-brand-500/20 px-2 py-0.5 text-xs font-bold text-brand-400">
                                {lang === 'ar' ? 'الافتراضية' : 'Default'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--tw-text-muted)]">
                            {connLabel(p.connection)} · {p.paperWidth}mm
                            {(p.connection === 'lan' || p.connection === 'wifi') && p.ipAddress ? ` · ${p.ipAddress}:${p.port}` : ''}
                          </p>
                          {p.deviceModel && (
                            <p className="text-[10px] text-night-600">
                              {p.deviceModel}
                            </p>
                          )}
                          {connectionResults[p.id] && (
                            <p className={cn('mt-1 text-xs font-semibold', connectionResults[p.id].success ? 'text-emerald-400' : 'text-red-400')}>
                              {connectionResults[p.id].message}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Auto-Detect Profile */}
                          <Button
                            variant="ghost"
                            size="icon"
                            title={lang === 'ar' ? 'اكتشاف تلقائي للطابعة' : 'Auto-detect printer profile'}
                            onClick={() => {
                              const profile = matchPrinterProfile(p.name, p.deviceModel);
                              if (profile) {
                                const pw = detectPaperWidth(p.name, p.deviceModel);
                                handleUpdatePrinter(p.id, {
                                  deviceModel: profile.name,
                                  paperWidth: pw,
                                  type: profile.connection === 'windows' ? 'windows_default' : 'thermal',
                                });
                                toast.success(
                                  lang === 'ar'
                                    ? `تم التعرف على: ${profile.name}`
                                    : `Detected: ${profile.name}`
                                );
                              } else {
                                toast.info(
                                  lang === 'ar'
                                    ? 'لم يتم التعرف على الطابعة — حدد الملف يدوياً'
                                    : 'Printer not recognized — select a profile manually'
                                );
                              }
                            }}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                          </Button>
                          {/* Connection Test */}
                          <Button
                            variant="ghost"
                            size="icon"
                            title={lang === 'ar' ? 'فحص الاتصال' : 'Test Connection'}
                            loading={testingConnection === p.id}
                            onClick={() => void handleConnectionTest(p)}
                            className="text-blue-400 hover:bg-blue-500/10"
                          >
                            <Wifi className="h-3.5 w-3.5" />
                          </Button>
                          {/* Test Print */}
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
                            {p.isDefault ? <Star className="h-3.5 w-3.5 text-brand-400 fill-brand-400" /> : <StarOff className="h-3.5 w-3.5 text-[var(--tw-text-muted)]" />}
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
                            <span className="text-xs text-[var(--tw-text-muted)]">✏️</span>
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
              <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--tw-text-muted)]">
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
                      className="flex items-center justify-between rounded-xl border border-[var(--tw-border)] px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon className={cn('h-4 w-4', statusColors[job.status])} />
                        <div>
                          <p className="text-sm font-bold text-[var(--tw-text)]">#{job.orderNo}</p>
                          <p className="text-xs text-[var(--tw-text-muted)]">
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
              <p className="py-8 text-center text-sm text-[var(--tw-text-muted)]">
                {lang === 'ar' ? 'لا توجد jobs طباعة' : 'No print jobs yet'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Agent Status — Real-time via SSE */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--tw-text-muted)]">
                <Monitor className="h-4 w-4" />
                {lang === 'ar' ? 'حالة خدمة الطباعة المحلية' : 'Local Print Agent Status'}
              </h3>
              <div className="flex items-center gap-2">
                {/* SSE connection indicator */}
                <span className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold',
                  agentSSE.connected
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-red-500/15 text-red-400',
                )}>
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    agentSSE.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400',
                  )} />
                  {agentSSE.connected
                    ? (lang === 'ar' ? 'مباشر' : 'LIVE')
                    : (lang === 'ar' ? 'غير متصل' : 'OFFLINE')}
                </span>
              </div>
            </div>

            {/* Real-time printer status */}
            <div className="space-y-3">
              {/* Main status card */}
              <div className={cn(
                'flex items-center justify-between rounded-xl border px-4 py-3',
                agentSSE.printerOnline
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-red-500/30 bg-red-500/5',
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    agentSSE.printerOnline ? 'bg-emerald-500/10' : 'bg-red-500/10',
                  )}>
                    {agentSSE.printerOnline
                      ? <CheckCircle className="h-5 w-5 text-emerald-400" />
                      : <XCircle className="h-5 w-5 text-red-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--tw-text)]">
                      {agentSSE.connectionType
                        ? agentSSE.connectionType.toUpperCase()
                        : (lang === 'ar' ? 'طابعة' : 'Printer')}
                    </p>
                    <p className="text-xs text-[var(--tw-text-muted)]">
                      {agentSSE.printerStatus === 'online'
                        ? (lang === 'ar' ? 'جاهزة للطباعة' : 'Ready to print')
                        : agentSSE.printerStatus === 'printing'
                        ? (lang === 'ar' ? 'جاري الطباعة...' : 'Printing...')
                        : agentSSE.printerStatus === 'error'
                        ? (lang === 'ar' ? 'خطأ في الطابعة' : 'Printer error')
                        : agentSSE.printerOnline
                        ? (lang === 'ar' ? 'متصلة' : 'Connected')
                        : (lang === 'ar' ? 'غير متصلة' : 'Disconnected')}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-bold',
                  agentSSE.printerOnline
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/20 text-red-400',
                )}>
                  {agentSSE.printerOnline
                    ? (lang === 'ar' ? 'نشط' : 'Online')
                    : (lang === 'ar' ? 'غير متصل' : 'Offline')}
                </span>
              </div>

              {/* Recent print activity from SSE */}
              {agentSSE.recentEvents.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
                    {lang === 'ar' ? 'نشاط الطباعة المباشر' : 'Live Print Activity'}
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {agentSSE.recentEvents.map((evt, i) => (
                      <div key={`${evt.data.jobId}-${i}`} className="flex items-center justify-between rounded-lg border border-[var(--tw-border)] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'h-2 w-2 rounded-full',
                            evt.type === 'print-start' ? 'bg-amber-400 animate-pulse'
                            : evt.type === 'print-success' ? 'bg-emerald-400'
                            : 'bg-red-400',
                          )} />
                          <span className="text-xs font-bold text-[var(--tw-text-muted)]">#{evt.data.orderNo}</span>
                          <span className="text-[10px] text-[var(--tw-text-muted)]">
                            {evt.type === 'print-start'
                              ? (lang === 'ar' ? 'جاري الطباعة...' : 'Printing...')
                              : evt.type === 'print-success'
                              ? (lang === 'ar' ? 'تم بنجاح' : 'Success')
                              : (lang === 'ar' ? 'فشل' : 'Failed')}
                          </span>
                          {evt.data.error && (
                            <span className="text-[10px] text-red-400 truncate max-w-[120px]">
                              {evt.data.error}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-night-600">
                          {new Date(evt.data.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback: show agent status from API if SSE is not connected */}
              {!agentSSE.connected && agentStatusQuery.data && agentStatusQuery.data.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--tw-text-muted)]">
                    {lang === 'ar' ? 'الحالة (تحديث يدوي)' : 'Status (manual refresh)'}
                  </p>
                  {agentStatusQuery.data.map((agent: AgentStatus) => (
                    <div
                      key={agent.agentId}
                      className="flex items-center justify-between rounded-xl border border-[var(--tw-border)] px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg',
                          agent.connected ? 'bg-emerald-500/10' : 'bg-red-500/10',
                        )}>
                          {connectionIcon(agent.connectionType)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[var(--tw-text)]">
                            {agent.connectionType.toUpperCase()}
                            <span className="ml-2 text-xs text-[var(--tw-text-muted)]">({agent.paperWidth}mm)</span>
                          </p>
                          <div className="flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            <span className="text-[var(--tw-text-muted)]">
                              {agent.isRecent
                                ? (lang === 'ar' ? 'متصل الآن' : 'Connected now')
                                : (lang === 'ar' ? 'غير نشط' : 'Inactive')}
                            </span>
                            <span className="text-night-600">·</span>
                            <span className="text-[var(--tw-text-muted)]">{new Date(agent.lastSeen).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                      <span className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-bold',
                        agent.isRecent
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400',
                      )}>
                        {agent.isRecent
                          ? (lang === 'ar' ? 'نشط' : 'Online')
                          : (lang === 'ar' ? 'غير متصل' : 'Offline')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* No agent found */}
              {!agentSSE.connected && (!agentStatusQuery.data || agentStatusQuery.data.length === 0) && (
                <div className="py-6 text-center">
                  <Monitor className="mx-auto mb-2 h-8 w-8 text-night-600" />
                  <p className="text-sm text-[var(--tw-text-muted)]">
                    {lang === 'ar'
                      ? 'لا توجد خدمة طباعة محلية متصلة'
                      : 'No local print agent connected'}
                  </p>
                  <p className="mt-1 text-xs text-night-600">
                    {lang === 'ar'
                      ? 'قم بتشغيل خدمة الطباعة المحلية على جهاز المحل'
                      : 'Start the local print service on the shop computer'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Service Tokens */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Key className="h-4 w-4 text-[var(--tw-text-muted)]" />
              <h3 className="text-sm font-bold text-[var(--tw-text-muted)]">
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
                <p className="mt-2 text-xs text-[var(--tw-text-muted)]">
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
                  <div key={tk.id} className="flex items-center justify-between rounded-xl border border-[var(--tw-border)] px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--tw-text)]">{tk.name}</p>
                      <p className="text-xs text-[var(--tw-text-muted)]">
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
              <p className="py-4 text-center text-sm text-[var(--tw-text-muted)]">
                {lang === 'ar' ? 'لا توجد رمز خدمة' : 'No service tokens yet'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
