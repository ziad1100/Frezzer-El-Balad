/**
 * Thermal Receipt Formatter — ESC/POS compatible
 *
 * Generates receipt data structured for both:
 * 1. Browser printing (HTML/CSS thermal receipt)
 * 2. Local print service (ESC/POS commands)
 *
 * Supports 58mm and 80mm paper widths.
 */

export interface ReceiptItem {
  name: string;
  nameEn?: string;
  size?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptData {
  // Header
  storeNameAr: string;
  storeNameEn: string;
  // Order info
  orderNo: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  status: string;
  // Items
  items: ReceiptItem[];
  // Totals
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  // Footer
  footerAr: string;
  footerEn: string;
  // Config
  paperWidth: '58' | '80';
  language: 'ar' | 'en';
}

// ─── Character widths ────────────────────────────────────────────────────────
// 58mm paper ≈ 32 chars per line (font A)
// 80mm paper ≈ 48 chars per line (font A)
const CHARS_58 = 32;
const CHARS_80 = 48;

const charsForWidth = (w: '58' | '80'): number => (w === '80' ? CHARS_80 : CHARS_58);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const pad = (s: string, len: number, align: 'left' | 'right' | 'center' = 'left'): string => {
  if (s.length >= len) return s.slice(0, len);
  const padLen = len - s.length;
  if (align === 'right') return ' '.repeat(padLen) + s;
  if (align === 'center') return ' '.repeat(Math.floor(padLen / 2)) + s + ' '.repeat(Math.ceil(padLen / 2));
  return s + ' '.repeat(padLen);
};

const repeat = (ch: string, len: number): string => ch.repeat(len);

const centerText = (text: string, width: number): string => pad(text, width, 'center');

const rightText = (text: string, width: number): string => pad(text, width, 'right');

const splitLine = (label: string, value: string, width: number): string => {
  const maxLabel = width - value.length - 1;
  return pad(label.slice(0, maxLabel), maxLabel) + ' ' + value;
};

const formatPrice = (n: number): string => `${Math.round(n)} EGP`;

// ─── ESC/POS Command Helpers ─────────────────────────────────────────────────
// For the local print service to use
const ESC = '\x1B';
const GS = '\x1D';

export const escpos = {
  init: `${ESC}@`,                          // Initialize printer
  bold: (on: boolean) => `${ESC}E${on ? '\x01' : '\x00'}`,
  center: () => `${ESC}a\x01`,
  left: () => `${ESC}a\x00`,
  right: () => `${ESC}a\x02`,
  cut: () => `${GS}V\x00`,                 // Full cut
  feedLines: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
  setCharSize: (w: number, h: number) => `${GS}!${String.fromCharCode((w - 1) * 16 + (h - 1))}`,
  lineHeight: (n: number) => `${ESC}3${String.fromCharCode(n)}`, // Set line spacing
};

// ─── Generate plain text receipt ─────────────────────────────────────────────
export const generateReceiptText = (data: ReceiptData): string => {
  const w = charsForWidth(data.paperWidth);
  const lines: string[] = [];

  const isEn = data.language === 'en';
  const divider = repeat('-', w);
  const doubleDivider = repeat('=', w);

  // ── Header ──
  lines.push(centerText(isEn ? data.storeNameEn : data.storeNameAr, w));
  if (isEn && data.storeNameAr) {
    lines.push(centerText(data.storeNameAr, w));
  }
  lines.push(divider);

  // ── Order info ──
  lines.push(centerText(`${isEn ? 'Order' : 'طلب'} #${data.orderNo}`, w));
  lines.push(centerText(`${data.date} ${data.time}`, w));
  lines.push(divider);

  if (data.customerName) {
    lines.push(splitLine(isEn ? 'Customer' : 'العميل', data.customerName, w));
  }
  if (data.customerPhone) {
    lines.push(splitLine(isEn ? 'Phone' : 'الهاتف', data.customerPhone, w));
  }
  if (data.customerAddress) {
    lines.push(splitLine(isEn ? 'Address' : 'العنوان', data.customerAddress, w));
  }
  if (data.status) {
    lines.push(splitLine(isEn ? 'Status' : 'الحالة', data.status, w));
  }
  lines.push(divider);

  // ── Items ──
  for (const item of data.items) {
    const itemName = isEn ? (item.nameEn || item.name) : item.name;
    const sizeLabel = item.size ? ` (${item.size})` : '';

    // Product name (may need wrapping for long names)
    const nameLine = `${item.qty}x ${itemName}${sizeLabel}`;
    if (nameLine.length > w) {
      // Wrap long product names
      lines.push(nameLine.slice(0, w));
      lines.push(rightText(formatPrice(item.lineTotal), w));
    } else {
      lines.push(splitLine(nameLine, formatPrice(item.lineTotal), w));
    }

    // Unit price
    if (item.qty > 1) {
      lines.push(rightText(`${isEn ? '@' : '×'} ${formatPrice(item.unitPrice)}`, w));
    }
  }

  lines.push(divider);

  // ── Totals ──
  lines.push(splitLine(isEn ? 'Subtotal' : 'المجموع الفرعي', formatPrice(data.subtotal), w));

  if (data.deliveryFee > 0) {
    lines.push(splitLine(isEn ? 'Delivery' : 'التوصيل', formatPrice(data.deliveryFee), w));
  } else {
    lines.push(splitLine(isEn ? 'Delivery' : 'التوصيل', isEn ? 'FREE' : 'مجاني', w));
  }

  if (data.discount > 0) {
    lines.push(splitLine(
      isEn ? 'Discount' : 'الخصم',
      `-${formatPrice(data.discount)}`,
      w,
    ));
  }

  lines.push(doubleDivider);
  lines.push(centerText(`${isEn ? 'TOTAL' : 'الإجمالي'}: ${formatPrice(data.total)}`, w));
  lines.push(doubleDivider);

  // ── Payment method ──
  const methodLabels: Record<string, { ar: string; en: string }> = {
    cash: { ar: 'نقدي', en: 'Cash' },
    card: { ar: 'بطاقة', en: 'Card' },
    vodafone_cash: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
  };
  const method = methodLabels[data.paymentMethod] ?? { ar: data.paymentMethod, en: data.paymentMethod };
  lines.push(splitLine(isEn ? 'Payment' : 'الدفع', isEn ? method.en : method.ar, w));

  // ── Footer ──
  lines.push(divider);
  lines.push(centerText(isEn ? data.footerEn : data.footerAr, w));
  lines.push(centerText(isEn ? data.footerAr : data.footerEn, w));
  lines.push(repeat(' ', w)); // blank line
  lines.push(centerText('* * *', w));

  return lines.join('\n');
};

// ─── Generate ESC/POS binary commands ────────────────────────────────────────
// For the local print service
export const generateEscposCommands = (data: ReceiptData): string => {
  const w = charsForWidth(data.paperWidth);
  const isEn = data.language === 'en';
  const lines: string[] = [];

  lines.push(escpos.init);

  // Store name — centered, bold, double height
  lines.push(escpos.setCharSize(2, 2));
  lines.push(escpos.bold(true));
  lines.push(centerText(isEn ? data.storeNameEn : data.storeNameAr, Math.floor(w / 2)));
  lines.push(escpos.bold(false));
  lines.push(escpos.setCharSize(1, 1));
  if (isEn && data.storeNameAr) {
    lines.push(centerText(data.storeNameAr, w));
  }

  lines.push(repeat('-', w));
  lines.push(centerText(`${isEn ? 'Order' : 'طلب'} #${data.orderNo}`, w));
  lines.push(centerText(`${data.date} ${data.time}`, w));
  lines.push(repeat('-', w));

  if (data.customerName) {
    lines.push(splitLine(isEn ? 'Customer' : 'العميل', data.customerName, w));
  }
  if (data.customerPhone) {
    lines.push(splitLine(isEn ? 'Phone' : 'الهاتف', data.customerPhone, w));
  }
  if (data.customerAddress) {
    lines.push(splitLine(isEn ? 'Address' : 'العنوان', data.customerAddress, w));
  }
  lines.push(repeat('-', w));

  // Items
  for (const item of data.items) {
    const itemName = isEn ? (item.nameEn || item.name) : item.name;
    const sizeLabel = item.size ? ` (${item.size})` : '';
    const nameLine = `${item.qty}x ${itemName}${sizeLabel}`;
    if (nameLine.length > w) {
      lines.push(nameLine.slice(0, w));
      lines.push(rightText(formatPrice(item.lineTotal), w));
    } else {
      lines.push(splitLine(nameLine, formatPrice(item.lineTotal), w));
    }
    if (item.qty > 1) {
      lines.push(rightText(`@ ${formatPrice(item.unitPrice)}`, w));
    }
  }

  lines.push(repeat('-', w));
  lines.push(splitLine(isEn ? 'Subtotal' : 'المجموع الفرعي', formatPrice(data.subtotal), w));
  if (data.deliveryFee > 0) {
    lines.push(splitLine(isEn ? 'Delivery' : 'التوصيل', formatPrice(data.deliveryFee), w));
  } else {
    lines.push(splitLine(isEn ? 'Delivery' : 'التوصيل', isEn ? 'FREE' : 'مجاني', w));
  }
  if (data.discount > 0) {
    lines.push(splitLine(isEn ? 'Discount' : 'الخصم', `-${formatPrice(data.discount)}`, w));
  }

  lines.push(repeat('=', w));
  lines.push(escpos.bold(true));
  lines.push(escpos.setCharSize(2, 2));
  lines.push(centerText(`${isEn ? 'TOTAL' : 'الإجمالي'}: ${formatPrice(data.total)}`, Math.floor(w / 2)));
  lines.push(escpos.setCharSize(1, 1));
  lines.push(escpos.bold(false));
  lines.push(repeat('=', w));

  const methodLabels: Record<string, { ar: string; en: string }> = {
    cash: { ar: 'نقدي', en: 'Cash' },
    card: { ar: 'بطاقة', en: 'Card' },
    vodafone_cash: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
  };
  const method = methodLabels[data.paymentMethod] ?? { ar: data.paymentMethod, en: data.paymentMethod };
  lines.push(splitLine(isEn ? 'Payment' : 'الدفع', isEn ? method.en : method.ar, w));

  lines.push(repeat('-', w));
  lines.push(centerText(isEn ? data.footerEn : data.footerAr, w));
  lines.push(centerText(isEn ? data.footerAr : data.footerEn, w));
  lines.push(' ');
  lines.push(centerText('* * *', w));

  lines.push(escpos.feedLines(3));
  lines.push(escpos.cut());

  return lines.join('\n');
};

// ─── Build receipt data from an order ────────────────────────────────────────
export const buildReceiptFromOrder = (
  order: {
    orderNo: string;
    createdAt: string;
    customerName: string;
    phone: string;
    deliveryAddress: { city?: string; street?: string; building?: string };
    status: string;
    items: Array<{
      name: string;
      nameEn?: string;
      size?: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
    payment?: { method?: string };
  },
  paperWidth: '58' | '80',
  language: 'ar' | 'en',
): ReceiptData => {
  const date = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB');
  const timeStr = date.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  const address = [
    order.deliveryAddress.city,
    order.deliveryAddress.street,
    order.deliveryAddress.building,
  ].filter(Boolean).join(' — ');

  const statusLabels: Record<string, { ar: string; en: string }> = {
    pending: { ar: 'جديد', en: 'New' },
    confirmed: { ar: 'تم التأكيد', en: 'Confirmed' },
    preparing: { ar: 'جاري التجهيز', en: 'Preparing' },
    ready_for_delivery: { ar: 'جاهز للتوصيل', en: 'Ready for Delivery' },
    on_delivery: { ar: 'في الطريق', en: 'Out for Delivery' },
    completed: { ar: 'تم التسليم', en: 'Delivered' },
    cancelled: { ar: 'ملغي', en: 'Cancelled' },
    complimentary: { ar: 'مجاني / هدية', en: 'Complimentary' },
  };

  const statusLabel = statusLabels[order.status] ?? { ar: order.status, en: order.status };

  return {
    storeNameAr: 'فريزر البلد',
    storeNameEn: 'Freezer Elbalad',
    orderNo: order.orderNo,
    date: dateStr,
    time: timeStr,
    customerName: order.customerName,
    customerPhone: order.phone,
    customerAddress: address,
    status: language === 'ar' ? statusLabel.ar : statusLabel.en,
    items: order.items,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    discount: order.discount,
    total: order.total,
    paymentMethod: order.payment?.method ?? 'cash',
    footerAr: 'شكرًا لتسوقك من فريزر البلد',
    footerEn: 'Thank you for shopping with Freezer Elbalad!',
    paperWidth,
    language,
  };
};
