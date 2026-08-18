// Bundled by `npm run build:api` into server/dist/handler.js — the runtime
// dependency of the Vercel serverless function api/v1/[...path].js.
//
// The existing Express app is served as-is (same code, same routes) — no
// redesign. Express 4 apps are plain (req, res) handlers, which is exactly how
// Vercel's Node runtime invokes a function's default export, so no
// serverless-http adapter is needed (v4 is AWS-event-based and rewrites the
// URL when called in node style).
import app from '../server/src/app';

export default app;
