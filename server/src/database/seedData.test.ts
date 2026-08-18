import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedSections, bestSellerNames, offerNames, galleryImagesSeed } from './seedData';

// Guards the ORABI catalog against regressions like the one that wiped the
// menu sections from the seed. Dish photos were intentionally removed from
// products (only the curated gallery keeps real photos), so products render
// with placeholder art; the gallery itself must always reference real files.
const PUBLIC_PRODUCTS_DIR = fileURLToPath(new URL('../../../public/images/products', import.meta.url));

describe('seed catalog integrity (ORABI menu)', () => {
  const pairs = seedSections.flatMap((section) =>
    section.subs.flatMap((sub) => sub.items.map((item) => ({ item, sub, section }))),
  );

  it('has the documented 9 sections and 22 sub-sections', () => {
    expect(seedSections).toHaveLength(9);
    expect(seedSections.flatMap((s) => s.subs)).toHaveLength(22);
  });

  it('has 123 products (68 existing + 55 restored pizza items)', () => {
    expect(pairs).toHaveLength(123);
  });

  it('every best-seller and offer name resolves to a real item', () => {
    const names = new Set(pairs.map(({ item }) => item.ar));
    const unknown = [...bestSellerNames, ...offerNames].filter((n) => !names.has(n));
    expect(unknown).toEqual([]);
  });

  it('every product has at least one offered size', () => {
    const invalid = pairs
      .filter(({ item }) => item.prices.every((p) => p === null))
      .map(({ item, section }) => `${section.en} / ${item.en}`);
    expect(invalid).toEqual([]);
  });

  it('every curated gallery image exists and uses a unique file', () => {
    const seen = new Set<string>();
    const problems = galleryImagesSeed
      .map((g) => {
        const file = path.join(PUBLIC_PRODUCTS_DIR, path.basename(g.image));
        if (!fs.existsSync(file)) return `missing file: ${g.image}`;
        if (seen.has(g.image)) return `duplicate image: ${g.image}`;
        seen.add(g.image);
        return null;
      })
      .filter((p): p is string => Boolean(p));
    expect(problems).toEqual([]);
    expect(galleryImagesSeed).toHaveLength(24);
  });
});
