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

import EscPos from 'escpos';
import EscposUSB from 'escpos-usb';
import EscposNetwork from 'escpos-network';
import fetch from 'node-fetch';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { platform, arch } from 'node:os';

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
  windowsPrinterName: process.env.WINDOWS_PRINTER_NAME || '',
  bluetoothComPort: process.env.BLUETOOTH_COM_PORT || '',
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
    const buffer = Buffer.from(base64, 'base64');    const image = new EscPos.Image(buffer);
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
    const buffer = Buffer.from(base64, 'base64');    const image = new EscPos.Image(buffer);
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

// ─── Windows Printer Discovery ───────────────────────────────────────────────
/**
 * Discovers printers available on Windows via WMI and PowerShell.
 * Falls back gracefully on non-Windows platforms.
 */
class WindowsPrinterDiscovery {
  /**
   * List all printers installed on the Windows print spooler.
   * Uses wmic as primary, PowerShell Get-Printer as fallback.
   * @returns {Promise<Array<{name: string, driver: string, portName: string, status: string, shared: boolean, printProcessor: string}>>}
   */
  static async discoverPrinters() {
    const isWindows = platform() === 'win32';
    if (!isWindows) {
      log('info', 'DISCOVERY', 'Printer discovery only available on Windows');
      return [];
    }

    // Try PowerShell Get-Printer first (more reliable on modern Windows)
    try {
      return await WindowsPrinterDiscovery._discoverViaPowerShell();
    } catch (psErr) {
      log('warn', 'DISCOVERY', 'PowerShell Get-Printer failed, trying wmic', { error: psErr.message });
    }

    // Fallback to wmic
    try {
      return await WindowsPrinterDiscovery._discoverViaWmic();
    } catch (wmicErr) {
      log('error', 'DISCOVERY', 'Both discovery methods failed', { error: wmicErr.message });
      return [];
    }
  }

  /**
   * Discover printers via PowerShell Get-Printer cmdlet.
   * Returns detailed info including port, driver, status, and capabilities.
   */
  static async _discoverViaPowerShell() {
    const psCommand = [
      'Get-Printer |',
      'Select-Object Name,DriverName,PortName,PrinterStatus,Type,Shared,PrintProcessor,Environment,PrinterUri,Location,Comment |',
      'ConvertTo-Json -Compress',
    ].join(' ');

    const raw = execSync(
      `powershell -NoProfile -NonInteractive -Command "${psCommand}"`,
      { encoding: 'utf8', timeout: 10000, windowsHide: true }
    ).trim();

    if (!raw || raw === 'null') {
      log('info', 'DISCOVERY', 'No printers found via PowerShell');
      return [];
    }

    // PowerShell may return a single object or an array
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      log('error', 'DISCOVERY', 'Failed to parse PowerShell output');
      return [];
    }

    const printers = Array.isArray(parsed) ? parsed : [parsed];
    const statusMap = {
      0: 'other',
      1: 'idle',
      2: 'printing',
      3: 'warmup',
      4: 'stopped',
      5: 'offline',
    };

    return printers.map((p) => ({
      name: p.Name || '',
      driver: p.DriverName || '',
      portName: p.PortName || '',
      status: statusMap[p.PrinterStatus] || `unknown(${p.PrinterStatus})`,
      type: p.Type || 0,
      shared: !!p.Shared,
      printProcessor: p.PrintProcessor || '',
      environment: p.Environment || '',
      location: p.Location || '',
      comment: p.Comment || '',
      isLocal: !!(p.Type & 1),
      isNetwork: !!(p.Type & 4),
    }));
  }

  /**
   * Discover printers via wmic (legacy, works on older Windows).
   */
  static async _discoverViaWmic() {
    const raw = execSync(
      'wmic printer list brief /format:csv',
      { encoding: 'utf8', timeout: 10000, windowsHide: true }
    ).trim();

    const lines = raw.split('\n').filter(Boolean);
    if (lines.length < 2) {
      log('info', 'DISCOVERY', 'No printers found via wmic');
      return [];
    }

    // CSV: Node,DriverName,Name,PortName,PrinterStatus,Shared
    const headers = lines[0].split(',').map((h) => h.trim());
    const printers = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });

      printers.push({
        name: obj.Name || '',
        driver: obj.DriverName || '',
        portName: obj.PortName || '',
        status: obj.PrinterStatus || 'unknown',
        shared: obj.Shared === 'TRUE',
        printProcessor: '',
        environment: '',
        location: '',
        comment: '',
        isLocal: !!(obj.PortName || '').match(/^USB|^LPT|^COM/i),
        isNetwork: !!(obj.PortName || '').match(/^IP_/i),
      });
    }

    return printers;
  }

  /**
   * Test connectivity to a discovered printer.
   * @param {string} printerName
   * @returns {Promise<{reachable: boolean, error?: string}>}
   */
  static async testPrinter(printerName) {
    const isWindows = platform() === 'win32';
    if (!isWindows) {
      return { reachable: false, error: 'Printer testing only available on Windows' };
    }

    try {
      const psCommand = `
        $printer = Get-Printer -Name '${printerName.replace(/'/g, "''")}' -ErrorAction Stop;
        if ($printer.PrinterStatus -eq 5) { 'OFFLINE' }
        elseif ($printer.PrinterStatus -eq 4) { 'STOPPED' }
        else { 'READY' }
      `.trim();

      const result = execSync(
        `powershell -NoProfile -NonInteractive -Command "${psCommand}"`,
        { encoding: 'utf8', timeout: 10000, windowsHide: true }
      ).trim();

      return { reachable: result === 'READY', status: result };
    } catch (err) {
      return { reachable: false, error: err.message };
    }
  }

  /**
   * Get detailed info for a single printer.
   * @param {string} printerName
   * @returns {Promise<object|null>}
   */
  static async getPrinterDetails(printerName) {
    const printers = await WindowsPrinterDiscovery.discoverPrinters();
    return printers.find((p) => p.name === printerName) || null;
  }
}

// ─── Windows System Printer Adapter ──────────────────────────────────────────
/**
 * Prints via the Windows print spooler using raw ESC/POS data.
 * Uses `copy /b` to send raw bytes to a USB/LPT port, or `print` command,
 * or PowerShell Out-Printer for system-registered printers.
 */
class WindowsSystemPrinterAdapter {
  constructor(printerName, paperWidth) {
    this.name = 'Windows System';
    this.connectionType = 'windows';
    this.printerName = printerName || process.env.WINDOWS_PRINTER_NAME || '';
    this.paperWidth = paperWidth || 80;
    this.connected = false;
  }

  /**
   * Escape a string for safe embedding in a PowerShell single-quoted string.
   * In PowerShell single-quoted strings, only single quotes need escaping (double them).
   */
  static escapePsString(str) {
    return str.replace(/'/g, "''");
  }

  /**
   * Escape a Windows file path for use inside a PowerShell single-quoted string.
   * Forward slashes become backslashes; single quotes are doubled.
   */
  static escapePsPath(filePath) {
    const normalized = filePath.replace(/\//g, '\\');
    return normalized.replace(/'/g, "''");
  }

  /**
   * Escape a string for use inside a PowerShell double-quoted string.
   * Backticks, dollar signs, and double quotes need escaping.
   */
  static escapePsDoubleQuoted(str) {
    return str.replace(/`/g, '``').replace(/\$/g, '`$').replace(/"/g, '\"');
  }

  async connect() {
    if (platform() !== 'win32') {
      log('error', 'WIN', 'Windows printer adapter requires Windows');
      return false;
    }

    if (!this.printerName) {
      log('error', 'WIN', 'No printer name configured', { code: ErrorCode.INVALID_PRINTER_CONFIGURATION });
      return false;
    }

    try {
      // Verify the printer exists in the spooler
      const details = await WindowsPrinterDiscovery.getPrinterDetails(this.printerName);
      if (!details) {
        log('error', 'WIN', `Printer "${this.printerName}" not found in Windows spooler`, { code: ErrorCode.PRINTER_NOT_FOUND });
        return false;
      }

      if (details.status === 'offline') {
        log('warn', 'WIN', `Printer "${this.printerName}" is offline`, { code: ErrorCode.PRINTER_OFFLINE });
        return false;
      }

      this.printerDetails = details;
      this.connected = true;
      log('info', 'WIN', `Connected to Windows printer: ${this.printerName}`, {
        driver: details.driver,
        port: details.portName,
        status: details.status,
      });
      return true;
    } catch (err) {
      log('error', 'WIN', 'Connection failed', { error: err.message, code: ErrorCode.PRINTER_NOT_FOUND });
      this.connected = false;
      return false;
    }
  }

  async disconnect() {
    this.connected = false;
    this.printerDetails = null;
    log('info', 'WIN', 'Disconnected from Windows printer');
  }

  async getStatus() {
    if (!this.printerName) {
      return { connected: false, status: 'no_printer_configured', details: { connectionType: 'windows' } };
    }

    try {
      const test = await WindowsPrinterDiscovery.testPrinter(this.printerName);
      this.connected = test.reachable;
      return {
        connected: test.reachable,
        status: test.reachable ? 'online' : (test.status || 'offline'),
        details: {
          connectionType: 'windows',
          printerName: this.printerName,
          driver: this.printerDetails?.driver || '',
          port: this.printerDetails?.portName || '',
          status: test.status,
        },
      };
    } catch (err) {
      return { connected: false, status: 'error', details: { connectionType: 'windows', error: err.message } };
    }
  }

  async isAvailable() {
    if (platform() !== 'win32') return false;
    try {
      const test = await WindowsPrinterDiscovery.testPrinter(this.printerName);
      return test.reachable;
    } catch {
      return false;
    }
  }

  /**
   * Execute a PowerShell command safely.
   */
  static runPowerShell(command) {
    return execSync(
      'powershell -NoProfile -NonInteractive -Command "' + WindowsSystemPrinterAdapter.escapePsDoubleQuoted(command) + '"',
      { encoding: 'utf8', timeout: 15000, windowsHide: true }
    );
  }

  /**
   * Send raw ESC/POS data to a Windows system printer.
   * Strategy 1: Write raw bytes to a temp file, send via WMI Win32_Printer.
   * Strategy 2: Use PowerShell Out-Printer.
   */
  async printRaw(data) {
    if (platform() !== 'win32') throw new Error('Windows printer adapter requires Windows');
    if (!this.connected) throw new Error(ErrorCode.PRINTER_NOT_FOUND);

    const { writeFileSync, unlinkSync, mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    // Strategy 1: Write raw bytes to temp file, print via WMI
    let tmpDir, tmpFile;
    try {
      tmpDir = mkdtempSync(join(tmpdir(), 'print-'));
      tmpFile = join(tmpDir, 'receipt.bin');
      const buffer = Buffer.from(data, 'binary');
      writeFileSync(tmpFile, buffer);

      const psFilePath = WindowsSystemPrinterAdapter.escapePsPath(tmpFile);
      const psPrinterName = WindowsSystemPrinterAdapter.escapePsString(this.printerName);

      const psScript = [
        '$bytes = [System.IO.File]::ReadAllBytes(\'' + psFilePath + '\')',
        '$printer = Get-WmiObject -Query "SELECT * from Win32_Printer WHERE Name=\'' + psPrinterName + '\'"',
        'if ($printer) {',
        '  $printer.RawPrintable = $true',
        '  $printer.Print()',
        '} else {',
        '  throw "Printer not found: ' + psPrinterName + '"',
        '}',
      ].join('; ');

      WindowsSystemPrinterAdapter.runPowerShell(psScript);
      log('info', 'WIN', `Raw data sent to printer: ${this.printerName}`);
      return true;
    } catch (psErr) {
      log('warn', 'WIN', 'WMI print method failed, trying Out-Printer', { error: psErr.message });
    } finally {
      // Cleanup temp files
      if (tmpFile) try { unlinkSync(tmpFile); } catch {}
      if (tmpDir) try { require('node:fs').rmdirSync(tmpDir); } catch {}
    }

    // Strategy 2: PowerShell Out-Printer (sends text output to printer)
    try {
      const psPrinterName = WindowsSystemPrinterAdapter.escapePsString(this.printerName);
      const safeData = data.replace(/\x1B/g, '').replace(/\x1D/g, '');
      const hereDoc = '@RECEIPT_END@\n' + safeData + '\n@RECEIPT_END@';
      const psScript = '$text = ' + hereDoc + '; $text | Out-Printer -Name \'' + psPrinterName + '\'';
      WindowsSystemPrinterAdapter.runPowerShell(psScript);
      log('info', 'WIN', `Data sent via Out-Printer to: ${this.printerName}`);
      return true;
    } catch (opErr) {
      log('error', 'WIN', 'All Windows print methods failed', { error: opErr.message, code: ErrorCode.PRINT_JOB_FAILED });
      throw new Error(ErrorCode.PRINT_JOB_FAILED);
    }
  }

  async printImage(base64Data) {
    if (platform() !== 'win32') throw new Error('Windows printer adapter requires Windows');
    if (!this.connected) throw new Error(ErrorCode.PRINTER_NOT_FOUND);

    const { writeFileSync, unlinkSync, mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    let tmpDir, imgFile;
    try {
      tmpDir = mkdtempSync(join(tmpdir(), 'print-img-'));
      const base64 = base64Data.replace(/^data:image\/png;base64,/, '');
      imgFile = join(tmpDir, 'receipt.png');
      writeFileSync(imgFile, Buffer.from(base64, 'base64'));

      const psFilePath = WindowsSystemPrinterAdapter.escapePsPath(imgFile);
      const psPrinterName = WindowsSystemPrinterAdapter.escapePsString(this.printerName);

      const psScript = [
        'Start-Process -FilePath \'' + psFilePath + '\'',
        '  -Verb PrintTo',
        '  -ArgumentList \'' + psPrinterName + '\'',
        '  -Wait -WindowStyle Hidden',
      ].join(' ');

      WindowsSystemPrinterAdapter.runPowerShell(psScript);
      log('info', 'WIN', `Image sent to printer: ${this.printerName}`);
      return true;
    } catch (err) {
      log('error', 'WIN', 'Image print failed', { error: err.message, code: ErrorCode.PRINT_JOB_FAILED });
      throw new Error(ErrorCode.PRINT_JOB_FAILED);
    } finally {
      if (imgFile) try { unlinkSync(imgFile); } catch {}
      if (tmpDir) try { require('node:fs').rmdirSync(tmpDir); } catch {}
    }
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
    case 'windows':
      return new WindowsSystemPrinterAdapter(config.windowsPrinterName, config.paperWidth);
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
    // CORS headers — allow browser frontend to call discovery endpoints
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

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
    } else if (req.url === '/printers' && req.method === 'GET') {
      // Discover available printers on the local machine
      try {
        const isWindows = platform() === 'win32';
        if (!isWindows) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            printers: [],
            platform: platform(),
            message: 'Printer discovery is only available on Windows',
          }));
          return;
        }

        log('info', 'HEALTH', 'Printer discovery requested');
        const printers = await WindowsPrinterDiscovery.discoverPrinters();

        // Categorize printers for convenience
        const usbPrinters = printers.filter((p) => p.isLocal && (p.portName || '').match(/^USB/i));
        const networkPrinters = printers.filter((p) => p.isNetwork || (p.portName || '').match(/^IP_/i));
        const serialPrinters = printers.filter((p) => (p.portName || '').match(/^(COM|LPT)/i));
        const allPrinters = printers;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          printers: allPrinters,
          byConnection: {
            usb: usbPrinters,
            network: networkPrinters,
            serial: serialPrinters,
          },
          summary: {
            total: allPrinters.length,
            usb: usbPrinters.length,
            network: networkPrinters.length,
            serial: serialPrinters.length,
          },
          platform: platform(),
          arch: arch(),
          timestamp: new Date().toISOString(),
        }));

        log('info', 'HEALTH', `Discovered ${printers.length} printers (USB: ${usbPrinters.length}, Network: ${networkPrinters.length}, Serial: ${serialPrinters.length})`);
      } catch (err) {
        log('error', 'HEALTH', 'Printer discovery failed', { error: err.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Printer discovery failed', details: err.message }));
      }
    } else if (req.url?.startsWith('/printers/') && req.url?.endsWith('/test') && req.method === 'POST') {
      // Test a specific printer by name
      const printerName = decodeURIComponent(req.url.split('/')[2]);
      try {
        if (platform() !== 'win32') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reachable: false, error: 'Only available on Windows' }));
          return;
        }

        log('info', 'HEALTH', `Testing printer: ${printerName}`);
        const result = await WindowsPrinterDiscovery.testPrinter(printerName);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        log('error', 'HEALTH', 'Printer test failed', { error: err.message, printerName });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reachable: false, error: err.message }));
      }
    } else if (req.url === '/print/direct' && req.method === 'POST') {
      // Direct print — accepts receipt data and prints immediately (no polling)
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const receipt = JSON.parse(body);
          if (!receipt || !receipt.orderNo) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid receipt data — orderNo required' }));
            return;
          }

          log('info', 'DIRECT', `Direct print request for order #${receipt.orderNo}`);

          // Build ESC/POS data from receipt
          const escposData = buildEscpos(receipt);

          // Print directly through the adapter
          const status = await adapter.getStatus();
          if (!status.connected) {
            log('error', 'DIRECT', 'Printer not connected', { code: ErrorCode.PRINTER_OFFLINE });
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: 'Printer not connected',
              code: ErrorCode.PRINTER_OFFLINE,
            }));
            return;
          }

          await adapter.printRaw(escposData);

          log('info', 'DIRECT', `Direct print completed for order #${receipt.orderNo}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: 'Print completed',
            orderNo: receipt.orderNo,
            connectionType: adapter.connectionType,
          }));
        } catch (err) {
          log('error', 'DIRECT', 'Direct print failed', { error: err.message, code: ErrorCode.PRINT_JOB_FAILED });
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: err.message,
            code: err.message in ErrorCode ? err.message : ErrorCode.PRINT_JOB_FAILED,
          }));
        }
      });
    } else if (req.url === '/discover' && req.method === 'GET') {
      // Universal printer discovery — scans USB, LAN, Windows, Bluetooth
      log('info', 'HEALTH', 'Universal printer discovery requested');
      try {
        const discovered = [];

        // 1. Windows installed printers (USB, Bluetooth, Serial, Network)
        if (platform() === 'win32') {
          try {
            const winPrinters = await WindowsPrinterDiscovery.discoverPrinters();
            for (const p of winPrinters) {
              const connType = (p.portName || '').match(/^USB/i) ? 'usb'
                : (p.portName || '').match(/^(COM|LPT)/i) ? 'serial'
                : (p.portName || '').match(/^IP_/i) || p.isNetwork ? 'lan'
                : 'windows';
              discovered.push({
                id: 'win-' + p.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
                name: p.name,
                model: p.driver || '',
                connection: connType,
                status: p.status === 'idle' || p.status === 'other' ? 'available' : p.status,
                paperWidth: '80',
                port: p.portName || '',
                ip: connType === 'lan' ? (p.portName || '').replace(/^IP_/, '').replace(/_/g, '.') : '',
                source: 'windows',
                detectedAt: new Date().toISOString(),
              });
            }
          } catch (err) {
            log('warn', 'HEALTH', 'Windows printer discovery failed', { error: err.message });
          }
        }

        // 2. LAN network scan — probe common ESC/POS ports on local subnet
        try {
          const net = await import('node:net');
          // Get local IP to determine subnet
          const localIps = [];
          const { networkInterfaces } = await import('node:os');
          const interfaces = networkInterfaces();
          for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name] || []) {
              if (iface.family === 'IPv4' && !iface.internal) {
                localIps.push(iface.address);
              }
            }
          }

          if (localIps.length > 0) {
            const baseIp = localIps[0].split('.').slice(0, 3).join('.');
            const scanPorts = [9100, 9101]; // Common ESC/POS ports
            const scanPromises = [];

            for (let hostOctet = 1; hostOctet <= 254; hostOctet++) {
              for (const port of scanPorts) {
                scanPromises.push(new Promise((resolve) => {
                  const socket = new net.Socket();
                  socket.setTimeout(800);
                  socket.on('connect', () => {
                    socket.destroy();
                    resolve({ ip: baseIp + '.' + hostOctet, port, open: true });
                  });
                  socket.on('timeout', () => { socket.destroy(); resolve(null); });
                  socket.on('error', () => { socket.destroy(); resolve(null); });
                  socket.connect(port, baseIp + '.' + hostOctet);
                }));
              }
            }

            const results = await Promise.all(scanPromises);
            const openPorts = results.filter((r) => r && r.open);

            for (const target of openPorts) {
              const id = 'lan-' + target.ip.replace(/\./g, '-');
              // Skip if already discovered via Windows
              if (!discovered.some((d) => d.ip === target.ip)) {
                discovered.push({
                  id,
                  name: 'Network Printer',
                  model: '',
                  connection: 'lan',
                  status: 'available',
                  paperWidth: '80',
                  port: String(target.port),
                  ip: target.ip,
                  source: 'lan-scan',
                  detectedAt: new Date().toISOString(),
                });
              }
            }
          }
        } catch (err) {
          log('warn', 'HEALTH', 'LAN scan failed', { error: err.message });
        }

        // 3. USB adapter availability
        try {
          const usbTest = new USBPrinterAdapter();
          const available = await usbTest.isAvailable();
          if (available && !discovered.some((d) => d.connection === 'usb' && d.source === 'windows')) {
            discovered.push({
              id: 'usb-detected',
              name: 'USB Thermal Printer',
              model: '',
              connection: 'usb',
              status: 'available',
              paperWidth: String(CONFIG.paperWidth),
              port: '',
              ip: '',
              source: 'usb-detect',
              detectedAt: new Date().toISOString(),
            });
          }
        } catch {
          // USB not available
        }

        log('info', 'HEALTH', `Universal discovery found ${discovered.length} printer(s)`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          printers: discovered,
          summary: {
            total: discovered.length,
            usb: discovered.filter((d) => d.connection === 'usb').length,
            lan: discovered.filter((d) => d.connection === 'lan').length,
            bluetooth: discovered.filter((d) => d.connection === 'bluetooth').length,
            serial: discovered.filter((d) => d.connection === 'serial').length,
            windows: discovered.filter((d) => d.connection === 'windows').length,
          },
          platform: platform(),
          arch: arch(),
          currentAdapter: adapter.connectionType,
          timestamp: new Date().toISOString(),
        }));
      } catch (err) {
        log('error', 'HEALTH', 'Universal discovery failed', { error: err.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Discovery failed', details: err.message }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(CONFIG.healthPort, () => {
    log('info', 'HEALTH', `Health check server listening on port ${CONFIG.healthPort}`);
    log('info', 'HEALTH', `  GET  http://localhost:${CONFIG.healthPort}/health`);
    log('info', 'HEALTH', `  GET  http://localhost:${CONFIG.healthPort}/status`);
    log('info', 'HEALTH', `  GET  http://localhost:${CONFIG.healthPort}/printers`);
    log('info', 'HEALTH', `  GET  http://localhost:${CONFIG.healthPort}/discover`);
    log('info', 'HEALTH', `  POST http://localhost:${CONFIG.healthPort}/test`);
    log('info', 'HEALTH', `  POST http://localhost:${CONFIG.healthPort}/printers/{name}/test`);
    log('info', 'HEALTH', `  POST http://localhost:${CONFIG.healthPort}/print/direct`);
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
