/**
 * Order PDF Export
 *
 * Generates a professional A4 PDF document from order data.
 * Supports Arabic and English text.
 * Uses historical order data (prices from when the order was placed).
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order } from '@/types';

// Status labels
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

/** Render Arabic text to a canvas and return as data URL. */
function renderArabicToImage(text: string, fontSize = 14, maxWidth = 500): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  ctx.font = `${fontSize}px "Cairo", "Noto Sans Arabic", "Arial", sans-serif`;
  const metrics = ctx.measureText(text);
  const textWidth = Math.min(metrics.width + 10, maxWidth);

  canvas.width = Math.ceil(textWidth);
  canvas.height = Math.ceil(fontSize * 1.6);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fontSize}px "Cairo", "Noto Sans Arabic", "Arial", sans-serif`;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 5, canvas.height / 2);

  return canvas.toDataURL('image/png');
}

/** Format date for PDF. */
function fmtDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Format price. */
function fmtPrice(n: number): string {
  return `${Math.round(n).toLocaleString()} EGP`;
}

/** Get the label for a status. */
function statusLabel(status: string, lang: string): string {
  const labels = STATUS_LABELS[status];
  if (!labels) return status;
  return lang === 'ar' ? labels.ar : labels.en;
}

/** Get the label for a payment method. */
function paymentLabel(method: string, lang: string): string {
  const labels = PAYMENT_METHODS[method];
  if (!labels) return method;
  return lang === 'ar' ? labels.ar : labels.en;
}

/**
 * Generate and download a PDF for an order.
 */
export function generateOrderPdf(order: Order, lang: string = 'ar'): void {
  const isAr = lang === 'ar';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper: add text line
  const addText = (text: string, fontSize: number, isBold = false, align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    if (align === 'center') {
      doc.text(text, pageWidth / 2, y, { align: 'center' });
    } else if (align === 'right') {
      doc.text(text, pageWidth - margin, y, { align: 'right' });
    } else {
      doc.text(text, margin, y);
    }
    y += fontSize * 0.5;
  };

  // Helper: add Arabic text as image
  const addArabicText = (text: string, fontSize: number, align: 'left' | 'center' | 'right' = 'left') => {
    if (!text) return;
    const dataUrl = renderArabicToImage(text, fontSize * 2, contentWidth);
    const imgWidth = Math.min(contentWidth, 120);
    const imgHeight = imgWidth * 0.15;
    let x = margin;
    if (align === 'center') x = (pageWidth - imgWidth) / 2;
    else if (align === 'right') x = pageWidth - margin - imgWidth;
    doc.addImage(dataUrl, 'PNG', x, y - imgHeight + 2, imgWidth, imgHeight);
    y += fontSize * 0.5 + 2;
  };

  // Helper: draw a line
  const drawLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;
  };

  // Helper: check page break
  const checkPageBreak = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Header: Store branding ──
  const storeName = isAr ? 'فريزر البلد' : 'Freezer Elbalad';
  if (isAr) {
    addArabicText(storeName, 22, 'center');
  } else {
    addText(storeName, 22, true, 'center');
  }

  const subtitle = isAr ? 'لحوم وفراخ ومجمدات' : 'Meat, Chicken & Frozen Products';
  if (isAr) {
    addArabicText(subtitle, 12, 'center');
  } else {
    addText(subtitle, 12, false, 'center');
  }

  y += 2;
  drawLine();

  // ── Order title ──
  const orderTitle = isAr ? `طلب رقم #${order.orderNo}` : `Order #${order.orderNo}`;
  if (isAr) {
    addArabicText(orderTitle, 16, 'center');
  } else {
    addText(orderTitle, 16, true, 'center');
  }
  y += 2;

  // ── Order info ──
  const dateLabel = isAr ? 'التاريخ' : 'Date';
  const statusLbl = isAr ? 'الحالة' : 'Status';
  const paymentLbl = isAr ? 'طريقة الدفع' : 'Payment';

  addText(`${dateLabel}: ${fmtDate(order.createdAt, lang)}`, 10);
  if (isAr) {
    addArabicText(`${statusLbl}: ${statusLabel(order.status, lang)}`, 10);
  } else {
    addText(`${statusLbl}: ${statusLabel(order.status, lang)}`, 10);
  }
  if (order.payment) {
    if (isAr) {
      addArabicText(`${paymentLbl}: ${paymentLabel(order.payment.method, lang)} (${fmtPrice(order.payment.amount)})`, 10);
    } else {
      addText(`${paymentLbl}: ${paymentLabel(order.payment.method, lang)} (${fmtPrice(order.payment.amount)})`, 10);
    }
  }

  y += 3;
  drawLine();

  // ── Customer information ──
  const customerTitle = isAr ? 'معلومات العميل' : 'Customer Information';
  if (isAr) {
    addArabicText(customerTitle, 13, 'center');
  } else {
    addText(customerTitle, 13, true, 'center');
  }
  y += 2;

  const nameLabel = isAr ? 'الاسم' : 'Name';
  const phoneLabel = isAr ? 'الهاتف' : 'Phone';
  const cityLabel = isAr ? 'المدينة' : 'City';
  const streetLabel = isAr ? 'الشارع' : 'Street';
  const buildingLabel = isAr ? 'المبنى' : 'Building';

  if (order.customerName) {
    if (isAr) {
      addArabicText(`${nameLabel}: ${order.customerName}`, 10);
    } else {
      addText(`${nameLabel}: ${order.customerName}`, 10);
    }
  }
  if (order.phone) {
    addText(`${phoneLabel}: ${order.phone}`, 10);
  }
  if (order.deliveryAddress) {
    const addr = order.deliveryAddress;
    if (addr.city) {
      if (isAr) {
        addArabicText(`${cityLabel}: ${addr.city}`, 10);
      } else {
        addText(`${cityLabel}: ${addr.city}`, 10);
      }
    }
    if (addr.street) {
      if (isAr) {
        addArabicText(`${streetLabel}: ${addr.street}`, 10);
      } else {
        addText(`${streetLabel}: ${addr.street}`, 10);
      }
    }
    if (addr.building) {
      if (isAr) {
        addArabicText(`${buildingLabel}: ${addr.building}`, 10);
      } else {
        addText(`${buildingLabel}: ${addr.building}`, 10);
      }
    }
  }

  y += 3;
  drawLine();

  // ── Order items table ──
  const itemsTitle = isAr ? 'المنتجات' : 'Order Items';
  if (isAr) {
    addArabicText(itemsTitle, 13, 'center');
  } else {
    addText(itemsTitle, 13, true, 'center');
  }
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
    return [name, variant, qty, unitPrice, lineTotal];
  });

  autoTable(doc, {
    startY: y,
    head: [[productHeader, variantHeader, qtyHeader, unitPriceHeader, totalHeader]],
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      halign: 'center',
      font: 'helvetica',
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
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    if (color) doc.setTextColor(...color);
    if (isAr) {
      // Right-aligned for Arabic
      doc.text(label, pageWidth - margin, y, { align: 'right' });
      doc.text(value, margin, y);
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
    if (isAr) {
      addArabicText(`${notesLabel}:`, 11);
      addArabicText(order.notes, 10);
    } else {
      addText(`${notesLabel}:`, 11, true);
      addText(order.notes, 10);
    }
    y += 3;
  }

  // ── Footer ──
  checkPageBreak(15);
  drawLine();
  const footerText = isAr ? 'شكراً لتسوقكم من فريزر البلد' : 'Thank you for shopping with Freezer Elbalad!';
  if (isAr) {
    addArabicText(footerText, 10, 'center');
  } else {
    addText(footerText, 10, false, 'center');
  }
  const generatedLabel = isAr ? 'تم الإنشاء' : 'Generated';
  addText(`${generatedLabel}: ${fmtDate(new Date().toISOString(), lang)}`, 8, false, 'center');

  // ── Save PDF ──
  const fileName = `Freezer-Elbalad-Order-${order.orderNo}.pdf`;
  doc.save(fileName);
}

/**
 * Generate a PDF and return as data URL (for preview).
 */
export function generateOrderPdfDataUrl(order: Order, lang: string = 'ar'): string {
  const isAr = lang === 'ar';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addText = (text: string, fontSize: number, isBold = false, align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    if (align === 'center') doc.text(text, pageWidth / 2, y, { align: 'center' });
    else if (align === 'right') doc.text(text, pageWidth - margin, y, { align: 'right' });
    else doc.text(text, margin, y);
    y += fontSize * 0.5;
  };

  const addArabicText = (text: string, fontSize: number, align: 'left' | 'center' | 'right' = 'left') => {
    if (!text) return;
    const dataUrl = renderArabicToImage(text, fontSize * 2, contentWidth);
    const imgWidth = Math.min(contentWidth, 120);
    const imgHeight = imgWidth * 0.15;
    let x = margin;
    if (align === 'center') x = (pageWidth - imgWidth) / 2;
    else if (align === 'right') x = pageWidth - margin - imgWidth;
    doc.addImage(dataUrl, 'PNG', x, y - imgHeight + 2, imgWidth, imgHeight);
    y += fontSize * 0.5 + 2;
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

  // ── Header ──
  const storeName = isAr ? 'فريزر البلد' : 'Freezer Elbalad';
  if (isAr) addArabicText(storeName, 22, 'center');
  else addText(storeName, 22, true, 'center');

  const subtitle = isAr ? 'لحوم وفراخ ومجمدات' : 'Meat, Chicken & Frozen Products';
  if (isAr) addArabicText(subtitle, 12, 'center');
  else addText(subtitle, 12, false, 'center');

  y += 2;
  drawLine();

  // ── Order title ──
  const orderTitle = isAr ? `طلب رقم #${order.orderNo}` : `Order #${order.orderNo}`;
  if (isAr) addArabicText(orderTitle, 16, 'center');
  else addText(orderTitle, 16, true, 'center');
  y += 2;

  // ── Order info ──
  addText(`${isAr ? 'التاريخ' : 'Date'}: ${fmtDate(order.createdAt, lang)}`, 10);
  if (isAr) addArabicText(`${isAr ? 'الحالة' : 'Status'}: ${statusLabel(order.status, lang)}`, 10);
  else addText(`${isAr ? 'الحالة' : 'Status'}: ${statusLabel(order.status, lang)}`, 10);
  if (order.payment) {
    if (isAr) addArabicText(`${isAr ? 'طريقة الدفع' : 'Payment'}: ${paymentLabel(order.payment.method, lang)} (${fmtPrice(order.payment.amount)})`, 10);
    else addText(`${isAr ? 'طريقة الدفع' : 'Payment'}: ${paymentLabel(order.payment.method, lang)} (${fmtPrice(order.payment.amount)})`, 10);
  }

  y += 3;
  drawLine();

  // ── Customer info ──
  const customerTitle = isAr ? 'معلومات العميل' : 'Customer Information';
  if (isAr) addArabicText(customerTitle, 13, 'center');
  else addText(customerTitle, 13, true, 'center');
  y += 2;

  if (order.customerName) {
    if (isAr) addArabicText(`${isAr ? 'الاسم' : 'Name'}: ${order.customerName}`, 10);
    else addText(`${isAr ? 'الاسم' : 'Name'}: ${order.customerName}`, 10);
  }
  if (order.phone) addText(`${isAr ? 'الهاتف' : 'Phone'}: ${order.phone}`, 10);
  if (order.deliveryAddress) {
    const addr = order.deliveryAddress;
    if (addr.city) {
      if (isAr) addArabicText(`${isAr ? 'المدينة' : 'City'}: ${addr.city}`, 10);
      else addText(`${isAr ? 'المدينة' : 'City'}: ${addr.city}`, 10);
    }
    if (addr.street) {
      if (isAr) addArabicText(`${isAr ? 'الشارع' : 'Street'}: ${addr.street}`, 10);
      else addText(`${isAr ? 'الشارع' : 'Street'}: ${addr.street}`, 10);
    }
    if (addr.building) {
      if (isAr) addArabicText(`${isAr ? 'المبنى' : 'Building'}: ${addr.building}`, 10);
      else addText(`${isAr ? 'المبنى' : 'Building'}: ${addr.building}`, 10);
    }
  }

  y += 3;
  drawLine();

  // ── Items ──
  const itemsTitle = isAr ? 'المنتجات' : 'Order Items';
  if (isAr) addArabicText(itemsTitle, 13, 'center');
  else addText(itemsTitle, 13, true, 'center');
  y += 2;

  const tableBody = order.items.map((item) => {
    const name = isAr ? item.name : (item.nameEn ?? item.name);
    return [name, item.size || '—', String(item.qty), fmtPrice(item.unitPrice), fmtPrice(item.lineTotal)];
  });

  autoTable(doc, {
    startY: y,
    head: [[isAr ? 'المنتج' : 'Product', isAr ? 'النوع' : 'Variant', isAr ? 'الكمية' : 'Qty', isAr ? 'سعر الوحدة' : 'Unit Price', isAr ? 'الإجمالي' : 'Total']],
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3, halign: 'center', font: 'helvetica' },
    headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [245, 245, 250] },
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
  const addTotalLine = (label: string, value: string, bold = false, color?: [number, number, number]) => {
    checkPageBreak(8);
    doc.setFontSize(10);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    if (color) doc.setTextColor(...color);
    if (isAr) {
      doc.text(label, pageWidth - margin, y, { align: 'right' });
      doc.text(value, margin, y);
    } else {
      doc.text(label, margin, y);
      doc.text(value, pageWidth - margin, y, { align: 'right' });
    }
    doc.setTextColor(0, 0, 0);
    y += 5;
  };

  addTotalLine(isAr ? 'المجموع الفرعي' : 'Subtotal', fmtPrice(order.subtotal));
  addTotalLine(isAr ? 'التوصيل' : 'Delivery', order.deliveryFee > 0 ? fmtPrice(order.deliveryFee) : (isAr ? 'مجاني' : 'FREE'));
  if (order.discount > 0) addTotalLine(isAr ? 'الخصم' : 'Discount', `-${fmtPrice(order.discount)}`, false, [220, 50, 50]);

  y += 1;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  addTotalLine(isAr ? 'الإجمالي' : 'Total', fmtPrice(order.total), true);

  y += 5;
  drawLine();

  if (order.notes) {
    checkPageBreak(15);
    if (isAr) { addArabicText(`${isAr ? 'ملاحظات' : 'Notes'}:`, 11); addArabicText(order.notes, 10); }
    else { addText(`${isAr ? 'ملاحظات' : 'Notes'}:`, 11, true); addText(order.notes, 10); }
    y += 3;
  }

  checkPageBreak(15);
  drawLine();
  if (isAr) addArabicText('شكراً لتسوقكم من فريزر البلد!', 10, 'center');
  else addText('Thank you for shopping with Freezer Elbalad!', 10, false, 'center');
  addText(`${isAr ? 'تم الإنشاء' : 'Generated'}: ${fmtDate(new Date().toISOString(), lang)}`, 8, false, 'center');

  return doc.output('datauristring');
}
