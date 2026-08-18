import slugify from 'slugify';

export const slugifyText = (text: string, lang: 'en' | 'ar' = 'en'): string => {
  const base = slugify(text, { lower: true, strict: true, locale: 'en' });
  if (base) return base;
  return lang === 'ar'
    ? text
        .trim()
        .toLowerCase()
        .replace(/[\s]+/g, '-')
        .replace(/[^\w\u0600-\u06FF-]/g, '')
    : `item-${Date.now().toString(36)}`;
};

export const uniqueSlug = async (
  text: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> => {
  const base = slugifyText(text);
  let slug = base;
  let i = 1;
  while (await exists(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
};
