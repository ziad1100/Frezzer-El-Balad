// Vercel serverless entry for the full Express API — a single function that
// every API/health request is rewritten to. vercel.json rewrites preserve the
// original path in the `url` query param (e.g. /api/v1/products?limit=2 →
// /api/app?url=/api/v1/products&limit=2); this wrapper restores it so the
// Express app routes exactly as it does on the container host (same code,
// same routes — no redesign). Express 4 apps are plain (req, res) handlers,
// which is what Vercel's Node runtime invokes.
import app from '../server/dist/handler.js';

export const config = { maxDuration: 60 };

export default function handler(req, res) {
  const qs = (req.url || '').split('?')[1] || '';
  const params = new URLSearchParams(qs);
  const original = params.get('url');
  params.delete('url');
  const rest = params.toString();
  if (original) {
    req.url = rest ? `${original}?${rest}` : original;
  }
  return app(req, res);
}
