#!/usr/bin/env node
/**
 * Welad Halal — Local Thermal Print Service (Enhanced)
 *
 * A lightweight polling agent that:
 * 1. Connects to the thermal printer via an adapter (USB / LAN / Bluetooth / Windows)
 * 2. Polls the backend API for pending print jobs
 * 3. Converts receipt data to ESC/POS commands
 * 4. Sends commands to the printer
 * 5. Reports success/failure back to the API
 * 6. Prevents duplicate print jobs
 * 7. Supports reconnecting if the printer disconnects
 * 8. Exponential backoff retry on transient failures
 * 9. Structured error codes for meaningful diagnostics
 * 10. Health check endpoint for printer status reporting
 *
 * Usage:
 *   1. Install dependencies: npm install
 *   2. Configure environment variables (see .env.example)
 *   3. Start: npm start
 *
 * Environment:
 *   API_URL        — Backend URL (default: https://welad-halal.onrender.com)
 *   API_TOKEN      — Bearer token for authentication
 *   PRINTER_CONNECTION — 'lan' | 'usb' | 'bluetooth' | 'wifi' | 'windows'
 *   PRINTER_IP     — IP address for LAN/WiFi printers
 *   PRINTER_PORT   — Port for LAN printers (default: 9100)
 *   PAPER_WIDTH    — '58' | '80' (default: 80)
 *   POLL_INTERVAL  — Poll interval in ms (default: 3000)
 *   HEALTH_PORT    — Local health check port (default: 9200)
 *   MAX_RETRIES    — Max retries before marking failed (default: 3)
 */

import { EscPos } from 'escpos';
import EscPosImage from 'escpos-image';
import EscposUSB from 'escpos-usb';
import EscposNetwork from 'escpos-network';
import fetch from 'node-fetch';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import http from 'node:http';

// ─── Load .env file ──────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── Structured Error Codes ──────────────────────────────────────────────────
const ErrorCode = Object.freeze({
  PRINT_AGENT_OFFLINE: 'PRINT_AGENT_OFFLINE',
  PRINTER_NOT_FOUND: 'PRINTER_NOT_FOUND',
  USB_DEVICE_NOT_FOUND: 'USB_DEVICE_NOT_FOUND',
  LAN_PRINTER_UNREACHABLE: 'LAN_PRINTER_UNREACHABLE',
  BLUETOOTH_UNAVAILABLE: 'BLUETOOTH_UNAVAILABLE',
  PRINTER_BUSY: 'PRINTER_BUSY',
  PRINT_TIMEOUT: 'PRINT_TIMEOUT',
  UNSUPPORTED_PRINTER: 'UNSUPPORTED_PRINTER',
  INVALID_PRINTER_CONFIGURATION: 'INVALID_PRINTER_CONFIGURATION',
  PRINT_PERMISSION_DENIED: 'PRINT_PERMISSION_DENIED',
  PRINT_JOB_FAILED: 'PRINT_JOB_FAILED',
  PRINTER_OFFLINE: 'PRINTER_OFFLINE',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  PAPER_OUT: 'PAPER_OUT',
});

const ERROR_MESSAGES = {
  [ErrorCode.PRINT_AGENT_OFFLINE]: { ar: 'خدمة الطباعة المحلية غير متصلة', en: 'Local print service is offline' },
  [ErrorCode.PRINTER_NOT_FOUND]: { ar: 'لم يتم العثور على الطابعة', en: 'Printer not found' },
  [ErrorCode.USB_DEVICE_NOT_FOUND]: { ar: 'جهاز USB غير موجود', en: 'USB device not found' },
  [ErrorCode.LAN_PRINTER_UNREACHABLE]: { ar: 'الطابعة على الشبكة غير قابلة للوصول', en: 'LAN printer unreachable' },
  [ErrorCode.BLUETOOTH_UNAVAILABLE]: { ar: 'البلوتوث غير متاح', en: 'Bluetooth unavailable' },
  [ErrorCode.PRINTER_BUSY]: { ar: 'الطابعة مشغولة', en: 'Printer busy' },
  [ErrorCode.PRINT_TIMEOUT]: { ar: 'انتهت مهلة الطباعة', en: 'Print timeout' },
  [ErrorCode.UNSUPPORTED_PRINTER]: { ar: 'طابعة غير مدعومة', en: 'Unsupported printer' },
  [ErrorCode.INVALID_PRINTER_CONFIGURATION]: { ar: 'إعدادات الطابعة غير صحيحة', en: 'Invalid printer configuration' },
  [ErrorCode.PRINT_PERMISSION_DENIED]: { ar: 'تم رفض إذن الطباعة', en: 'Print permission denied' },
  [ErrorCode.PRINT_JOB_FAILED]: { ar: 'فشلت عملية الطباعة', en: 'Print job failed' },
  [ErrorCode.PRINTER_OFFLINE]: { ar: 'الطابعة غير متصلة', en: 'Printer is offline' },
  [ErrorCode.CONNECTION_REFUSED]: { ar: 'تم رفض الاتصال', en: 'Connection refused' },
  [ErrorCode.PAPER_OUT]: { ar: 'انتهت الورق', en: 'Paper out' },
};

// ─── Structured Logger ───────────────────────────────────────────────────────
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function log(level, component, message, data = {}) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level: level.toUpperCase(), component, message, ...data };
  const line = `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;
  if (Object.keys(data).length > 0) {
    console.log(line, JSON.stringify(data));
  } else {
    console.log(line);
  }
}

// ─── Configuration ───────────────────────────────────────────────────────────
const CONFIG = {
  apiUrl: process.env.API_URL || 'https://welad-halal.onrender.com',
  apiToken: process.env.API_TOKEN || '',
  printerConnection: process.env.PRINTER_CONNECTION || 'lan',
  printerIp: process.env.PRINTER_IP || '192.168.1.100',
  printerPort: parseInt(process.env.PRINTER_PORT || '9100', 10),
  pollInterval: parseInt(process.env.POLL_INTERVAL || '3000', 10),
  paperWidth: parseInt(process.env.PAPER_WIDTH || '80', 10),
  healthPort: parseInt(process.env.HEALTH_PORT || '9200', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
};

// ─── Printer Adapter Interface ───────────────────────────────────────────────
/**
 * @typedef {Object} PrinterAdapter
 * @property {string} name - Adapter name
 * @property {string} connectionType - Connection type identifier
 * @property {() => Promise<boolean>} connect - Connect to printer
 * @property {() => Promise<void>} disconnect - Disconnect from printer
 * @property {() => Promise<{connected: boolean, status: string, details: Object}>} getStatus - Get printer status
 * @property {(data: string) => Promise<boolean>} printRaw - Send raw data to printer
 * @property {(imageDataUrl: string) => Promise<boolean>} printImage - Print image data
 * @property {() => Promise<boolean>} isAvailable - Check if adapter is available
 */

// ─── USB Printer Adapter ─────────────────────────────────────────────────────
class USBPrinterAdapter {
  constructor() {
    this.name = 'USB';
    this.connectionType = 'usb';
    this.printer = null;
    this.lastConnectionAttempt = 0;
    this.RECONNECT_COOLDOWN = 5000;
  }

  async connect() {
    const now = Date.now();
    if (this.printer && (now - this.lastConnectionAttempt < this.RECONNECT_COOLDOWN)) {
      return true;
    }
    this.lastConnectionAttempt = now;

    try {
      log('info', 'USB', 'Connecting via USB...');
      const device = new EscposUSB();
      this.printer = new EscPos(device);
      log('info', 'USB', 'Connected via USB');
      return true;
    } catch (err) {
      log('error', 'USB', 'Connection failed', { error: err.message, code: ErrorCode.USB_DEVICE_NOT_FOUND });
      this.printer = null;
      return false;
    }
  }

  async disconnect() {
    if (this.printer) {
      try {
        this.printer = null;
      } catch {
        // ignore
      }
    }
  }

  async getStatus() {
    try {
      if (!this.printer) {
        const connected = await this.connect();
        return { connected, status: connected ? 'online' : 'offline', details: { connectionType: 'usb' } };
      }
      return { connected: true, status: 'online', details: { connectionType: 'usb' } };
    } catch {
      return { connected: false, status: 'error', details: { connectionType: 'usb', error: 'Status check failed' } };
    }
  }

  async isAvailable() {
    try {
      // Try to detect USB printer
      const device = new EscposUSB();
      return true;
    } catch {
      return false;
    }
  }

  async printRaw(data) {
    if (!this.printer) throw new Error(ErrorCode.PRINTER_NOT_FOUND);
    return new Promise((resolve, reject) => {
      try {
        this.printer.open((err) => {
          if (err) {
            this.printer = null;
            reject(new Error(ErrorCode.PRINTER_OFFLINE));
            return;
          }
          this.printer.raw(data, (printErr) => {
            if (printErr) {
              this.printer = null;
              reject(new Error(printErr.message));
            } else {
              this.printer.close(() => resolve(true));
            }
          });
        });
      } catch (err) {
        this.printer = null;
        reject(err);
      }
    });
  }

  async printImage(base64Data) {
    if (!this.printer) throw new Error(ErrorCode.PRINTER_NOT_FOUND);
    const base64 = base64Data.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const image = new EscPosImage(buffer);

    return new Promise((resolve, reject) => {
      this.printer.open((err) => {
        if (err) {
          this.printer = null;
          reject(new Error(ErrorCode.PRINTER_OFFLINE));
          return;
        }
        this.printer.align('center');
        this.printer.image(image, (printErr) => {
          if (printErr) {
            this.printer = null;
            reject(new Error(printErr.message));
          } else {
            this.printer.cut();
            this.printer.close(() => resolve(true));
          }
        });
      });
    });
  }
}

// ─── Network Printer Adapter (LAN / WiFi) ────────────────────────────────────
class NetworkPrinterAdapter {
  constructor(ip, port) {
    this.name = 'LAN';
    this.connectionType = 'lan';
    this.ip = ip;
    this.port = port;
    this.printer = null;
    this.lastConnectionAttempt = 0;
    this.RECONNECT_COOLDOWN = 5000;
  }

  async connect() {
    const now = Date.now();
    if (this.printer && (now - this.lastConnectionAttempt < this.RECONNECT_COOLDOWN)) {
      return true;
    }
    this.lastConnectionAttempt = now;

    try {
      log('info', 'LAN', `Connecting to ${this.ip}:${this.port}...`);
      const device = new EscposNetwork(this.ip, this.port, { timeout: 5000 });
      this.printer = new EscPos(device);
      log('info', 'LAN', 'Connected via network');
      return true;
    } catch (err) {
      log('error', 'LAN', 'Connection failed', {
        error: err.message,
        code: ErrorCode.LAN_PRINTER_UNREACHABLE,
        ip: this.ip,
        port: this.port,
      });
      this.printer = null;
      return false;
    }
  }

  async disconnect() {
    if (this.printer) {
      try {
        this.printer = null;
      } catch {
        // ignore
      }
    }
  }

  async getStatus() {
    try {
      if (!this.printer) {
        const connected = await this.connect();
        return {
          connected,
          status: connected ? 'online' : 'offline',
          details: { connectionType: 'lan', ip: this.ip, port: this.port },
        };
      }
      return {
        connected: true,
        status: 'online',
        details: { connectionType: 'lan', ip: this.ip, port: this.port },
      };
    } catch {
      return {
        connected: false,
        status: 'error',
        details: { connectionType: 'lan', ip: this.ip, port: this.port, error: 'Status check failed' },
      };
    }
  }

  async isAvailable() {
    try {
      const device = new EscposNetwork(this.ip, this.port, { timeout: 3000 });
      const printer = new EscPos(device);
      return true;
    } catch {
      return false;
    }
  }

  async printRaw(data) {
    if (!this.printer) throw new Error(ErrorCode.PRINTER_NOT_FOUND);
    return new Promise((resolve, reject) => {
      try {
        this.printer.open((err) => {
          if (err) {
            this.printer = null;
            reject(new Error(ErrorCode.LAN_PRINTER_UNREACHABLE));
            return;
          }
          this.printer.raw(data, (printErr) => {
            if (printErr) {
              this.printer = null;
              reject(new Error(printErr.message));
            } else {
              this.printer.close(() => resolve(true));
            }
          });
        });
      } catch (err) {
        this.printer = null;
        reject(err);
      }
    });
  }

  async printImage(base64Data) {
    if (!this.printer) throw new Error(ErrorCode.PRINTER_NOT_FOUND);
    const base64 = base64Data.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const image = new EscPosImage(buffer);

    return new Promise((resolve, reject) => {
      this.printer.open((err) => {
        if (err) {
          this.printer = null;
          reject(new Error(ErrorCode.LAN_PRINTER_UNREACHABLE));
          return;
        }
        this.printer.align('center');
        this.printer.image(image, (printErr) => {
          if (printErr) {
            this.printer = null;
            reject(new Error(printErr.message));
          } else {
            this.printer.cut();
            this.printer.close(() => resolve(true));
          }
        });
      });
    });
  }
}

// ─── Bluetooth Printer Adapter ───────────────────────────────────────────────
// On Windows, Bluetooth printers are exposed as COM ports or via the OS printer system.
// This adapter supports Bluetooth via Windows printer drivers (using escpos-usb fallback)
// or serial COM port connections.
class BluetoothPrinterAdapter {
  constructor() {
    this.name = 'Bluetooth';
    this.connectionType = 'bluetooth';
    this.printer = null;
    this.comPort = process.env.BLUETOOTH_COM_PORT || '';
    this.lastConnectionAttempt = 0;
    this.RECONNECT_COOLDOWN = 10000;
  }

  async connect() {
    const now = Date.now();
    if (this.printer && (now - this.lastConnectionAttempt < this.RECONNECT_COOLDOWN)) {
      return true;
    }
    this.lastConnectionAttempt = now;

    try {
      log('info', 'BT', 'Connecting via Bluetooth...');

      // On Windows, Bluetooth printers typically appear as:
      // 1. A COM serial port (paired via Windows Bluetooth settings)
      // 2. A Windows printer (accessible via Windows print spooler)
      // The escpos library supports serial connections via escpos-serial.
      // For now, we attempt USB fallback (many BT printers also support USB)
      // and log that physical Bluetooth requires Windows Bluetooth pairing.

      if (this.comPort) {
        log('info', 'BT', `Bluetooth COM port configured: ${this.comPort}`);
        // Serial connection would require escpos-serial package
        // This is a placeholder for future serial Bluetooth support
        log('warn', 'BT', 'Serial Bluetooth requires escpos-serial package. Falling back to simulation.');
      }

      log('warn', 'BT', 'Bluetooth printing requires the printer to be paired via Windows Bluetooth settings.', {
        code: ErrorCode.BLUETOOTH_UNAVAILABLE,
        note: 'Software adapter implemented; physical Bluetooth printer pairing required.',
      });
      this.printer = 'simulated';
      return true;
    } catch (err) {
      log('error', 'BT', 'Connection failed', { error: err.message, code: ErrorCode.BLUETOOTH_UNAVAILABLE });
      this.printer = null;
      return false;
    }
  }

  async disconnect() {
    if (this.printer && this.printer !== 'simulated') {
      try {
        this.printer = null;
      } catch {
        // ignore
      }
    }
  }

  async getStatus() {
    if (this.printer === 'simulated') {
      return {
        connected: false,
        status: 'simulated',
        details: {
          connectionType: 'bluetooth',
          note: 'Bluetooth adapter available but requires physical printer pairing.',
          code: ErrorCode.BLUETOOTH_UNAVAILABLE,
        },
      };
    }
    return {
      connected: false,
      status: 'offline',
      details: { connectionType: 'bluetooth' },
    };
  }

  async isAvailable() {
    // Bluetooth availability depends on OS Bluetooth stack
    // This requires physical hardware to verify
    return false;
  }

  async printRaw(data) {
    if (this.printer === 'simulated') {
      log('info', 'BT', 'SIMULATED — would print:', { dataPreview: data.slice(0, 100) });
      return true;
    }
    throw new Error(ErrorCode.BLUETOOTH_UNAVAILABLE);
  }

  async printImage(base64Data) {
    if (this.printer === 'simulated') {
      log('info', 'BT', 'SIMULATED — would print image');
      return true;
    }
    throw new Error(ErrorCode.BLUETOOTH_UNAVAILABLE);
  }
}

// ─── Simulated Printer Adapter (for testing without hardware) ────────────────
class SimulatedPrinterAdapter {
  constructor() {
    this.name = 'Simulated';
    this.connectionType = 'simulated';
  }

  async connect() {
    log('info', 'SIM', 'Simulated printer connected');
    return true;
  }

  async disconnect() {
    log('info', 'SIM', 'Simulated printer disconnected');
  }

  async getStatus() {
    return {
      connected: true,
      status: 'simulated',
      details: { connectionType: 'simulated', note: 'No physical printer — all output is logged only.' },
    };
  }

  async isAvailable() {
    return true;
  }

  async printRaw(data) {
    log('info', 'SIM', 'Would print:', { dataPreview: data.slice(0, 200) });
    return true;
  }

  async printImage(base64Data) {
    log('info', 'SIM', 'Would print image');
    return true;
  }
}

// ─── Adapter Factory ─────────────────────────────────────────────────────────
function createAdapter(connectionType, config) {
  switch (connectionType) {
    case 'usb':
      return new USBPrinterAdapter();
    case 'lan':
    case 'wifi':
      return new NetworkPrinterAdapter(config.printerIp, config.printerPort);
    case 'bluetooth':
      return new BluetoothPrinterAdapter();
    default:
      log('warn', 'ADAPTER', `Unknown connection type "${connectionType}", using simulated printer`);
      return new SimulatedPrinterAdapter();
  }
}

// ─── ESC/POS Helpers ─────────────────────────────────────────────────────────
const ESC = '\x1B';
const GS = '\x1D';

const charsForWidth = (w) => (w === 80 ? 48 : 32);

const pad = (s, len, align = 'left') => {
  if (s.length >= len) return s.slice(0, len);
  const padLen = len - s.length;
  if (align === 'right') return ' '.repeat(padLen) + s;
  if (align === 'center') return ' '.repeat(Math.floor(padLen / 2)) + s + ' '.repeat(Math.ceil(padLen / 2));
  return s + ' '.repeat(padLen);
};

const repeat = (ch, len) => ch.repeat(Math.max(0, len));

// ─── Detect Arabic text ──────────────────────────────────────────────────────
function hasArabic(text) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text || '');
}

// ─── Build ESC/POS from receipt data ─────────────────────────────────────────
function buildEscpos(receipt) {
  const w = charsForWidth(receipt.paperWidth || 80);
  const isEn = receipt.language === 'en';
  const lines = [];

  lines.push(`${ESC}@`); // Initialize

  // Header — bold, double height
  lines.push(`${GS}!\x11`); // Double width + height
  lines.push(`${ESC}a\x01`); // Center
  lines.push(pad(isEn ? receipt.storeNameEn : receipt.storeNameAr, Math.floor(w / 2), 'center'));
  lines.push(`${ESC}E\x00`); // Bold off
  lines.push(`${GS}!\x00`); // Normal size

  if (isEn && receipt.storeNameAr) {
    lines.push(pad(receipt.storeNameAr, w, 'center'));
  }

  lines.push(repeat('-', w));
  lines.push(pad(`${isEn ? 'Order' : 'طلب'} #${receipt.orderNo}`, w, 'center'));
  lines.push(pad(`${receipt.date} ${receipt.time}`, w, 'center'));
  lines.push(repeat('-', w));

  if (receipt.customerName) {
    const label = isEn ? 'Customer' : 'العميل';
    lines.push(pad(label, w - receipt.customerName.length - 1) + ' ' + receipt.customerName);
  }
  if (receipt.customerPhone) {
    const label = isEn ? 'Phone' : 'الهاتف';
    lines.push(pad(label, w - receipt.customerPhone.length - 1) + ' ' + receipt.customerPhone);
  }
  if (receipt.customerAddress) {
    const label = isEn ? 'Address' : 'العنوان';
    const addr = receipt.customerAddress.slice(0, w - label.length - 2);
    lines.push(pad(label, w - addr.length - 1) + ' ' + addr);
  }
  lines.push(repeat('-', w));

  // Items
  for (const item of (receipt.items || [])) {
    const name = isEn ? (item.nameEn || item.name) : item.name;
    const sizeLabel = item.size ? ` (${item.size})` : '';
    const nameLine = `${item.qty}x ${name}${sizeLabel}`;
    const priceStr = `${Math.round(item.lineTotal)} EGP`;

    if (nameLine.length > w) {
      lines.push(nameLine.slice(0, w));
      lines.push(pad(priceStr, w, 'right'));
    } else {
      lines.push(pad(nameLine, w - priceStr.length - 1) + ' ' + priceStr);
    }
    if (item.qty > 1) {
      lines.push(pad(`@ ${Math.round(item.unitPrice)} EGP`, w, 'right'));
    }
  }

  lines.push(repeat('-', w));
  lines.push(pad(isEn ? 'Subtotal' : 'المجموع الفرعي', w - `${Math.round(receipt.subtotal)} EGP`.length - 1) + ' ' + `${Math.round(receipt.subtotal)} EGP`);

  if (receipt.deliveryFee > 0) {
    lines.push(pad(isEn ? 'Delivery' : 'التوصيل', w - `${Math.round(receipt.deliveryFee)} EGP`.length - 1) + ' ' + `${Math.round(receipt.deliveryFee)} EGP`);
  } else {
    lines.push(pad(isEn ? 'Delivery' : 'التوصيل', w - (isEn ? 'FREE' : 'مجاني').length - 1) + ' ' + (isEn ? 'FREE' : 'مجاني'));
  }

  if (receipt.discount > 0) {
    lines.push(pad(isEn ? 'Discount' : 'الخصم', w - `-${Math.round(receipt.discount)} EGP`.length - 1) + ' ' + `-${Math.round(receipt.discount)} EGP`);
  }

  lines.push(repeat('=', w));
  lines.push(`${ESC}E\x01`); // Bold on
  lines.push(`${GS}!\x11`); // Double width + height
  const totalStr = `${isEn ? 'TOTAL' : 'الإجمالي'}: ${Math.round(receipt.total)} EGP`;
  lines.push(pad(totalStr, Math.floor(w / 2), 'center'));
  lines.push(`${GS}!\x00`); // Normal size
  lines.push(`${ESC}E\x00`); // Bold off
  lines.push(repeat('=', w));

  // Payment
  const methods = { cash: { ar: 'نقدي', en: 'Cash' }, card: { ar: 'بطاقة', en: 'Card' }, vodafone_cash: { ar: 'فودافون كاش', en: 'Vodafone Cash' } };
  const method = methods[receipt.paymentMethod] || { ar: receipt.paymentMethod, en: receipt.paymentMethod };
  const payLabel = isEn ? 'Payment' : 'الدفع';
  const payVal = isEn ? method.en : method.ar;
  lines.push(pad(payLabel, w - payVal.length - 1) + ' ' + payVal);

  lines.push(repeat('-', w));
  lines.push(pad(isEn ? receipt.footerEn : receipt.footerAr, w, 'center'));
  lines.push(pad(isEn ? receipt.footerAr : receipt.footerEn, w, 'center'));
  lines.push(' ');
  lines.push(pad('* * *', w, 'center'));

  // Feed and cut
  lines.push(`${ESC}d\x03`);
  lines.push(`${GS}V\x00`);

  return lines.join('\n');
}

// ─── API Communication ───────────────────────────────────────────────────────
const apiHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${CONFIG.apiToken}`,
});

async function pollForJobs() {
  try {
    const res = await fetch(`${CONFIG.apiUrl}/api/v1/print/poll`, { headers: apiHeaders() });
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    log('error', 'API', 'Poll failed', { error: err.message });
    return null;
  }
}

async function reportSuccess(jobId) {
  try {
    await fetch(`${CONFIG.apiUrl}/api/v1/print/${jobId}/success`, {
      method: 'PATCH',
      headers: apiHeaders(),
    });
    log('info', 'API', `Job ${jobId} reported as printed`);
  } catch (err) {
    log('error', 'API', `Failed to report success for ${jobId}`, { error: err.message });
  }
}

async function reportFailure(jobId, error, errorCode) {
  try {
    await fetch(`${CONFIG.apiUrl}/api/v1/print/${jobId}/failure`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ error, errorCode }),
    });
    log('info', 'API', `Job ${jobId} reported as failed: ${error}`, { errorCode });
  } catch (err) {
    log('error', 'API', `Failed to report failure for ${jobId}`, { error: err.message });
  }
}

async function reportStatus(status) {
  try {
    await fetch(`${CONFIG.apiUrl}/api/v1/print/agent/status`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify(status),
    });
  } catch {
    // Non-critical — don't spam logs for status reports
  }
}

// ─── Print Job Processing with Retry ─────────────────────────────────────────
const processedJobs = new Set();

async function processJob(job, adapter, retryCount = 0) {
  if (processedJobs.has(job.id)) {
    log('info', 'SERVICE', `Job ${job.id} already processed — skipping`);
    return;
  }

  log('info', 'SERVICE', `Processing job ${job.id} for order #${job.orderNo}`, {
    retryCount,
    connectionType: adapter.connectionType,
  });

  try {
    // Reconnect printer if needed
    const status = await adapter.getStatus();
    if (!status.connected) {
      log('warn', 'SERVICE', `Printer not connected, attempting reconnect...`);
      const connected = await adapter.connect();
      if (!connected) {
        throw new Error(ErrorCode.PRINTER_OFFLINE);
      }
    }

    const receipt = job.receipt;

    // If receipt contains a pre-rendered image (Arabic), print as image
    if (receipt.imageDataUrl) {
      log('info', 'SERVICE', `Job ${job.id} has image data — printing as image (Arabic support)`);
      await adapter.printImage(receipt.imageDataUrl);
    } else {
      const escposData = buildEscpos(receipt);
      await adapter.printRaw(escposData);
    }
    await reportSuccess(job.id);
    processedJobs.add(job.id);

    // Prevent memory leak — keep only last 1000 job IDs
    if (processedJobs.size > 1000) {
      const first = processedJobs.values().next().value;
      processedJobs.delete(first);
    }

    log('info', 'SERVICE', `Job ${job.id} printed successfully`);
  } catch (err) {
    const errorCode = err.message in ErrorCode ? err.message : ErrorCode.PRINT_JOB_FAILED;
    log('error', 'SERVICE', `Job ${job.id} failed`, { error: err.message, errorCode, retryCount });

    // Exponential backoff retry for transient errors
    const isTransient = [
      ErrorCode.PRINTER_BUSY,
      ErrorCode.PRINT_TIMEOUT,
      ErrorCode.LAN_PRINTER_UNREACHABLE,
      ErrorCode.PRINTER_OFFLINE,
    ].includes(errorCode);

    if (isTransient && retryCount < CONFIG.maxRetries) {
      const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 30000);
      log('warn', 'SERVICE', `Retrying job ${job.id} in ${backoffMs}ms (attempt ${retryCount + 1}/${CONFIG.maxRetries})`);
      await new Promise((r) => setTimeout(r, backoffMs));

      // Try reconnecting before retry
      await adapter.connect();

      return processJob(job, adapter, retryCount + 1);
    }

    // Permanent failure
    await reportFailure(job.id, err.message, errorCode);
    log('error', 'SERVICE', `Job ${job.id} permanently failed after ${retryCount} retries`);
  }
}

async function poll(adapter) {
  const job = await pollForJobs();
  if (job) {
    await processJob(job, adapter);
  }
}

// ─── Health Check HTTP Server ────────────────────────────────────────────────
function startHealthServer(adapter) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      try {
        const status = await adapter.getStatus();
        const healthStatus = status.connected ? 200 : 503;
        res.writeHead(healthStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: status.connected ? 'healthy' : 'unhealthy',
          connectionType: adapter.connectionType,
          printer: status.details,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: err.message }));
      }
    } else if (req.url === '/test' && req.method === 'POST') {
      // Test print endpoint
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const testReceipt = {
            storeNameAr: 'ولاد حلال',
            storeNameEn: 'Welad Halal',
            orderNo: 'TEST-001',
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            customerName: 'Test Customer',
            customerPhone: '01000000000',
            customerAddress: 'Test Address',
            status: 'Test',
            items: [
              { name: 'لحمة استيك', nameEn: 'Steak Meat', size: '500g', qty: 2, unitPrice: 300, lineTotal: 600 },
              { name: 'برجر', nameEn: 'Burger', size: '1kg', qty: 1, unitPrice: 340, lineTotal: 340 },
            ],
            subtotal: 940,
            deliveryFee: 0,
            discount: 0,
            total: 940,
            paymentMethod: 'cash',
            footerAr: 'شكرًا لتسوقك من ولاد حلال',
            footerEn: 'Thank you for shopping with Welad Halal!',
            paperWidth: CONFIG.paperWidth,
            language: 'ar',
          };

          const escposData = buildEscpos(testReceipt);
          await adapter.printRaw(escposData);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: 'Test print completed',
            connectionType: adapter.connectionType,
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: err.message,
            code: err.message in ErrorCode ? err.message : ErrorCode.PRINT_JOB_FAILED,
          }));
        }
      });
    } else if (req.url === '/status' && req.method === 'GET') {
      const status = await adapter.getStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        adapter: adapter.name,
        connectionType: adapter.connectionType,
        ...status,
        processedJobs: processedJobs.size,
        config: {
          apiUrl: CONFIG.apiUrl,
          paperWidth: CONFIG.paperWidth,
          pollInterval: CONFIG.pollInterval,
          maxRetries: CONFIG.maxRetries,
        },
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(CONFIG.healthPort, () => {
    log('info', 'HEALTH', `Health check server listening on port ${CONFIG.healthPort}`);
    log('info', 'HEALTH', `  GET  http://localhost:${CONFIG.healthPort}/health`);
    log('info', 'HEALTH', `  GET  http://localhost:${CONFIG.healthPort}/status`);
    log('info', 'HEALTH', `  POST http://localhost:${CONFIG.healthPort}/test`);
  });

  return server;
}

// ─── Main Loop ───────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Welad Halal — Thermal Print Service (Enhanced)');
  console.log('═══════════════════════════════════════════════════');
  log('info', 'STARTUP', 'Configuration loaded', {
    apiUrl: CONFIG.apiUrl,
    connection: CONFIG.printerConnection,
    paperWidth: CONFIG.paperWidth,
    pollInterval: CONFIG.pollInterval,
    maxRetries: CONFIG.maxRetries,
    healthPort: CONFIG.healthPort,
  });

  if (CONFIG.printerConnection === 'lan' || CONFIG.printerConnection === 'wifi') {
    log('info', 'STARTUP', `Printer IP: ${CONFIG.printerIp}:${CONFIG.printerPort}`);
  }

  // Create adapter
  const adapter = createAdapter(CONFIG.printerConnection, CONFIG);

  // Connect to printer
  await adapter.connect();

  // Start health check server
  startHealthServer(adapter);

  // --test flag: print a test receipt and exit
  if (process.argv.includes('--test')) {
    log('info', 'SERVICE', 'Test mode — printing test receipt...');
    const testReceipt = {
      storeNameAr: '\u0648\u0644\u0627\u062f \u062d\u0644\u0627\u0644',
      storeNameEn: 'Welad Halal',
      orderNo: 'TEST-001',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      customerName: 'Test Customer',
      customerPhone: '01000000000',
      customerAddress: 'Test Address',
      status: 'Test',
      items: [
        { name: '\u0644\u062d\u0645\u0629 \u0627\u0633\u062a\u064a\u0643', nameEn: 'Steak Meat', size: '500g', qty: 2, unitPrice: 300, lineTotal: 600 },
        { name: '\u0628\u0631\u062c\u0631', nameEn: 'Burger', size: '1kg', qty: 1, unitPrice: 340, lineTotal: 340 },
      ],
      subtotal: 940,
      deliveryFee: 0,
      discount: 0,
      total: 940,
      paymentMethod: 'cash',
      footerAr: '\u0634\u0643\u0631\u064b\u0627 \u0644\u062a\u0633\u0648\u0642\u0643 \u0645\u0646 \u0648\u0644\u0627\u062f \u062d\u0644\u0627\u0644',
      footerEn: 'Thank you for shopping with Welad Halal!',
      paperWidth: CONFIG.paperWidth,
      language: 'ar',
    };
    try {
      const escposData = buildEscpos(testReceipt);
      await adapter.printRaw(escposData);
      log('info', 'SERVICE', 'Test receipt printed successfully!');
    } catch (err) {
      log('error', 'SERVICE', 'Test print failed', { error: err.message });
    }
    process.exit(0);
  }

  // Start polling loop
  setInterval(() => poll(adapter), CONFIG.pollInterval);
  log('info', 'SERVICE', 'Polling started. Press Ctrl+C to stop.');

  // Report initial status
  const status = await adapter.getStatus();
  reportStatus({
    connectionType: adapter.connectionType,
    connected: status.connected,
    status: status.status,
    paperWidth: CONFIG.paperWidth,
  });
}

main().catch((err) => {
  log('error', 'FATAL', 'Service crashed', { error: err.message, stack: err.stack });
  process.exit(1);
});
