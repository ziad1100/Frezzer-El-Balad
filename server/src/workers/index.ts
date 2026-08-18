import { disconnectDb } from '../db';
import { closeQueues } from '../jobs/queue';
import { startWorkers, stopWorkers } from '../jobs/workers';

const shutdown = async (signal: string): Promise<void> => {
  console.log(`[jobs] received ${signal}, shutting down`);
  await stopWorkers();
  await closeQueues();
  await disconnectDb();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

const main = async (): Promise<void> => {
  await startWorkers();
  if (!process.env.REDIS_URL) {
    console.log('[jobs] exiting: no Redis configured');
    process.exit(0);
  }
};

void main().catch((err) => {
  console.error(`[jobs] fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});