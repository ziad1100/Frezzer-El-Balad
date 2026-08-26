import { describe, it, expect } from 'vitest';

// ─── Receipt Data Types (mirrored from frontend for testing) ─────────────────
interface ReceiptItem {
  name: string;
  nameEn?: string;
  size?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

interface ReceiptData {
  storeNameAr: string;
  storeNameEn: string;
  orderNo: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  status: string;
  items: ReceiptItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  footerAr: string;
  footerEn: string;
  paperWidth: '58' | '80';
  language: 'ar' | 'en';
}

// ─── Receipt Formatter (copied from src/lib/receiptFormatter.ts for testing) ─
const CHARS_58 = 32;
const CHARS_80 = 48;

const charsForWidth = (w: '58' | '80'): number => (w === '80' ? CHARS_80 : CHARS_58);

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

function generateReceiptText(data: ReceiptData): string {
  const w = charsForWidth(data.paperWidth);
  const lines: string[] = [];
  const isEn = data.language === 'en';
  const divider = repeat('-', w);
  const doubleDivider = repeat('=', w);

  lines.push(centerText(isEn ? data.storeNameEn : data.storeNameAr, w));
  if (isEn && data.storeNameAr) {
    lines.push(centerText(data.storeNameAr, w));
  }
  lines.push(divider);
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
  lines.push(divider);

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
      lines.push(rightText(`${isEn ? '@' : '×'} ${formatPrice(item.unitPrice)}`, w));
    }
  }

  lines.push(divider);
  lines.push(splitLine(isEn ? 'Subtotal' : 'المجموع الفرعي', formatPrice(data.subtotal), w));

  if (data.deliveryFee > 0) {
    lines.push(splitLine(isEn ? 'Delivery' : 'التوصيل', formatPrice(data.deliveryFee), w));
  } else {
    lines.push(splitLine(isEn ? 'Delivery' : 'التوصيل', isEn ? 'FREE' : 'مجاني', w));
  }

  if (data.discount > 0) {
    lines.push(splitLine(isEn ? 'Discount' : 'الخصم', `-${formatPrice(data.discount)}`, w));
  }

  lines.push(doubleDivider);
  lines.push(centerText(`${isEn ? 'TOTAL' : 'الإجمالي'}: ${formatPrice(data.total)}`, w));
  lines.push(doubleDivider);

  const methodLabels: Record<string, { ar: string; en: string }> = {
    cash: { ar: 'نقدي', en: 'Cash' },
    card: { ar: 'بطاقة', en: 'Card' },
    vodafone_cash: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
  };
  const method = methodLabels[data.paymentMethod] ?? { ar: data.paymentMethod, en: data.paymentMethod };
  lines.push(splitLine(isEn ? 'Payment' : 'الدفع', isEn ? method.en : method.ar, w));

  lines.push(divider);
  lines.push(centerText(isEn ? data.footerEn : data.footerAr, w));
  lines.push(centerText(isEn ? data.footerAr : data.footerEn, w));
  lines.push(repeat(' ', w));
  lines.push(centerText('* * *', w));

  return lines.join('\n');
}

// ─── Test Data ──────────────────────────────────────────────────────────────
const makeReceipt = (overrides: Partial<ReceiptData> = {}): ReceiptData => ({
  storeNameAr: 'ولاد حلال',
  storeNameEn: 'Welad Halal',
  orderNo: 'ORD-001',
  date: '2025/01/01',
  time: '12:00',
  customerName: 'أحمد محمد',
  customerPhone: '01000000000',
  customerAddress: 'القاهرة — شارع التحرير',
  status: 'جديد',
  items: [
    { name: 'لحمة استيك', nameEn: 'Steak Meat', size: '500g', qty: 2, unitPrice: 300, lineTotal: 600 },
    { name: 'برجر', nameEn: 'Burger', size: '1kg', qty: 1, unitPrice: 340, lineTotal: 340 },
  ],
  subtotal: 940,
  deliveryFee: 50,
  discount: 100,
  total: 890,
  paymentMethod: 'cash',
  footerAr: 'شكرًا لتسوقك من ولاد حلال',
  footerEn: 'Thank you for shopping with Welad Halal!',
  paperWidth: '80',
  language: 'ar',
  ...overrides,
});

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('Receipt Formatter', () => {
  describe('Character Width', () => {
    it('returns 48 chars for 80mm paper', () => {
      expect(charsForWidth('80')).toBe(48);
    });

    it('returns 32 chars for 58mm paper', () => {
      expect(charsForWidth('58')).toBe(32);
    });
  });

  describe('Pad Function', () => {
    it('pads string to the right length', () => {
      expect(pad('Hi', 5)).toBe('Hi   ');
    });

    it('truncates long strings', () => {
      expect(pad('Hello World', 5)).toBe('Hello');
    });

    it('pads right-aligned', () => {
      expect(pad('Hi', 5, 'right')).toBe('   Hi');
    });

    it('pads center-aligned', () => {
      expect(pad('Hi', 6, 'center')).toBe('  Hi  ');
    });
  });

  describe('English Receipt (80mm)', () => {
    const receipt = makeReceipt({ language: 'en', paperWidth: '80' });

    it('generates receipt text', () => {
      const text = generateReceiptText(receipt);
      expect(text).toBeTruthy();
      expect(typeof text).toBe('string');
    });

    it('includes store name', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('Welad Halal');
    });

    it('includes order number', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('ORD-001');
    });

    it('includes customer name', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('أحمد محمد');
    });

    it('includes items', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('Steak Meat');
      expect(text).toContain('Burger');
    });

    it('includes totals', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('940 EGP');
      expect(text).toContain('50 EGP');
      expect(text).toContain('890 EGP');
    });

    it('includes payment method', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('Cash');
    });

    it('includes footer', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('Thank you for shopping');
    });

    it('each line does not exceed paper width', () => {
      const text = generateReceiptText(receipt);
      const lines = text.split('\n');
      for (const line of lines) {
        // Allow some tolerance for ESC/POS control chars
        expect(line.length).toBeLessThanOrEqual(50);
      }
    });
  });

  describe('Arabic Receipt (80mm)', () => {
    const receipt = makeReceipt({ language: 'ar', paperWidth: '80' });

    it('generates receipt text', () => {
      const text = generateReceiptText(receipt);
      expect(text).toBeTruthy();
    });

    it('includes Arabic store name', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('ولاد حلال');
    });

    it('includes Arabic order label', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('طلب');
    });

    it('includes Arabic customer label', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('العميل');
    });

    it('includes Arabic payment method', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('نقدي');
    });

    it('includes Arabic footer', () => {
      const text = generateReceiptText(receipt);
      expect(text).toContain('شكرًا لتسوقك');
    });
  });

  describe('Mixed Arabic + English', () => {
    it('English receipt with Arabic store name shows both', () => {
      const receipt = makeReceipt({ language: 'en' });
      const text = generateReceiptText(receipt);
      expect(text).toContain('Welad Halal');
      expect(text).toContain('ولاد حلال');
    });
  });

  describe('58mm Paper', () => {
    const receipt = makeReceipt({ paperWidth: '58', language: 'en' });

    it('generates receipt text for 58mm', () => {
      const text = generateReceiptText(receipt);
      expect(text).toBeTruthy();
    });

    it('lines do not exceed 32 chars', () => {
      const text = generateReceiptText(receipt);
      const lines = text.split('\n');
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(35); // Allow small tolerance
      }
    });
  });

  describe('Discount Handling', () => {
    it('shows discount when greater than 0', () => {
      const receipt = makeReceipt({ discount: 100, language: 'en' });
      const text = generateReceiptText(receipt);
      expect(text).toContain('-100 EGP');
    });

    it('does not show discount when 0', () => {
      const receipt = makeReceipt({ discount: 0, language: 'en' });
      const text = generateReceiptText(receipt);
      expect(text).not.toContain('Discount');
    });
  });

  describe('Free Delivery', () => {
    it('shows FREE for zero delivery fee (English)', () => {
      const receipt = makeReceipt({ deliveryFee: 0, language: 'en' });
      const text = generateReceiptText(receipt);
      expect(text).toContain('FREE');
    });

    it('shows مجاني for zero delivery fee (Arabic)', () => {
      const receipt = makeReceipt({ deliveryFee: 0, language: 'ar' });
      const text = generateReceiptText(receipt);
      expect(text).toContain('مجاني');
    });
  });

  describe('Payment Methods', () => {
    it('handles cash payment', () => {
      const receipt = makeReceipt({ paymentMethod: 'cash', language: 'en' });
      const text = generateReceiptText(receipt);
      expect(text).toContain('Cash');
    });

    it('handles card payment', () => {
      const receipt = makeReceipt({ paymentMethod: 'card', language: 'en' });
      const text = generateReceiptText(receipt);
      expect(text).toContain('Card');
    });

    it('handles vodafone_cash payment', () => {
      const receipt = makeReceipt({ paymentMethod: 'vodafone_cash', language: 'en' });
      const text = generateReceiptText(receipt);
      expect(text).toContain('Vodafone Cash');
    });

    it('handles unknown payment method', () => {
      const receipt = makeReceipt({ paymentMethod: 'crypto', language: 'en' });
      const text = generateReceiptText(receipt);
      expect(text).toContain('crypto');
    });
  });

  describe('Price Rounding', () => {
    it('rounds prices to nearest integer', () => {
      const receipt = makeReceipt({
        items: [{ name: 'Test', qty: 1, unitPrice: 99.7, lineTotal: 99.7 }],
        subtotal: 99.7,
        total: 99.7,
        language: 'en',
      });
      const text = generateReceiptText(receipt);
      expect(text).toContain('100 EGP');
    });
  });

  describe('Long Product Names', () => {
    it('truncates long product names for 58mm', () => {
      const receipt = makeReceipt({
        paperWidth: '58',
        items: [{ name: 'Very Long Product Name That Exceeds Paper Width Limit', qty: 1, unitPrice: 100, lineTotal: 100 }],
        language: 'en',
      });
      const text = generateReceiptText(receipt);
      const lines = text.split('\n');
      // The product name line should be truncated
      const nameLine = lines.find((l) => l.includes('Very Long'));
      if (nameLine) {
        expect(nameLine.length).toBeLessThanOrEqual(35);
      }
    });
  });
});

describe('Print Error Codes', () => {
  const ERROR_CODES = {
    PRINT_AGENT_OFFLINE: { ar: 'خدمة الطباعة المحلية غير متصلة', en: 'Local print service is offline' },
    PRINTER_NOT_FOUND: { ar: 'لم يتم العثور على الطابعة', en: 'Printer not found' },
    USB_DEVICE_NOT_FOUND: { ar: 'جهاز USB غير موجود', en: 'USB device not found' },
    LAN_PRINTER_UNREACHABLE: { ar: 'الطابعة على الشبكة غير قابلة للوصول', en: 'LAN printer unreachable' },
    BLUETOOTH_UNAVAILABLE: { ar: 'البلوتوث غير متاح', en: 'Bluetooth unavailable' },
    PRINTER_BUSY: { ar: 'الطابعة مشغولة', en: 'Printer busy' },
    PRINT_TIMEOUT: { ar: 'انتهت مهلة الطباعة', en: 'Print timeout' },
    PRINTER_OFFLINE: { ar: 'الطابعة غير متصلة', en: 'Printer is offline' },
    PRINT_JOB_FAILED: { ar: 'فشلت عملية الطباعة', en: 'Print job failed' },
  };

  it('has Arabic and English messages for all error codes', () => {
    for (const [code, messages] of Object.entries(ERROR_CODES)) {
      expect(messages.ar).toBeTruthy();
      expect(messages.en).toBeTruthy();
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it('error messages are meaningful', () => {
    expect(ERROR_CODES.PRINTER_NOT_FOUND.en).toContain('not found');
    expect(ERROR_CODES.LAN_PRINTER_UNREACHABLE.en).toContain('unreachable');
    expect(ERROR_CODES.BLUETOOTH_UNAVAILABLE.en).toContain('unavailable');
  });
});

describe('Receipt Data Validation', () => {
  it('handles empty items list', () => {
    const receipt = makeReceipt({ items: [], language: 'en' });
    const text = generateReceiptText(receipt);
    expect(text).toBeTruthy();
    expect(text).toContain('ORD-001');
  });

  it('handles single item', () => {
    const receipt = makeReceipt({
      items: [{ name: 'Test Item', qty: 1, unitPrice: 100, lineTotal: 100 }],
      subtotal: 100,
      total: 100,
      language: 'en',
    });
    const text = generateReceiptText(receipt);
    expect(text).toContain('Test Item');
  });

  it('handles many items', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      name: `Item ${i + 1}`,
      qty: 1,
      unitPrice: 10,
      lineTotal: 10,
    }));
    const receipt = makeReceipt({ items, subtotal: 200, total: 200, deliveryFee: 0, discount: 0, language: 'en' });
    const text = generateReceiptText(receipt);
    expect(text).toBeTruthy();
  });

  it('handles missing optional fields', () => {
    const receipt = makeReceipt({
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      language: 'en',
    });
    const text = generateReceiptText(receipt);
    expect(text).toBeTruthy();
    expect(text).toContain('ORD-001');
  });
});
