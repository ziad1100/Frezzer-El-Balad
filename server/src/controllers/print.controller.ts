import type { Request, Response } from 'express';
import * as printJobsRepo from '../db/printJobs';
import * as ordersRepo from '../db/orders';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

/** Create a print job for an order. */
export const createPrintJob = asyncHandler(async (req: Request, res: Response) => {
  const { orderId, receipt, printerId, printerName, format, paperWidth, language, copies } = req.body;
  if (!orderId || !receipt) {
    throw new ApiError(400, 'orderId and receipt are required');
  }
  const order = await ordersRepo.getById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  const job = await printJobsRepo.createPrintJob({
    orderId, orderNo: order.orderNo as string, receipt,
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

/** Report print failure. */
export const reportFailure = asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const { error } = req.body;
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
    orderId, orderNo: order.orderNo as string,
    receipt: { source: 'browser', note: 'Marked as printed via browser' },
    format: 'browser',
  });
  await printJobsRepo.markPrinted(job.id);
  res.json(new ApiResponse(200, { printedAt: new Date().toISOString() }, 'Order marked as printed'));
});
