// Vercel serverless health endpoint — zero npm dependencies.
// Uses only Node.js built-ins to check liveness and readiness (DB probe).
// This avoids workspace-dependency resolution issues on Vercel.

import { connect } from 'node:net';
import tls from 'node:tls';

export const config = { maxDuration: 30 };

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

// Parse DATABASE_URL without any external library
function parseDbUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return { host: u.hostname, port: Number(u.port) || 5432, ssl: url.includes('sslmode=require') };
  } catch {
    return null;
  }
}

function checkDb(host, port, ssl, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    if (ssl) {
      const socket = tls.connect({ host, port, rejectUnauthorized: false, servername: host }, () => {
        socket.destroy();
        resolve({ ok: true, ms: Date.now() - start });
      });
      socket.on('error', () => resolve({ ok: false, ms: Date.now() - start }));
      socket.setTimeout(timeoutMs, () => { socket.destroy(); resolve({ ok: false, ms: Date.now() - start }); });
    } else {
      const socket = connect({ host, port }, () => {
        socket.destroy();
        resolve({ ok: true, ms: Date.now() - start });
      });
      socket.on('error', () => resolve({ ok: false, ms: Date.now() - start }));
      socket.setTimeout(timeoutMs, () => { socket.destroy(); resolve({ ok: false, ms: Date.now() - start }); });
    }
  });
}

export default async function handler(req, res) {
  const url = req.url || '';

  // Readiness — check database TCP connectivity (no pg dependency needed)
  if (url.includes('/health/ready')) {
    const checks = { database: 'down', redis: 'disabled' };
    let ready = true;

    const db = parseDbUrl(process.env.DATABASE_URL);
    if (db) {
      const result = await checkDb(db.host, db.port, db.ssl);
      if (result.ok) checks.database = 'up';
      else { ready = false; }
    } else {
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
