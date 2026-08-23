/**
 * Receipt Image Renderer
 *
 * Renders a thermal receipt as a canvas image, supporting Arabic (RTL)
 * and English text. Used when the printer does not support Arabic natively.
 *
 * The rendered image can be:
 * 1. Displayed in the print preview modal
 * 2. Sent to browser print as an <img>
 * 3. Converted to ESC/POS image commands for the local print service
 */

import type { ReceiptData } from './receiptFormatter';

// Thermal receipt dimensions at 203 DPI
// 58mm paper = 384px wide, 80mm paper = 576px wide
const PAPER_WIDTH_PX: Record<'58' | '80', number> = { '58': 384, '80': 576 };
const PADDING = 12;
const LINE_HEIGHT = 22;
const FONT_SIZE = 14;
const FONT_SIZE_LARGE = 20;
const FONT_SIZE_SMALL = 12;

/** Check if the text contains Arabic characters. */
export function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/** Render receipt data to a canvas and return the canvas element. */
export function renderReceiptToCanvas(data: ReceiptData): HTMLCanvasElement {
  const width = PAPER_WIDTH_PX[data.paperWidth];
  const isArabic = data.language === 'ar' || hasArabic(data.storeNameAr);

  // Pre-calculate lines to determine canvas height
  const lines = buildReceiptLines(data);
  const height = PADDING * 2 + lines.length * LINE_HEIGHT + 20;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  let y = PADDING;

  for (const line of lines) {
    ctx.textAlign = line.align === 'center' ? 'center' : line.align === 'right' ? 'right' : 'left';

    // Set font
    if (line.bold && line.large) {
      ctx.font = `bold ${FONT_SIZE_LARGE}px "Courier New", "Noto Sans Arabic", "Cairo", monospace`;
    } else if (line.bold) {
      ctx.font = `bold ${FONT_SIZE}px "Courier New", "Noto Sans Arabic", "Cairo", monospace`;
    } else if (line.small) {
      ctx.font = `${FONT_SIZE_SMALL}px "Courier New", "Noto Sans Arabic", "Cairo", monospace`;
    } else {
      ctx.font = `${FONT_SIZE}px "Courier New", "Noto Sans Arabic", "Cairo", monospace`;
    }

    ctx.fillStyle = line.divider ? '#888888' : '#000000';

    // Calculate x position
    let x: number;
    if (line.align === 'center') {
      x = width / 2;
    } else if (line.align === 'right') {
      x = width - PADDING;
    } else {
      x = PADDING;
    }

    // Handle multi-line text (split on \n)
    const textLines = line.text.split('\n');
    for (const tl of textLines) {
      ctx.fillText(tl, x, y + FONT_SIZE);
      y += LINE_HEIGHT;
    }
  }

  return canvas;
}

/** Convert a canvas to a PNG data URL. */
export function canvasToDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/** Convert a canvas to a Blob (for sending to the local print service). */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to convert canvas to blob'));
    }, 'image/png');
  });
}

/** Convert canvas to a monochrome bitmap array for ESC/POS image commands. */
export function canvasToEscposBitmap(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // ESC/POS images are sent as monochrome bitmaps
  // Each byte represents 8 pixels (1 = black, 0 = white)
  const bytesPerLine = Math.ceil(width / 8);
  const bitmap = new Uint8Array(bytesPerLine * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      // Convert to monochrome: threshold at 128
      const gray = (r * 0.299 + g * 0.587 + b * 0.114);
      if (gray < 128) {
        // Black pixel — set bit
        const byteIdx = y * bytesPerLine + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        bitmap[byteIdx] |= (1 << bitIdx);
      }
    }
  }

  return bitmap;
}

interface ReceiptLine {
  text: string;
  align: 'left' | 'center' | 'right';
  bold?: boolean;
  large?: boolean;
  small?: boolean;
  divider?: boolean;
}

/** Build structured receipt lines from ReceiptData. */
function buildReceiptLines(data: ReceiptData): ReceiptLine[] {
  const w = data.paperWidth === '80' ? 48 : 32;
  const isEn = data.language === 'en';
  const divider = '-'.repeat(w);
  const doubleDivider = '='.repeat(w);

  const lines: ReceiptLine[] = [];

  // Header — store name
  lines.push({ text: isEn ? data.storeNameEn : data.storeNameAr, align: 'center', bold: true, large: true });
  if (isEn && data.storeNameAr) {
    lines.push({ text: data.storeNameAr, align: 'center', small: true });
  }
  lines.push({ text: divider, align: 'center', divider: true });

  // Order info
  lines.push({ text: `${isEn ? 'Order' : 'طلب'} #${data.orderNo}`, align: 'center', bold: true });
  lines.push({ text: `${data.date} ${data.time}`, align: 'center' });
  lines.push({ text: divider, align: 'center', divider: true });

  // Customer info
  if (data.customerName) {
    lines.push({ text: `${isEn ? 'Customer' : 'العميل'}: ${data.customerName}`, align: 'left' });
  }
  if (data.customerPhone) {
    lines.push({ text: `${isEn ? 'Phone' : 'الهاتف'}: ${data.customerPhone}`, align: 'left' });
  }
  if (data.customerAddress) {
    lines.push({ text: `${isEn ? 'Address' : 'العنوان'}: ${data.customerAddress}`, align: 'left' });
  }
  if (data.status) {
    lines.push({ text: `${isEn ? 'Status' : 'الحالة'}: ${data.status}`, align: 'left' });
  }
  lines.push({ text: divider, align: 'center', divider: true });

  // Items
  for (const item of data.items) {
    const itemName = isEn ? (item.nameEn || item.name) : item.name;
    const sizeLabel = item.size ? ` (${item.size})` : '';
    const qtyLabel = `${item.qty}x`;

    // Product name line
    lines.push({ text: `${qtyLabel} ${itemName}${sizeLabel}`, align: 'left' });

    // Price line — right-aligned
    const priceStr = formatPrice(item.lineTotal);
    if (item.qty > 1) {
      lines.push({ text: `   @ ${formatPrice(item.unitPrice)}  ${priceStr}`, align: 'right' });
    } else {
      lines.push({ text: `   ${priceStr}`, align: 'right' });
    }
  }

  lines.push({ text: divider, align: 'center', divider: true });

  // Totals
  lines.push({ text: `${isEn ? 'Subtotal' : 'المجموع الفرعي'}: ${formatPrice(data.subtotal)}`, align: 'left' });

  if (data.deliveryFee > 0) {
    lines.push({ text: `${isEn ? 'Delivery' : 'التوصيل'}: ${formatPrice(data.deliveryFee)}`, align: 'left' });
  } else {
    lines.push({ text: `${isEn ? 'Delivery' : 'التوصيل'}: ${isEn ? 'FREE' : 'مجاني'}`, align: 'left' });
  }

  if (data.discount > 0) {
    lines.push({ text: `${isEn ? 'Discount' : 'الخصم'}: -${formatPrice(data.discount)}`, align: 'left' });
  }

  lines.push({ text: doubleDivider, align: 'center', divider: true });
  lines.push({
    text: `${isEn ? 'TOTAL' : 'الإجمالي'}: ${formatPrice(data.total)}`,
    align: 'center',
    bold: true,
    large: true,
  });
  lines.push({ text: doubleDivider, align: 'center', divider: true });

  // Payment
  const methodLabels: Record<string, { ar: string; en: string }> = {
    cash: { ar: 'نقدي', en: 'Cash' },
    card: { ar: 'بطاقة', en: 'Card' },
    vodafone_cash: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
  };
  const method = methodLabels[data.paymentMethod] ?? { ar: data.paymentMethod, en: data.paymentMethod };
  lines.push({ text: `${isEn ? 'Payment' : 'الدفع'}: ${isEn ? method.en : method.ar}`, align: 'left' });

  // Footer
  lines.push({ text: divider, align: 'center', divider: true });
  lines.push({ text: isEn ? data.footerEn : data.footerAr, align: 'center', small: true });
  lines.push({ text: isEn ? data.footerAr : data.footerEn, align: 'center', small: true });
  lines.push({ text: '* * *', align: 'center', small: true });

  return lines;
}

function formatPrice(n: number): string {
  return `${Math.round(n)} EGP`;
}
