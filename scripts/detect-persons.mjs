#!/usr/bin/env node
// Headless face/person detection over all product photos.
// Flags any dish photo that contains a visible face (cooking scenes,
// crowds, portraits) so they can be replaced with dish-only photos.
//
// Uses puppeteer-core + a headless Edge/Chrome and face-api.js (CDN).
// Writes scripts/photo-candidates/person-detection.json:
//   [{ file, faces, label }]  label = "CLEAN" | "PERSON"

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_DIR = path.join(ROOT, 'public', 'images', 'products');
const OUT_JSON = path.join(ROOT, 'scripts', 'photo-candidates', 'person-detection.json');

const EXECUTABLES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const executablePath = EXECUTABLES.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error('no Edge/Chrome found');

const INPUT_SIZE = Number(process.env.INPUT_SIZE ?? 416);
const SCORE_THRESHOLD = Number(process.env.SCORE_THRESHOLD ?? 0.45);

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body>
<script src="https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js"></script>
<script>
const MODELS = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
let modelReady = faceapi.nets.tinyFaceDetector.loadFromUri(MODELS).then(() => true).catch(() => false);
window.__ready = async () => {
  await modelReady;
  return typeof faceapi !== 'undefined' && !!faceapi.nets.tinyFaceDetector.params;
};
window.__detect = async (dataUrl) => {
  await modelReady;
  const img = new Image();
  img.src = dataUrl;
  await img.decode().catch(() => {});
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: ${INPUT_SIZE}, scoreThreshold: ${SCORE_THRESHOLD} });
  const dets = await faceapi.detectAllFaces(img, opts);
  return dets.length;
};
</script>
</body></html>`;

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setContent(PAGE, { waitUntil: 'networkidle0', timeout: 60_000 });
  const ready = await page.evaluate(() => window.__ready());
  if (!ready) throw new Error('face-api failed to load');

  const files = fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort();

  const results = [];
  for (const file of files) {
    const b64 = fs.readFileSync(path.join(PRODUCTS_DIR, file)).toString('base64');
    let faces = 0;
    try {
      faces = await page.evaluate(async (d) => window.__detect(d), `data:image/jpeg;base64,${b64}`);
    } catch (err) {
      console.error(`  [detect] ${file}: ${err.message}`);
    }
    results.push({ file, faces, label: faces > 0 ? 'PERSON' : 'CLEAN' });
    console.log(`  ${faces > 0 ? 'PERSON' : 'CLEAN '} (${faces}) ${file}`);
    fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));
  }
  console.log(`[detect] DONE: ${results.filter((r) => r.label === 'PERSON').length} files with persons / ${results.length} scanned`);
} finally {
  await browser.close();
}