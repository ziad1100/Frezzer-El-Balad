import { describe, expect, it } from 'vitest';
import { slugifyText, uniqueSlug } from './slugify';

describe('slugifyText', () => {
  it('slugifies english text', () => {
    expect(slugifyText('Pepperoni Pizza Supreme')).toBe('pepperoni-pizza-supreme');
  });

  it('transliterates arabic text to a latin slug', () => {
    expect(slugifyText('بيتزا بالخضار', 'ar')).toBe('bytza-balkhdhar');
  });

  it('falls back to a generated slug for non-alphanumeric input', () => {
    expect(slugifyText('!!!')).toMatch(/^item-[a-z0-9]+$/);
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when free', async () => {
    expect(await uniqueSlug('Pizza', async () => false)).toBe('pizza');
  });

  it('appends a numeric suffix while the slug is taken', async () => {
    const taken = new Set(['pizza']);
    const exists = async (slug: string): Promise<boolean> => taken.has(slug);
    expect(await uniqueSlug('Pizza', exists)).toBe('pizza-1');
  });
});
