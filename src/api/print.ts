import { api, unwrap } from '@/lib/api';
import type { ApiEnvelope } from '@/types';

export interface PrintJob {
  id: string;
  orderId: string;
  orderNo: string;
  status: 'pending' | 'printing' | 'printed' | 'failed';
  receipt: Record<string, unknown>;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface PrinterConfig {
  name: string;
  type: string;
  paperWidth: '58' | '80';
  connection: 'usb' | 'lan' | 'bluetooth' | 'wifi';
  ipAddress: string;
  port: string;
  isActive: boolean;
}

export const createPrintJob = (orderId: string, receipt: Record<string, unknown>): Promise<PrintJob> =>
  unwrap(api.post<ApiEnvelope<PrintJob>>('/print', { orderId, receipt }));

export const createTestPrintJob = (receipt: Record<string, unknown>): Promise<PrintJob> =>
  unwrap(api.post<ApiEnvelope<PrintJob>>('/print/test', { receipt }));

export const getOrderPrintJobs = (orderId: string): Promise<PrintJob[]> =>
  unwrap(api.get<ApiEnvelope<PrintJob[]>>(`/print/order/${orderId}`));

export const listRecentPrintJobs = (): Promise<PrintJob[]> =>
  unwrap(api.get<ApiEnvelope<PrintJob[]>>('/print/recent'));

export const markOrderPrinted = (orderId: string): Promise<{ printedAt: string }> =>
  unwrap(api.post<ApiEnvelope<{ printedAt: string }>>(`/print/order/${orderId}/mark`));

export const retryPrintJob = (jobId: string): Promise<null> =>
  unwrap(api.post<ApiEnvelope<null>>(`/print/${jobId}/retry`));

// Printer config is stored in settings
export const getPrinterConfig = (): Promise<PrinterConfig | null> =>
  unwrap(api.get<ApiEnvelope<PrinterConfig | null>>('/settings/public'));

export const savePrinterConfig = (config: PrinterConfig): Promise<PrinterConfig> =>
  unwrap(api.patch<ApiEnvelope<PrinterConfig>>('/settings', { printerConfig: config }));

// Service tokens for the local print service
export interface ServiceToken {
  id: string;
  name: string;
  scope: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface GeneratedToken extends ServiceToken {
  rawToken: string;
}

export const generateServiceToken = (name: string): Promise<GeneratedToken> =>
  unwrap(api.post<ApiEnvelope<GeneratedToken>>('/service-tokens', { name, scope: ['print'] }));

export const listServiceTokens = (): Promise<ServiceToken[]> =>
  unwrap(api.get<ApiEnvelope<ServiceToken[]>>('/service-tokens'));

export const revokeServiceToken = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/service-tokens/${id}`));
