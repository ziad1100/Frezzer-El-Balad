// Writes scripts/dish-photo-plan.json — one row per unique derived photo file
// the seed expects (mirrors seed.ts imageFor(): `<en>-<sub>.jpg`). The plain-Node
// downloader reads this so it never has to parse TypeScript.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedSections } from '../server/src/database/seedData';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const slugifyEn = (text: string): string =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

type Row = { file: string; en: string; ar: string; sub: string; section: string };

const byFile = new Map<string, Row>();
for (const section of seedSections) {
  for (const sub of section.subs) {
    for (const item of sub.items) {
      const file = `${slugifyEn(item.en)}-${slugifyEn(sub.en)}.jpg`;
      if (!byFile.has(file)) {
        byFile.set(file, { file, en: item.en, ar: item.ar, sub: sub.en, section: section.en });
      }
    }
  }
}

const rows = [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file));
fs.writeFileSync(path.join(ROOT, 'scripts', 'dish-photo-plan.json'), JSON.stringify(rows, null, 2));
console.log(`[plan] ${rows.length} unique photos for ${seedSections.flatMap((s) => s.subs.flatMap((sub) => sub.items)).length} products`);
