import { query } from './index';

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

/** Create a print job for an order. Returns the created job. */
export const createPrintJob = async (
  orderId: string,
  orderNo: string,
  receipt: Record<string, unknown>,
): Promise<PrintJob> => {
  const rows = await query<PrintJob>(
    `INSERT INTO print_jobs ("orderId", "orderNo", receipt)
     VALUES ($1::uuid, $2, $3::jsonb)
     RETURNING *`,
    [orderId, orderNo, JSON.stringify(receipt)],
  );
  return rows[0];
};

/** Get the next pending print job (for the local print service to poll). */
export const claimNextJob = async (): Promise<PrintJob | null> => {
  const rows = await query<PrintJob>(
    `UPDATE print_jobs SET status = 'printing', "updatedAt" = now()
     WHERE id = (
       SELECT id FROM print_jobs WHERE status = 'pending'
       ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
  );
  return rows[0] ?? null;
};

/** Mark a print job as printed. */
export const markPrinted = async (jobId: string): Promise<void> => {
  await query(
    `UPDATE print_jobs SET status = 'printed', "updatedAt" = now() WHERE id = $1::uuid`,
    [jobId],
  );
  // Also update the order's print metadata
  await query(
    `UPDATE orders SET "printedAt" = now(), "printCount" = "printCount" + 1
     WHERE id = (SELECT "orderId" FROM print_jobs WHERE id = $1::uuid)`,
    [jobId],
  );
};

/** Mark a print job as failed with an error message. */
export const markFailed = async (jobId: string, error: string): Promise<void> => {
  await query(
    `UPDATE print_jobs SET status = 'failed', error = $2, attempts = attempts + 1, "updatedAt" = now()
     WHERE id = $1::uuid`,
    [jobId, error],
  );
};

/** Reset a failed job back to pending for retry. */
export const retryJob = async (jobId: string): Promise<void> => {
  await query(
    `UPDATE print_jobs SET status = 'pending', error = NULL, "updatedAt" = now()
     WHERE id = $1::uuid AND status = 'failed'`,
    [jobId],
  );
};

/** Get all print jobs for an order. */
export const listByOrder = async (orderId: string): Promise<PrintJob[]> => {
  return query<PrintJob>(
    `SELECT * FROM print_jobs WHERE "orderId" = $1::uuid ORDER BY "createdAt" DESC`,
    [orderId],
  );
};

/** Get recent print jobs (admin dashboard). */
export const listRecent = async (limit = 20): Promise<PrintJob[]> => {
  return query<PrintJob>(
    `SELECT * FROM print_jobs ORDER BY "createdAt" DESC LIMIT $1`,
    [limit],
  );
};
