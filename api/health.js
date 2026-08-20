// Vercel serverless health endpoint — lightweight, no Express dependency.
// Checks liveness (/health) and readiness (/health/ready — DB check).
// Self-contained: imports pg directly to avoid pulling in the full Express app.
import pg from 'pg';

export const config = { maxDuration: 30 };

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
  max: 1,
});

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  const url = req.url || '';

  if (url.includes('/health/ready')) {
    const checks = { database: 'down', redis: 'disabled' };
    let ready = true;

    try {
      await pool.query('SELECT 1');
      checks.database = 'up';
    } catch {
      ready = false;
    }

    send(res, ready ? 200 : 503, {
      success: ready,
      statusCode: ready ? 200 : 503,
      message: 'OK',
      data: { status: ready ? 'ok' : 'degraded', checks },
    });
    return;
  }

  // Liveness — just confirms the function is alive
  send(res, 200, {
    success: true,
    statusCode: 200,
    message: 'OK',
    data: { status: 'ok' },
  });
}
