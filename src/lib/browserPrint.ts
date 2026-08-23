/**
 * Browser Print Fallback
 *
 * Opens a printer-friendly receipt in a new window and triggers the browser's
 * native print dialog. Used when the local print service is unavailable.
 *
 * For Arabic text, renders the receipt as a canvas image to ensure correct
 * display on printers without native Arabic support.
 */

import type { ReceiptData } from './receiptFormatter';
import { generateReceiptText } from './receiptFormatter';
import { renderReceiptToCanvas, canvasToDataURL, hasArabic } from './receiptImage';

const RECEIPT_STYLES = `
  @page {
    size: auto;
    margin: 0;
  }
  @media print {
    body { margin: 0; padding: 0; }
    .no-print { display: none !important; }
  }
  body {
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: 14px;
    line-height: 1.3;
    white-space: pre-wrap;
    word-wrap: break-word;
    margin: 0;
    padding: 10px;
    color: #000;
    background: #fff;
  }
  .receipt {
    max-width: 300px;
    margin: 0 auto;
    padding: 10px;
  }
  .print-btn {
    display: block;
    margin: 20px auto;
    padding: 12px 24px;
    background: #1E3A5F;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
  }
  .print-btn:hover {
    background: #2a4d73;
  }
  .receipt-text {
    border: 1px dashed #ccc;
    padding: 10px;
    border-radius: 4px;
  }
`;

export const printReceipt = (data: ReceiptData): void => {
  const receiptText = generateReceiptText(data);
  const isArabic = data.language === 'ar' || hasArabic(data.storeNameAr);

  // For Arabic text, render as image for correct printer output
  let imageHtml = '';
  if (isArabic) {
    try {
      const canvas = renderReceiptToCanvas(data);
      const dataUrl = canvasToDataURL(canvas);
      imageHtml = `<img src="${dataUrl}" style="max-width:100%;display:block;margin:0 auto;" />`;
    } catch {
      // Fall back to text if canvas fails
    }
  }

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    console.warn('Popup blocked. Allowing browser print directly.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice #${data.orderNo}</title>
      <style>${RECEIPT_STYLES}</style>
    </head>
    <body>
      <div class="receipt">
        <div class="no-print">
          <button class="print-btn" onclick="window.print()">
            🖨️ ${data.language === 'ar' ? 'اطبع الفاتورة' : 'Print Invoice'}
          </button>
          ${isArabic ? `<p style="text-align:center;font-size:11px;color:#888;">${data.language === 'ar' ? 'يتم العرض كصورة لضمان الطباعة الصحيحة للعربية' : 'Rendered as image for correct Arabic printing'}</p>` : ''}
        </div>
        ${imageHtml || `<div class="receipt-text">${escapeHtml(receiptText)}</div>`}
        <div class="no-print">
          <button class="print-btn" onclick="window.print()">
            🖨️ ${data.language === 'ar' ? 'اطبع الفاتورة' : 'Print Invoice'}
          </button>
        </div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
};

/** Simpler text-only print (no UI buttons). */
export const printReceiptDirect = (data: ReceiptData): void => {
  const receiptText = generateReceiptText(data);
  const isArabic = data.language === 'ar' || hasArabic(data.storeNameAr);

  let imageHtml = '';
  if (isArabic) {
    try {
      const canvas = renderReceiptToCanvas(data);
      const dataUrl = canvasToDataURL(canvas);
      imageHtml = `<img src="${dataUrl}" style="max-width:100%;display:block;margin:0 auto;" />`;
    } catch {
      // Fall back to text
    }
  }

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice #${data.orderNo}</title>
      <style>${RECEIPT_STYLES}</style>
    </head>
    <body>
      <div class="receipt">
        ${imageHtml || `<div class="receipt-text">${escapeHtml(receiptText)}</div>`}
      </div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
