/**
 * Order PDF Export
 *
 * Generates a professional A4 PDF document from order data.
 * Supports Arabic and English text with proper Unicode rendering.
 * Uses the Amiri font for Arabic text and Helvetica for English.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order } from '@/types';

// ── Arabic Font ──────────────────────────────────────────────────────────────
// Amiri is an open-source Arabic Naskh typeface that supports full
// Arabic Unicode range including shaping and ligatures.

const AMIRI_FONT_URL = '/fonts/Amiri-Regular.ttf';
const FONT_NAME = 'Amiri';
let fontLoaded = false;
let fontPromise: Promise<void> | null = null;

/** Load and register the Amiri Arabic font with jsPDF. */
async function ensureArabicFont(doc: jsPDF): Promise<void> {
  if (fontLoaded) return;
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        const res = await fetch(AMIRI_FONT_URL);
        if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        doc.addFileToVFS(AMIRI_FONT_URL, base64);
        doc.addFont(AMIRI_FONT_URL, FONT_NAME, 'normal');
        fontLoaded = true;
      } catch (err) {
        console.error('[orderPdf] Failed to load Amiri font:', err);
        // Fallback: font not loaded, Arabic will use canvas rendering
      }
    })();
  }
  await fontPromise;
}

// ── Status & payment labels ──────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending: { ar: 'جديد', en: 'New' },
  confirmed: { ar: 'تم التأكيد', en: 'Confirmed' },
  preparing: { ar: 'جاري التجهيز', en: 'Preparing' },
  ready_for_delivery: { ar: 'جاهز للتوصيل', en: 'Ready for Delivery' },
  on_delivery: { ar: 'في الطريق', en: 'Out for Delivery' },
  completed: { ar: 'تم التسليم', en: 'Delivered' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  delivery_failed: { ar: 'فشل التسليم', en: 'Delivery Failed' },
  refunded: { ar: 'مسترد', en: 'Refunded' },
  complimentary: { ar: 'مجاني / هدية', en: 'Complimentary' },
};

const PAYMENT_METHODS: Record<string, { ar: string; en: string }> = {
  cash: { ar: 'نقدي', en: 'Cash' },
  card: { ar: 'بطاقة', en: 'Card' },
  vodafone_cash: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function fmtDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function fmtPrice(n: number): string {
  return `${Math.round(n).toLocaleString()} EGP`;
}

function statusLabel(status: string, lang: string): string {
  const labels = STATUS_LABELS[status];
  if (!labels) return status;
  return lang === 'ar' ? labels.ar : labels.en;
}

function paymentLabel(method: string, lang: string): string {
  const labels = PAYMENT_METHODS[method];
  if (!labels) return method;
  return lang === 'ar' ? labels.ar : labels.en;
}

/** Reverse Arabic text for display. Arabic in PDF standard fonts
 *  needs visual reordering since jsPDF doesn't do bidi. */
function reverseArabic(text: string): string {
  // Split into segments: arabic runs and non-arabic runs
  const segments: { text: string; isAr: boolean }[] = [];
  let current = '';
  let currentIsAr = false;

  for (const ch of text) {
    const chIsAr: boolean = ARABIC_RE.test(ch) || (ch === ' ' && currentIsAr);
    if (chIsAr === currentIsAr) {
      current += ch;
    } else {
      if (current) segments.push({ text: current, isAr: currentIsAr });
      current = ch;
      currentIsAr = chIsAr;
    }
  }
  if (current) segments.push({ text: current, isAr: currentIsAr });

  // Reverse Arabic segments, keep others
  return segments
    .map((s) => (s.isAr ? [...s.text].reverse().join('') : s.text))
    .join('');
}

// ── PDF Builder ──────────────────────────────────────────────────────────────

function buildPdf(doc: jsPDF, order: Order, lang: string, hasArabicFont: boolean): void {
  const isAr = lang === 'ar';
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  /** Write text using the correct font for the language. */
  const writeText = (
    text: string,
    fontSize: number,
    opts: { bold?: boolean; align?: 'left' | 'center' | 'right' } = {},
  ) => {
    const { bold = false, align = 'left' } = opts;
    doc.setFontSize(fontSize);

    if (hasArabicFont && isAr) {
      // Use Amiri for Arabic mode
      doc.setFont(FONT_NAME, 'normal');
      // jsPDF doesn't support bidi natively — reverse Arabic runs
      const shaped = reverseArabic(text);
      if (align === 'center') {
        doc.text(shaped, pageWidth / 2, y, { align: 'center' });
      } else if (align === 'right') {
        doc.text(shaped, pageWidth - margin, y, { align: 'right' });
      } else {
        doc.text(shaped, margin, y);
      }
    } else {
      // Use Helvetica for English or when Arabic font isn't available
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      if (align === 'center') {
        doc.text(text, pageWidth / 2, y, { align: 'center' });
      } else if (align === 'right') {
        doc.text(text, pageWidth - margin, y, { align: 'right' });
      } else {
        doc.text(text, margin, y);
      }
    }
    y += fontSize * 0.5;
  };

  const drawLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Header: Store branding ──
  const storeName = isAr ? 'ولاد حلال' : 'Welad Halal';
  writeText(storeName, 22, { bold: true, align: 'center' });

  const subtitle = isAr ? 'لحوم وفراخ ومجمدات' : 'Meat, Chicken & Frozen Products';
  writeText(subtitle, 12, { align: 'center' });

  y += 2;
  drawLine();

  // ── Order title ──
  const orderTitle = isAr ? `طلب رقم #${order.orderNo}` : `Order #${order.orderNo}`;
  writeText(orderTitle, 16, { bold: true, align: 'center' });
  y += 2;

  // ── Order info ──
  const dateLabel = isAr ? 'التاريخ' : 'Date';
  writeText(`${dateLabel}: ${fmtDate(order.createdAt, lang)}`, 10);

  const statusLbl = isAr ? 'الحالة' : 'Status';
  writeText(`${statusLbl}: ${statusLabel(order.status, lang)}`, 10);

  if (order.payment) {
    const paymentLbl = isAr ? 'طريقة الدفع' : 'Payment';
    writeText(`${paymentLbl}: ${paymentLabel(order.payment.method, lang)} (${fmtPrice(order.payment.amount)})`, 10);
  }

  y += 3;
  drawLine();

  // ── Customer information ──
  const customerTitle = isAr ? 'معلومات العميل' : 'Customer Information';
  writeText(customerTitle, 13, { bold: true, align: 'center' });
  y += 2;

  const nameLabel = isAr ? 'الاسم' : 'Name';
  const phoneLabel = isAr ? 'الهاتف' : 'Phone';
  const cityLabel = isAr ? 'المدينة' : 'City';
  const streetLabel = isAr ? 'الشارع' : 'Street';
  const buildingLabel = isAr ? 'المبنى' : 'Building';

  if (order.customerName) {
    writeText(`${nameLabel}: ${order.customerName}`, 10);
  }
  if (order.phone) {
    writeText(`${phoneLabel}: ${order.phone}`, 10);
  }
  if (order.deliveryAddress) {
    const addr = order.deliveryAddress;
    if (addr.city) writeText(`${cityLabel}: ${addr.city}`, 10);
    if (addr.street) writeText(`${streetLabel}: ${addr.street}`, 10);
    if (addr.building) writeText(`${buildingLabel}: ${addr.building}`, 10);
  }

  y += 3;
  drawLine();

  // ── Order items table ──
  const itemsTitle = isAr ? 'المنتجات' : 'Order Items';
  writeText(itemsTitle, 13, { bold: true, align: 'center' });
  y += 2;

  const productHeader = isAr ? 'المنتج' : 'Product';
  const variantHeader = isAr ? 'النوع' : 'Variant';
  const qtyHeader = isAr ? 'الكمية' : 'Qty';
  const unitPriceHeader = isAr ? 'سعر الوحدة' : 'Unit Price';
  const totalHeader = isAr ? 'الإجمالي' : 'Total';

  const tableBody = order.items.map((item) => {
    const name = isAr ? item.name : (item.nameEn ?? item.name);
    const variant = item.size || '—';
    const qty = String(item.qty);
    const unitPrice = fmtPrice(item.unitPrice);
    const lineTotal = fmtPrice(item.lineTotal);
    // Reverse Arabic text in table cells for proper display
    return [
      hasArabicFont && isAr ? reverseArabic(name) : name,
      variant,
      qty,
      unitPrice,
      lineTotal,
    ];
  });

  const tableFont = hasArabicFont && isAr ? FONT_NAME : 'helvetica';

  autoTable(doc, {
    startY: y,
    head: [[productHeader, variantHeader, qtyHeader, unitPriceHeader, totalHeader]],
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      halign: 'center',
      font: tableFont,
    },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 250],
    },
    columnStyles: {
      0: { halign: isAr ? 'right' : 'left', cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 30 },
    },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // ── Totals ──
  drawLine();

  const subtotalLabel = isAr ? 'المجموع الفرعي' : 'Subtotal';
  const deliveryLabel = isAr ? 'التوصيل' : 'Delivery';
  const discountLabel = isAr ? 'الخصم' : 'Discount';
  const totalLabel = isAr ? 'الإجمالي' : 'Total';
  const freeLabel = isAr ? 'مجاني' : 'FREE';

  const addTotalLine = (label: string, value: string, isBold = false, color?: [number, number, number]) => {
    checkPageBreak(8);
    doc.setFontSize(10);
    if (hasArabicFont && isAr) {
      doc.setFont(FONT_NAME, 'normal');
    } else {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    }
    if (color) doc.setTextColor(...color);
    if (isAr) {
      // Right-aligned for Arabic
      doc.text(reverseArabic(label), pageWidth - margin, y, { align: 'right' });
      doc.text(reverseArabic(value), margin, y);
    } else {
      doc.text(label, margin, y);
      doc.text(value, pageWidth - margin, y, { align: 'right' });
    }
    doc.setTextColor(0, 0, 0);
    y += 5;
  };

  addTotalLine(subtotalLabel, fmtPrice(order.subtotal));
  addTotalLine(deliveryLabel, order.deliveryFee > 0 ? fmtPrice(order.deliveryFee) : freeLabel);
  if (order.discount > 0) {
    addTotalLine(discountLabel, `-${fmtPrice(order.discount)}`, false, [220, 50, 50]);
  }

  y += 1;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  addTotalLine(totalLabel, fmtPrice(order.total), true);

  y += 5;
  drawLine();

  // ── Notes ──
  if (order.notes) {
    checkPageBreak(15);
    const notesLabel = isAr ? 'ملاحظات' : 'Notes';
    writeText(`${notesLabel}:`, 11, { bold: true });
    writeText(order.notes, 10);
    y += 3;
  }

  // ── Footer ──
  checkPageBreak(15);
  drawLine();
  const footerText = isAr ? 'شكراً لتسوقكم من ولاد حلال' : 'Thank you for shopping with Welad Halal!';
  writeText(footerText, 10, { align: 'center' });
  const generatedLabel = isAr ? 'تم الإنشاء' : 'Generated';
  writeText(`${generatedLabel}: ${fmtDate(new Date().toISOString(), lang)}`, 8, { align: 'center' });
}

/**
 * Generate and download a PDF for an order.
 */
export async function generateOrderPdf(order: Order, lang: string = 'ar'): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  await ensureArabicFont(doc);

  buildPdf(doc, order, lang, fontLoaded);

  const fileName = `Welad-Halal-Order-${order.orderNo}.pdf`;
  doc.save(fileName);
}

/**
 * Generate a PDF and return as data URL (for preview).
 */
export async function generateOrderPdfDataUrl(order: Order, lang: string = 'ar'): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  await ensureArabicFont(doc);

  buildPdf(doc, order, lang, fontLoaded);

  return doc.output('datauristring');
}
