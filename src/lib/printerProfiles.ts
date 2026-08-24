/**
 * Printer Device Profiles & POS Types
 *
 * Defines supported printer types, POS device types, hardware profiles,
 * and capability descriptors. The system uses a layered architecture:
 *
 *   PrinterAdapter  — handles thermal/standard printing
 *   POSAdapter      — handles POS device registration
 *   PaymentAdapter  — handles payment processing
 *
 * Only adapters with actual API/SDK support should be implemented.
 * Profiles marked "profile_only" are prepared for future integration.
 */

// ── Printer Types ───────────────────────────────────────────────────────────

export type PrinterType =
  | 'thermal_58mm'
  | 'thermal_80mm'
  | 'a4'
  | 'windows_default'
  | 'network'
  | 'thermal';

export type ConnectionType = 'usb' | 'lan' | 'bluetooth' | 'wifi' | 'windows';

export type PaperWidth = '58' | '80' | 'a4';

export interface PrinterProfile {
  id: string;
  name: string;
  type: PrinterType;
  manufacturer: string;
  model: string;
  connection: ConnectionType;
  paperWidth: PaperWidth;
  capabilities: PrinterCapabilities;
  status: 'active' | 'profile_only' | 'deprecated';
  notes?: string;
}

export interface PrinterCapabilities {
  thermal: boolean;
  arabicText: boolean;
  arabicImage: boolean; // rasterized Arabic fallback
  escpos: boolean;
  cutter: boolean;
  cashDrawer: boolean;
  buzzer: boolean;
  color: boolean;
  duplex: boolean;
  maxWidth: number; // mm
  minWidth: number; // mm
}

// ── POS Device Types ────────────────────────────────────────────────────────

export type POSType =
  | 'fawry'
  | 'aman'
  | 'bee'
  | 'masary'
  | 'paysky'
  | 'paymob'
  | 'geidea'
  | 'other';

export type POSHardwareModel =
  | 'pax_a920_pro'
  | 'pax_a910s'
  | 'pax_a8900'
  | 'verifone_x990'
  | 'verifone_x990_pro'
  | 'nexgo_n96'
  | 'sunmi_p2'
  | 'feitian_f20'
  | 'feitian_v6'
  | 'telpo_tps900'
  | 'morefun_pos10q'
  | 'morefun_m90'
  | 'urovo_i9100'
  | 'castle_saturn_1000'
  | 'castle_s1f3'
  | 'toshiba_tcx300'
  | 'other';

export type DeviceCategory = 'soft_pos' | 'smart_pos' | 'mini_pos' | 'traditional_pos' | 'thermal_printer' | 'a4_printer';

export interface POSDeviceProfile {
  id: string;
  name: string;
  manufacturer: string;
  model: POSHardwareModel;
  posType: POSType;
  category: DeviceCategory;
  connection: ConnectionType[];
  paperWidth: PaperWidth[];
  capabilities: DeviceCapabilities;
  sdkAvailable: boolean;
  sdkUrl?: string;
  status: 'active' | 'profile_only' | 'deprecated';
  notes?: string;
}

export interface DeviceCapabilities {
  printer: boolean;
  payment: boolean;
  cashier: boolean;
  bluetooth: boolean;
  usb: boolean;
  lan: boolean;
  wifi: boolean;
  nfc: boolean;
  camera: boolean;
  barcode: boolean;
  touchscreen: boolean;
  receiptPrinter: boolean;
  arabicSupport: boolean;
  localAgentSupport: boolean;
}

// ── Print Formats ───────────────────────────────────────────────────────────

export type PrintFormat = 'thermal_58' | 'thermal_80' | 'a4' | 'pdf';

export interface PrintFormatOption {
  id: PrintFormat;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  paperWidth: PaperWidth;
  requiresPrinter: boolean;
}

// ── Adapter Interfaces (for future implementation) ──────────────────────────

export interface PrinterAdapter {
  readonly id: string;
  readonly name: string;
  print(data: Uint8Array | string, options?: Record<string, unknown>): Promise<boolean>;
  getStatus(): Promise<'online' | 'offline' | 'error'>;
  cut(): Promise<void>;
}

export interface POSAdapter {
  readonly id: string;
  readonly name: string;
  initialize(config: Record<string, unknown>): Promise<boolean>;
  processPayment(amount: number, method: string): Promise<{ success: boolean; reference?: string }>;
  getStatus(): Promise<'ready' | 'busy' | 'offline' | 'error'>;
}

export interface PaymentAdapter {
  readonly id: string;
  readonly name: string;
  charge(amount: number, metadata?: Record<string, unknown>): Promise<{ success: boolean; transactionId?: string }>;
  refund(transactionId: string, amount: number): Promise<{ success: boolean }>;
}

// ── Predefined Data ─────────────────────────────────────────────────────────

export const PRINTER_TYPES: { value: PrinterType; labelAr: string; labelEn: string }[] = [
  { value: 'thermal', labelAr: 'طابعة حرارية', labelEn: 'Thermal Printer' },
  { value: 'thermal_58mm', labelAr: 'طابعة حرارية 58mm', labelEn: '58mm Thermal' },
  { value: 'thermal_80mm', labelAr: 'طابعة حرارية 80mm', labelEn: '80mm Thermal' },
  { value: 'a4', labelAr: 'طابعة A4', labelEn: 'A4 Printer' },
  { value: 'windows_default', labelAr: 'طابعة Windows الافتراضية', labelEn: 'Windows Default' },
  { value: 'network', labelAr: 'طابعة شبكة', labelEn: 'Network Printer' },
];

export const CONNECTION_TYPES: { value: ConnectionType; labelAr: string; labelEn: string }[] = [
  { value: 'usb', labelAr: 'USB', labelEn: 'USB' },
  { value: 'lan', labelAr: 'شبكة (LAN)', labelEn: 'LAN' },
  { value: 'wifi', labelAr: 'واي فاي', labelEn: 'Wi-Fi' },
  { value: 'bluetooth', labelAr: 'بلوتوث', labelEn: 'Bluetooth' },
  { value: 'windows', labelAr: 'طابعة Windows', labelEn: 'Windows Printer' },
];

export const POS_TYPES: { value: POSType; labelAr: string; labelEn: string }[] = [
  { value: 'fawry', labelAr: 'فوبري', labelEn: 'Fawry' },
  { value: 'aman', labelAr: 'أمان', labelEn: 'AMAN' },
  { value: 'bee', labelAr: 'بي', labelEn: 'Bee' },
  { value: 'masary', labelAr: 'مسري', labelEn: 'Masary' },
  { value: 'paysky', labelAr: 'باي سكاي', labelEn: 'PaySky' },
  { value: 'paymob', labelAr: 'بايموب', labelEn: 'Paymob' },
  { value: 'geidea', labelAr: 'جديعة', labelEn: 'Geidea' },
  { value: 'other', labelAr: 'أخرى', labelEn: 'Other' },
];

export const DEVICE_CATEGORIES: { value: DeviceCategory; labelAr: string; labelEn: string }[] = [
  { value: 'soft_pos', labelAr: 'Soft POS', labelEn: 'Soft POS' },
  { value: 'smart_pos', labelAr: 'Smart POS', labelEn: 'Smart POS' },
  { value: 'mini_pos', labelAr: 'Mini POS', labelEn: 'Mini POS' },
  { value: 'traditional_pos', labelAr: 'جهاز POS تقليدي', labelEn: 'Traditional POS' },
  { value: 'thermal_printer', labelAr: 'طابعة حرارية', labelEn: 'Thermal Printer' },
  { value: 'a4_printer', labelAr: 'طابعة A4', labelEn: 'A4 Printer' },
];

export const POS_HARDWARE_PROFILES: POSDeviceProfile[] = [
  {
    id: 'pax_a920_pro', name: 'PAX A920 Pro', manufacturer: 'PAX',
    model: 'pax_a920_pro', posType: 'other', category: 'smart_pos',
    connection: ['wifi', 'bluetooth', 'lan'], paperWidth: ['80'],
    capabilities: {
      printer: true, payment: true, cashier: true, bluetooth: true, usb: true,
      lan: true, wifi: true, nfc: true, camera: true, barcode: true,
      touchscreen: true, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Android-based Smart POS with built-in printer. Requires PAX SDK for integration.',
  },
  {
    id: 'pax_a910s', name: 'PAX A910S', manufacturer: 'PAX',
    model: 'pax_a910s', posType: 'other', category: 'smart_pos',
    connection: ['wifi', 'bluetooth'], paperWidth: ['80'],
    capabilities: {
      printer: true, payment: true, cashier: false, bluetooth: true, usb: true,
      lan: false, wifi: true, nfc: true, camera: false, barcode: true,
      touchscreen: true, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Compact Smart POS. Requires PAX SDK.',
  },
  {
    id: 'pax_a8900', name: 'PAX A8900', manufacturer: 'PAX',
    model: 'pax_a8900', posType: 'other', category: 'smart_pos',
    connection: ['wifi', 'bluetooth', 'lan'], paperWidth: ['80'],
    capabilities: {
      printer: true, payment: true, cashier: true, bluetooth: true, usb: true,
      lan: true, wifi: true, nfc: true, camera: true, barcode: true,
      touchscreen: true, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Enterprise Smart POS. Requires PAX SDK.',
  },
  {
    id: 'verifone_x990', name: 'Verifone X990', manufacturer: 'Verifone',
    model: 'verifone_x990', posType: 'other', category: 'smart_pos',
    connection: ['wifi', 'lan'], paperWidth: ['80'],
    capabilities: {
      printer: true, payment: true, cashier: true, bluetooth: false, usb: true,
      lan: true, wifi: true, nfc: true, camera: false, barcode: true,
      touchscreen: true, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Verifone Smart POS. Requires Verifone SDK/API.',
  },
  {
    id: 'verifone_x990_pro', name: 'Verifone X990 Pro', manufacturer: 'Verifone',
    model: 'verifone_x990_pro', posType: 'other', category: 'smart_pos',
    connection: ['wifi', 'lan', 'bluetooth'], paperWidth: ['80'],
    capabilities: {
      printer: true, payment: true, cashier: true, bluetooth: true, usb: true,
      lan: true, wifi: true, nfc: true, camera: true, barcode: true,
      touchscreen: true, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Verifone flagship Smart POS. Requires Verifone SDK/API.',
  },
  {
    id: 'nexgo_n96', name: 'NEXGO N96', manufacturer: 'NEXGO',
    model: 'nexgo_n96', posType: 'other', category: 'smart_pos',
    connection: ['wifi', 'bluetooth'], paperWidth: ['80'],
    capabilities: {
      printer: true, payment: true, cashier: false, bluetooth: true, usb: true,
      lan: false, wifi: true, nfc: true, camera: true, barcode: true,
      touchscreen: true, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'NEXGO Android Smart POS. Requires NEXGO SDK.',
  },
  {
    id: 'sunmi_p2', name: 'Sunmi P2', manufacturer: 'Sunmi',
    model: 'sunmi_p2', posType: 'other', category: 'mini_pos',
    connection: ['wifi', 'bluetooth'], paperWidth: ['58'],
    capabilities: {
      printer: true, payment: false, cashier: false, bluetooth: true, usb: true,
      lan: false, wifi: true, nfc: false, camera: false, barcode: false,
      touchscreen: true, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Sunmi mini POS with 58mm printer. Requires Sunmi SDK.',
  },
  {
    id: 'feitian_f20', name: 'Feitian F20', manufacturer: 'Feitian',
    model: 'feitian_f20', posType: 'other', category: 'mini_pos',
    connection: ['bluetooth', 'usb'], paperWidth: ['58'],
    capabilities: {
      printer: true, payment: true, cashier: false, bluetooth: true, usb: true,
      lan: false, wifi: false, nfc: true, camera: false, barcode: false,
      touchscreen: false, receiptPrinter: true, arabicSupport: false, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Feitian mobile POS. Requires Feitian SDK.',
  },
  {
    id: 'feitian_v6', name: 'Feitian V6', manufacturer: 'Feitian',
    model: 'feitian_v6', posType: 'other', category: 'mini_pos',
    connection: ['bluetooth', 'usb'], paperWidth: ['58'],
    capabilities: {
      printer: true, payment: true, cashier: false, bluetooth: true, usb: true,
      lan: false, wifi: false, nfc: true, camera: false, barcode: false,
      touchscreen: true, receiptPrinter: true, arabicSupport: false, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Feitian V6 mobile POS. Requires Feitian SDK.',
  },
  {
    id: 'telpo_tps900', name: 'Telpo TPS900', manufacturer: 'Telpo',
    model: 'telpo_tps900', posType: 'other', category: 'smart_pos',
    connection: ['wifi', 'bluetooth', 'lan'], paperWidth: ['80'],
    capabilities: {
      printer: true, payment: true, cashier: true, bluetooth: true, usb: true,
      lan: true, wifi: true, nfc: true, camera: true, barcode: true,
      touchscreen: true, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Telpo Smart POS. Requires Telpo SDK.',
  },
  {
    id: 'morefun_pos10q', name: 'MoreFun POS10Q', manufacturer: 'MoreFun',
    model: 'morefun_pos10q', posType: 'other', category: 'mini_pos',
    connection: ['bluetooth', 'usb'], paperWidth: ['58'],
    capabilities: {
      printer: true, payment: false, cashier: false, bluetooth: true, usb: true,
      lan: false, wifi: false, nfc: false, camera: false, barcode: false,
      touchscreen: false, receiptPrinter: true, arabicSupport: false, localAgentSupport: true,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'MoreFun portable printer. ESC/POS compatible.',
  },
  {
    id: 'morefun_m90', name: 'MoreFun M90', manufacturer: 'MoreFun',
    model: 'morefun_m90', posType: 'other', category: 'mini_pos',
    connection: ['bluetooth', 'usb'], paperWidth: ['58', '80'],
    capabilities: {
      printer: true, payment: false, cashier: false, bluetooth: true, usb: true,
      lan: false, wifi: false, nfc: false, camera: false, barcode: false,
      touchscreen: false, receiptPrinter: true, arabicSupport: false, localAgentSupport: true,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'MoreFun M90 portable printer. ESC/POS compatible.',
  },
  {
    id: 'urovo_i9100', name: 'UROVO i9100', manufacturer: 'UROVO',
    model: 'urovo_i9100', posType: 'other', category: 'smart_pos',
    connection: ['wifi', 'bluetooth', 'lan'], paperWidth: ['80'],
    capabilities: {
      printer: true, payment: true, cashier: true, bluetooth: true, usb: true,
      lan: true, wifi: true, nfc: true, camera: true, barcode: true,
      touchscreen: true, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'UROVO Android Smart POS. Requires UROVO SDK.',
  },
  {
    id: 'castle_saturn_1000', name: 'Castle Saturn 1000', manufacturer: 'Castle',
    model: 'castle_saturn_1000', posType: 'other', category: 'smart_pos',
    connection: ['wifi', 'lan'], paperWidth: ['80'],
    capabilities: {
      printer: true, payment: true, cashier: true, bluetooth: false, usb: true,
      lan: true, wifi: true, nfc: true, camera: false, barcode: true,
      touchscreen: true, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Castle Smart POS. Requires Castle SDK.',
  },
  {
    id: 'castle_s1f3', name: 'Castle S1F3', manufacturer: 'Castle',
    model: 'castle_s1f3', posType: 'other', category: 'traditional_pos',
    connection: ['lan'], paperWidth: ['80'],
    capabilities: {
      printer: true, payment: true, cashier: true, bluetooth: false, usb: false,
      lan: true, wifi: false, nfc: false, camera: false, barcode: false,
      touchscreen: false, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Castle traditional POS terminal. Requires Castle SDK.',
  },
  {
    id: 'toshiba_tcx300', name: 'Toshiba TCX300', manufacturer: 'Toshiba',
    model: 'toshiba_tcx300', posType: 'other', category: 'traditional_pos',
    connection: ['lan'], paperWidth: ['80'],
    capabilities: {
      printer: true, payment: true, cashier: true, bluetooth: false, usb: false,
      lan: true, wifi: false, nfc: false, camera: false, barcode: false,
      touchscreen: false, receiptPrinter: true, arabicSupport: true, localAgentSupport: false,
    },
    sdkAvailable: false, status: 'profile_only',
    notes: 'Toshiba POS terminal. Requires Toshiba SDK.',
  },
];

export const PRINT_FORMAT_OPTIONS: PrintFormatOption[] = [
  {
    id: 'thermal_58', labelAr: 'فاتورة حرارية 58mm', labelEn: 'Thermal 58mm Receipt',
    descriptionAr: 'فاتورة مصغرة لأجهزة 58mm', descriptionEn: 'Compact receipt for 58mm printers',
    paperWidth: '58', requiresPrinter: true,
  },
  {
    id: 'thermal_80', labelAr: 'فاتورة حرارية 80mm', labelEn: 'Thermal 80mm Receipt',
    descriptionAr: 'فاتورة قياسية لأجهزة 80mm', descriptionEn: 'Standard receipt for 80mm printers',
    paperWidth: '80', requiresPrinter: true,
  },
  {
    id: 'a4', labelAr: 'فاتورة A4', labelEn: 'A4 Invoice',
    descriptionAr: 'فاتورة كاملة على ورق A4', descriptionEn: 'Full invoice on A4 paper',
    paperWidth: 'a4', requiresPrinter: true,
  },
  {
    id: 'pdf', labelAr: 'ملف PDF', labelEn: 'PDF File',
    descriptionAr: 'تحميل فاتورة كملف PDF', descriptionEn: 'Download invoice as PDF file',
    paperWidth: 'a4', requiresPrinter: false,
  },
];

/** Default thermal printer capabilities. */
export const DEFAULT_THERMAL_CAPABILITIES: PrinterCapabilities = {
  thermal: true,
  arabicText: false,
  arabicImage: true,
  escpos: true,
  cutter: true,
  cashDrawer: false,
  buzzer: false,
  color: false,
  duplex: false,
  maxWidth: 80,
  minWidth: 58,
};

/** Default A4 printer capabilities. */
export const DEFAULT_A4_CAPABILITIES: PrinterCapabilities = {
  thermal: false,
  arabicText: true,
  arabicImage: false,
  escpos: false,
  cutter: false,
  cashDrawer: false,
  buzzer: false,
  color: true,
  duplex: false,
  maxWidth: 210,
  minWidth: 210,
};

/** Helper to get printer type label. */
export function getPrinterTypeLabel(type: PrinterType, lang: 'ar' | 'en'): string {
  return PRINTER_TYPES.find((t) => t.value === type)?.[lang === 'ar' ? 'labelAr' : 'labelEn'] ?? type;
}

/** Helper to get connection type label. */
export function getConnectionLabel(conn: ConnectionType, lang: 'ar' | 'en'): string {
  return CONNECTION_TYPES.find((t) => t.value === conn)?.[lang === 'ar' ? 'labelAr' : 'labelEn'] ?? conn;
}

/** Helper to get POS type label. */
export function getPOSTypeLabel(type: POSType, lang: 'ar' | 'en'): string {
  return POS_TYPES.find((t) => t.value === type)?.[lang === 'ar' ? 'labelAr' : 'labelEn'] ?? type;
}

/** Helper to get device category label. */
export function getDeviceCategoryLabel(cat: DeviceCategory, lang: 'ar' | 'en'): string {
  return DEVICE_CATEGORIES.find((t) => t.value === cat)?.[lang === 'ar' ? 'labelAr' : 'labelEn'] ?? cat;
}
