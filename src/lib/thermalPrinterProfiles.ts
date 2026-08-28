/**
 * Thermal Printer Profiles
 *
 * Pre-defined profiles for common POS/thermal receipt printers.
 * When a user adds a printer or selects a discovered printer, the profile
 * auto-fills: name, paper width, default port, ESC/POS support, etc.
 *
 * Also provides paper-width auto-detection based on model name matching.
 */

export interface ThermalPrinterProfile {
  id: string;
  /** Human-readable name */
  name: string;
  /** Manufacturer */
  manufacturer: string;
  /** Common model patterns (lowercase) used for fuzzy matching */
  modelPatterns: string[];
  /** Default paper width */
  paperWidth: '58' | '80';
  /** Default connection type */
  connection: 'usb' | 'lan' | 'bluetooth' | 'wifi' | 'windows';
  /** Default port for LAN connections */
  defaultPort: string;
  /** Whether this printer supports ESC/POS */
  escpos: boolean;
  /** Whether this printer supports image printing (for Arabic) */
  imagePrint: boolean;
  /** Has automatic paper cutter */
  cutter: boolean;
  /** Has cash drawer connector */
  cashDrawer: boolean;
  /** Notes for the user */
  notesAr: string;
  notesEn: string;
}

// ── Common Thermal Printer Profiles ──────────────────────────────────────────

export const THERMAL_PRINTER_PROFILES: ThermalPrinterProfile[] = [
  // ── XPrinter Series ──────────────────────────────────────────────────────
  {
    id: 'xprinter-xp-80c',
    name: 'XPrinter XP-80C',
    manufacturer: 'XPrinter',
    modelPatterns: ['xp-80c', 'xp80c', 'xp 80c', 'xp-80', 'xp80'],
    paperWidth: '80',
    connection: 'usb',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: true,
    notesAr: 'طابعة حرارية 80mm شائعة — مدعومة بشكل كامل',
    notesEn: 'Common 80mm thermal printer — fully supported',
  },
  {
    id: 'xprinter-xp-58ii',
    name: 'XPrinter XP-58II',
    manufacturer: 'XPrinter',
    modelPatterns: ['xp-58ii', 'xp58ii', 'xp 58ii', 'xp-58', 'xp58'],
    paperWidth: '58',
    connection: 'usb',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: false,
    notesAr: 'طابعة حرارية 58mm مصغرة',
    notesEn: 'Compact 58mm thermal printer',
  },
  {
    id: 'xprinter-xp-n160ii',
    name: 'XPrinter XP-N160II',
    manufacturer: 'XPrinter',
    modelPatterns: ['xp-n160ii', 'xpn160ii', 'n160'],
    paperWidth: '80',
    connection: 'bluetooth',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: false,
    notesAr: 'طابعة بلوتوث 80mm',
    notesEn: 'Bluetooth 80mm thermal printer',
  },

  // ── Epson TM Series ──────────────────────────────────────────────────────
  {
    id: 'epson-tm-t20ii',
    name: 'Epson TM-T20II',
    manufacturer: 'Epson',
    modelPatterns: ['tm-t20ii', 'tmt20ii', 'tm-t20', 'tmt20'],
    paperWidth: '80',
    connection: 'usb',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: true,
    notesAr: 'طابعة Epson كلاسيكية — موثوقة جداً',
    notesEn: 'Classic Epson printer — very reliable',
  },
  {
    id: 'epson-tm-t88vi',
    name: 'Epson TM-T88VI',
    manufacturer: 'Epson',
    modelPatterns: ['tm-t88vi', 'tmt88vi', 'tm-t88', 'tmt88'],
    paperWidth: '80',
    connection: 'lan',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: true,
    notesAr: 'طابعة Epson سريعة — تدعم الشبكة والUSB',
    notesEn: 'Fast Epson printer — supports LAN and USB',
  },
  {
    id: 'epson-tm-u220',
    name: 'Epson TM-U220',
    manufacturer: 'Epson',
    modelPatterns: ['tm-u220', 'tmu220'],
    paperWidth: '80',
    connection: 'usb',
    defaultPort: '9100',
    escpos: true,
    imagePrint: false,
    cutter: true,
    cashDrawer: true,
    notesAr: 'طابعة Epson نقطية — لا تدعم طباعة الصور',
    notesEn: 'Dot matrix Epson — no image printing',
  },

  // ── Rongta Series ────────────────────────────────────────────────────────
  {
    id: 'rongta-rp80',
    name: 'Rongta RP80',
    manufacturer: 'Rongta',
    modelPatterns: ['rp80', 'rp-80'],
    paperWidth: '80',
    connection: 'usb',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: true,
    notesAr: 'طابعة Rongta 80mm — ممتازة للقيمة',
    notesEn: 'Rongta 80mm — excellent value',
  },
  {
    id: 'rongta-rp58',
    name: 'Rongta RP58',
    manufacturer: 'Rongta',
    modelPatterns: ['rp58', 'rp-58'],
    paperWidth: '58',
    connection: 'usb',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: false,
    notesAr: 'طابعة Rongta 58mm مصغرة',
    notesEn: 'Compact Rongta 58mm',
  },

  // ── Star Micronics ───────────────────────────────────────────────────────
  {
    id: 'star-tsp143',
    name: 'Star TSP143',
    manufacturer: 'Star',
    modelPatterns: ['tsp143', 'tsp-143', 'tsp100'],
    paperWidth: '80',
    connection: 'lan',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: true,
    notesAr: 'طابعة Star موثوقة — تدعم LAN',
    notesEn: 'Reliable Star printer — LAN support',
  },

  // ── Citizen Series ───────────────────────────────────────────────────────
  {
    id: 'citizen-ct-s310ii',
    name: 'Citizen CT-S310II',
    manufacturer: 'Citizen',
    modelPatterns: ['ct-s310ii', 'cts310ii', 'ct-s310', 'cts310'],
    paperWidth: '80',
    connection: 'usb',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: true,
    notesAr: 'طابعة Citizen 80mm',
    notesEn: 'Citizen 80mm thermal printer',
  },

  // ── Bixolon ──────────────────────────────────────────────────────────────
  {
    id: 'bixolon-srp-350iii',
    name: 'Bixolon SRP-350III',
    manufacturer: 'Bixolon',
    modelPatterns: ['srp-350iii', 'srp350iii', 'srp-350', 'srp350'],
    paperWidth: '80',
    connection: 'usb',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: true,
    notesAr: 'طابعة Bixolon 80mm سريعة',
    notesEn: 'Fast Bixolon 80mm thermal',
  },

  // ── ZKTeco ───────────────────────────────────────────────────────────────
  {
    id: 'zkteco-prt-80h',
    name: 'ZKTeco PRT-80H',
    manufacturer: 'ZKTeco',
    modelPatterns: ['prt-80h', 'prt80h', 'prt-80', 'prt80'],
    paperWidth: '80',
    connection: 'usb',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: true,
    notesAr: 'طابعة ZKTeco 80mm',
    notesEn: 'ZKTeco 80mm thermal printer',
  },

  // ── Network / Generic ────────────────────────────────────────────────────
  {
    id: 'network-thermal-80',
    name: 'Generic Network Printer (80mm)',
    manufacturer: 'Generic',
    modelPatterns: ['network', 'lan', 'ip_'],
    paperWidth: '80',
    connection: 'lan',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: false,
    notesAr: 'طابعة حرارية شبكة عامة — اukkan عنوان IP يدوياً',
    notesEn: 'Generic network thermal — enter IP manually',
  },
  {
    id: 'network-thermal-58',
    name: 'Generic Network Printer (58mm)',
    manufacturer: 'Generic',
    modelPatterns: [],
    paperWidth: '58',
    connection: 'lan',
    defaultPort: '9100',
    escpos: true,
    imagePrint: true,
    cutter: true,
    cashDrawer: false,
    notesAr: 'طابعة حرارية شبكة 58mm عامة',
    notesEn: 'Generic network thermal 58mm',
  },

  // ── Windows Default ──────────────────────────────────────────────────────
  {
    id: 'windows-default',
    name: 'Windows Default Printer',
    manufacturer: 'Windows',
    modelPatterns: [],
    paperWidth: '80',
    connection: 'windows',
    defaultPort: '',
    escpos: false,
    imagePrint: true,
    cutter: false,
    cashDrawer: false,
    notesAr: 'استخدم الطابعة الافتراضية في Windows',
    notesEn: 'Uses the default Windows printer',
  },
];

// ── Profile Matching ────────────────────────────────────────────────────────

/**
 * Match a discovered printer name/model to a known profile.
 * Uses fuzzy matching on model patterns.
 * Returns the best match, or null if no match found.
 */
export function matchPrinterProfile(
  printerName: string,
  printerModel?: string,
  printerDriver?: string,
): ThermalPrinterProfile | null {
  const searchText = [printerName, printerModel, printerDriver]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, ' ');

  let bestMatch: ThermalPrinterProfile | null = null;
  let bestScore = 0;

  for (const profile of THERMAL_PRINTER_PROFILES) {
    let score = 0;

    // Check manufacturer name match
    if (searchText.includes(profile.manufacturer.toLowerCase())) {
      score += 3;
    }

    // Check model patterns
    for (const pattern of profile.modelPatterns) {
      if (searchText.includes(pattern)) {
        score += 5;
        break;
      }
    }

    // Bonus for exact manufacturer + model match
    if (score > 0 && profile.modelPatterns.length > 0) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = profile;
    }
  }

  return bestScore >= 3 ? bestMatch : null;
}

// ── Paper Width Auto-Detection ──────────────────────────────────────────────

/**
 * Detect paper width from a printer name/model string.
 * Returns '80' or '58' (default: '80').
 */
export function detectPaperWidth(
  printerName: string,
  printerModel?: string,
  printerDriver?: string,
  portName?: string,
): '58' | '80' {
  const searchText = [printerName, printerModel, printerDriver, portName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, ' ');

  // Check profile match first
  const profile = matchPrinterProfile(printerName, printerModel, printerDriver);
  if (profile) return profile.paperWidth;

  // Heuristic: look for 58 in the name
  if (/\b58\b/.test(searchText) || /58\s*mm/.test(searchText)) {
    return '58';
  }

  // Heuristic: look for 80 in the name
  if (/\b80\b/.test(searchText) || /80\s*mm/.test(searchText)) {
    return '80';
  }

  // Default to 80mm (more common for POS)
  return '80';
}

// ── Quick Profile Application ───────────────────────────────────────────────

export interface PrinterConfigDefaults {
  name: string;
  type: string;
  paperWidth: '58' | '80';
  connection: 'usb' | 'lan' | 'bluetooth' | 'wifi' | 'windows';
  ipAddress: string;
  port: string;
  deviceModel: string;
}

/**
 * Apply a printer profile to get default values for the Add Printer form.
 */
export function getProfileDefaults(
  profileId: string,
  discoveredName?: string,
  discoveredIp?: string,
): PrinterConfigDefaults {
  const profile = THERMAL_PRINTER_PROFILES.find((p) => p.id === profileId);
  if (!profile) {
    return {
      name: discoveredName || '',
      type: 'thermal',
      paperWidth: '80',
      connection: 'lan',
      ipAddress: '',
      port: '9100',
      deviceModel: '',
    };
  }

  return {
    name: discoveredName || profile.name,
    type: profile.connection === 'windows' ? 'windows_default' : 'thermal',
    paperWidth: profile.paperWidth,
    connection: profile.connection,
    ipAddress: discoveredIp || '',
    port: profile.defaultPort,
    deviceModel: profile.name,
  };
}

// ── Capability Summary ──────────────────────────────────────────────────────

export interface CapabilityBadge {
  labelAr: string;
  labelEn: string;
  supported: boolean;
  color: 'emerald' | 'amber' | 'red' | 'blue';
}

export function getProfileCapabilities(profile: ThermalPrinterProfile): CapabilityBadge[] {
  return [
    {
      labelAr: 'ESC/POS',
      labelEn: 'ESC/POS',
      supported: profile.escpos,
      color: profile.escpos ? 'emerald' : 'red',
    },
    {
      labelAr: 'طباعة صور',
      labelEn: 'Image Print',
      supported: profile.imagePrint,
      color: profile.imagePrint ? 'emerald' : 'red',
    },
    {
      labelAr: 'قص ورقة',
      labelEn: 'Cutter',
      supported: profile.cutter,
      color: profile.cutter ? 'emerald' : 'amber',
    },
    {
      labelAr: 'درج النقود',
      labelEn: 'Cash Drawer',
      supported: profile.cashDrawer,
      color: profile.cashDrawer ? 'blue' : 'amber',
    },
  ];
}
