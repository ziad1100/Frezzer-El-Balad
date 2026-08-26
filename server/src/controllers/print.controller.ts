import type { Request, Response } from 'express';
import * as printJobsRepo from '../db/printJobs';
import * as ordersRepo from '../db/orders';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

// ── Structured Error Codes ──────────────────────────────────────────────────
export const PrintErrorCode = Object.freeze({
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

// ── Agent Status Tracking ───────────────────────────────────────────────────
// In-memory store for agent status (updated by the local print agent)
const agentStatus = new Map<string, {
  connectionType: string;
  connected: boolean;
  status: string;
  paperWidth: number;
  lastSeen: string;
  ip?: string;
}>();

/** Create a print job for an order. */
export const createPrintJob = asyncHandler(async (req: Request, res: Response) => {
  const { orderId, receipt, printerId, printerName, format, paperWidth, language, copies } = req.body;
  if (!orderId || !receipt) {
    throw new ApiError(400, 'orderId and receipt are required');
  }
  const order = await ordersRepo.getById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  // Check for duplicate print protection
  if (printerId) {
    const recentJobs = await printJobsRepo.listByOrder(orderId);
    const recentDuplicate = recentJobs.find(
      (j) => j.printerId === printerId && j.status === 'printed' &&
        (Date.now() - new Date(j.createdAt).getTime()) < 60000 // Within last minute
    );
    if (recentDuplicate) {
      throw new ApiError(409, 'Duplicate print detected. Use reprint to print again.');
    }
  }

  const job = await printJobsRepo.createPrintJob({
    orderId, orderNo: (order as Record<string, unknown>).orderNo as string, receipt,
    printerId, printerName, format, paperWidth, language, copies,
  });
  res.status(201).json(new ApiResponse(201, job, 'Print job created'));
});

/** Get print jobs for an order. */
export const getOrderPrintJobs = asyncHandler(async (req: Request, res: Response) => {
  const jobs = await printJobsRepo.listByOrder(req.params.orderId);
  res.json(new ApiResponse(200, jobs));
});

/** Get recent print jobs (admin). */
export const listRecentJobs = asyncHandler(async (_req: Request, res: Response) => {
  const jobs = await printJobsRepo.listRecent(50);
  res.json(new ApiResponse(200, jobs));
});

/** Poll — local print service claims next pending job. */
export const pollJob = asyncHandler(async (_req: Request, res: Response) => {
  const job = await printJobsRepo.claimNextJob();
  if (!job) {
    res.json(new ApiResponse(200, null, 'No pending jobs'));
    return;
  }
  res.json(new ApiResponse(200, job));
});

/** Report print success. */
export const reportSuccess = asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;
  await printJobsRepo.markPrinted(jobId);
  res.json(new ApiResponse(200, null, 'Print recorded'));
});

/** Report print failure with structured error code. */
export const reportFailure = asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const { error, errorCode: _errorCode } = req.body;
  if (!error) throw new ApiError(400, 'Error message is required');
  await printJobsRepo.markFailed(jobId, String(error));
  res.json(new ApiResponse(200, null, 'Failure recorded'));
});

/** Retry a failed job. */
export const retryPrintJob = asyncHandler(async (req: Request, res: Response) => {
  await printJobsRepo.retryJob(req.params.jobId);
  res.json(new ApiResponse(200, null, 'Job queued for retry'));
});

/** Create a test print job (no order required). */
export const createTestPrintJob = asyncHandler(async (req: Request, res: Response) => {
  const { receipt, printerId, printerName } = req.body;
  if (!receipt) throw new ApiError(400, 'receipt is required');
  const job = await printJobsRepo.createTestPrintJob(receipt, printerId, printerName);
  res.status(201).json(new ApiResponse(201, job, 'Test print job created'));
});

/** Update order print metadata (manual mark as printed). */
export const markOrderPrinted = asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const order = await ordersRepo.getById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  const job = await printJobsRepo.createPrintJob({
    orderId, orderNo: (order as Record<string, unknown>).orderNo as string,
    receipt: { source: 'browser', note: 'Marked as printed via browser' },
    format: 'browser',
  });
  await printJobsRepo.markPrinted(job.id);
  res.json(new ApiResponse(200, { printedAt: new Date().toISOString() }, 'Order marked as printed'));
});

/** Update agent status — called by the local print agent periodically. */
export const updateAgentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { connectionType, connected, status: printerStatus, paperWidth, ip } = req.body;
  const agentId = req.ip || 'unknown';
  agentStatus.set(agentId, {
    connectionType: connectionType || 'unknown',
    connected: connected ?? false,
    status: printerStatus || 'unknown',
    paperWidth: paperWidth || 80,
    lastSeen: new Date().toISOString(),
    ip,
  });
  res.json(new ApiResponse(200, null, 'Agent status updated'));
});

/** Get agent status — for admin to check if print agent is online. */
export const getAgentStatus = asyncHandler(async (req: Request, res: Response) => {
  const statuses = Array.from(agentStatus.entries()).map(([id, s]) => ({
    agentId: id,
    ...s,
    isRecent: (Date.now() - new Date(s.lastSeen).getTime()) < 30000, // Within last 30s
  }));
  res.json(new ApiResponse(200, statuses));
});

/** Get print error codes — for frontend to map error codes to messages. */
export const getErrorCodes = asyncHandler(async (_req: Request, res: Response) => {
  res.json(new ApiResponse(200, PrintErrorCode));
});

// ── Printer Discovery ───────────────────────────────────────────────────────
// The local print agent exposes a /discover endpoint on its health server.
// The backend proxies discovery requests so the frontend has a single API.
// Agent URL is stored in settings as `printerAgentUrl`.

/** Discover printers via the local print agent. */
export const discoverPrinters = asyncHandler(async (req: Request, res: Response) => {
  const agentUrl = (req.query.agentUrl as string) || '';
  if (!agentUrl) {
    throw new ApiError(400, 'agentUrl query parameter is required (e.g. http://192.168.1.50:9200)');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(`${agentUrl.replace(/\/+$/, '')}/discover`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new ApiError(502, `Local print agent returned ${response.status}`);
    }

    const data = await response.json();
    res.json(new ApiResponse(200, data));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort') || message.includes('fetch')) {
      throw new ApiError(502, 'Local print agent is not reachable. Ensure it is running on the local network.');
    }
    throw err;
  }
});

/** Test a specific printer via the local print agent. */
export const testDiscoveredPrinter = asyncHandler(async (req: Request, res: Response) => {
  const { agentUrl, printerName } = req.body;
  if (!agentUrl || !printerName) {
    throw new ApiError(400, 'agentUrl and printerName are required');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(
      `${agentUrl.replace(/\/+$/, '')}/printers/${encodeURIComponent(printerName)}/test`,
      { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' } },
    );
    clearTimeout(timeout);

    const data = await response.json();
    res.json(new ApiResponse(200, data));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort') || message.includes('fetch')) {
      throw new ApiError(502, 'Local print agent is not reachable');
    }
    throw err;
  }
});
