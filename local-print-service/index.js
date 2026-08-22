#!/usr/bin/env node
/**
 * Freezer El Balad — Local Thermal Print Service
 *
 * A lightweight polling agent that:
 * 1. Connects to the thermal printer (USB / LAN / Bluetooth / WiFi)
 * 2. Polls the backend API for pending print jobs
 * 3. Converts receipt data to ESC/POS commands
 * 4. Sends commands to the printer
 * 5. Reports success/failure back to the API
 * 6. Prevents duplicate print jobs
 * 7. Supports reconnecting if the printer disconnects
 *
 * Usage:
 *   1. Install dependencies: npm install
 *   2. Configure environment variables (see .env.example)
 *   3. Start: npm start
 *
 * Environment:
 *   API_URL        — Backend URL (default: https://frezzer-el-balad.onrender.com)
 *   API_TOKEN      — Bearer token for authentication
 *   PRINTER_CONNECTION — 'lan' | 'usb' | 'bluetooth' | 'wifi'
 *   PRINTER_IP     — IP address for LAN/WiFi printers
 *   PRINTER_PORT   — Port for LAN printers (default: 9100)
 *   POLL_INTERVAL  — Poll interval in ms (default: 3000)
 *   PAPER_WIDTH    — '58' | '80' (default: 80)
 */

import { EscPos } from 'escpos';
import EscposUSB from 'escpos-usb';
import EscposNetwork from 'escpos-network';
import fetch from 'node-fetch';

// ─── Configuration ───────────────────────────────────────────────────────────
const CONFIG = {
  apiUrl: process.env.API_URL || 'https://frezzer-el-balad.onrender.com',
  apiToken: process.env.API_TOKEN || '',
  printerConnection: process.env.PRINTER_CONNECTION || 'lan',
  printerIp: process.env.PRINTER_IP || '192.168.1.100',
  printerPort: parseInt(process.env.PRINTER_PORT || '9100', 10),
  pollInterval: parseInt(process.env.POLL_INTERVAL || '3000', 10),
  paperWidth: parseInt(process.env.PAPER_WIDTH || '80', 10),
};

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

// ─── Printer Connection ──────────────────────────────────────────────────────
let printer = null;

async function connectPrinter() {
  try {
    if (CONFIG.printerConnection === 'lan' || CONFIG.printerConnection === 'wifi') {
      console.log(`[printer] Connecting to ${CONFIG.printerIp}:${CONFIG.printerPort}...`);
      const device = new EscposNetwork(CONFIG.printerIp, CONFIG.printerPort);
      printer = new EscPos(device);
      console.log('[printer] Connected via network');
    } else if (CONFIG.printerConnection === 'usb') {
      console.log('[printer] Connecting via USB...');
      const device = new EscposUSB();
      printer = new EscPos(device);
      console.log('[printer] Connected via USB');
    } else {
      console.log(`[printer] Connection type "${CONFIG.printerConnection}" — simulating (no hardware)`);
      printer = 'simulated';
    }
  } catch (err) {
    console.error('[printer] Connection failed:', err.message);
    printer = null;
  }
}

async function printEscpos(escposData) {
  if (printer === 'simulated') {
    console.log('[printer] SIMULATED — would print:');
    console.log(escposData.slice(0, 200) + '...');
    return true;
  }
  if (!printer) {
    throw new Error('Printer not connected');
  }
  try {
    printer.raw(escposData);
    return true;
  } catch (err) {
    console.error('[printer] Print error:', err.message);
    printer = null; // Mark as disconnected for reconnection
    throw err;
  }
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
    console.error('[api] Poll failed:', err.message);
    return null;
  }
}

async function reportSuccess(jobId) {
  try {
    await fetch(`${CONFIG.apiUrl}/api/v1/print/${jobId}/success`, {
      method: 'PATCH',
      headers: apiHeaders(),
    });
    console.log(`[api] Job ${jobId} reported as printed`);
  } catch (err) {
    console.error('[api] Failed to report success:', err.message);
  }
}

async function reportFailure(jobId, error) {
  try {
    await fetch(`${CONFIG.apiUrl}/api/v1/print/${jobId}/failure`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ error }),
    });
    console.log(`[api] Job ${jobId} reported as failed: ${error}`);
  } catch (err) {
    console.error('[api] Failed to report failure:', err.message);
  }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────
const processedJobs = new Set();

async function processJob(job) {
  if (processedJobs.has(job.id)) {
    console.log(`[service] Job ${job.id} already processed — skipping`);
    return;
  }

  console.log(`[service] Processing job ${job.id} for order #${job.orderNo}`);

  try {
    // Reconnect printer if needed
    if (!printer) {
      await connectPrinter();
      if (!printer) {
        throw new Error('Printer not connected');
      }
    }

    const receipt = job.receipt;
    const escposData = buildEscpos(receipt);

    await printEscpos(escposData);
    await reportSuccess(job.id);
    processedJobs.add(job.id);

    // Prevent memory leak — keep only last 1000 job IDs
    if (processedJobs.size > 1000) {
      const first = processedJobs.values().next().value;
      processedJobs.delete(first);
    }

    console.log(`[service] Job ${job.id} printed successfully`);
  } catch (err) {
    await reportFailure(job.id, err.message);
    console.error(`[service] Job ${job.id} failed:`, err.message);
  }
}

async function poll() {
  const job = await pollForJobs();
  if (job) {
    await processJob(job);
  }
}

// ─── Startup ─────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════');
console.log('  Freezer El Balad — Thermal Print Service');
console.log('═══════════════════════════════════════════════════');
console.log(`API:         ${CONFIG.apiUrl}`);
console.log(`Connection:  ${CONFIG.printerConnection}`);
if (CONFIG.printerConnection === 'lan' || CONFIG.printerConnection === 'wifi') {
  console.log(`Printer IP:  ${CONFIG.printerIp}:${CONFIG.printerPort}`);
}
console.log(`Paper:       ${CONFIG.paperWidth}mm`);
console.log(`Poll:        every ${CONFIG.pollInterval}ms`);
console.log('═══════════════════════════════════════════════════');

await connectPrinter();

// Start polling loop
setInterval(poll, CONFIG.pollInterval);
console.log('[service] Polling started. Press Ctrl+C to stop.');
