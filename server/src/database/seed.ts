import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB, disconnectDB } from './connection';
import { ensureRolePermissions } from './roleSync';
import { applyMigrations } from './migrate';
import * as usersRepo from '../db/users';
import * as categoriesRepo from '../db/categories';
import * as productsRepo from '../db/products';
import * as couponsRepo from '../db/coupons';
import * as offersRepo from '../db/offers';
import * as bannersRepo from '../db/banners';
import * as branchesRepo from '../db/branches';
import * as deliveryZonesRepo from '../db/deliveryZones';
import * as postsRepo from '../db/posts';
import * as cartsRepo from '../db/carts';
import { upsertSetting } from '../db/settings';
import { query, row } from '../db';
import { DEFAULT_SETTINGS, ORDER_STATUS } from '../constants';
import { seedSections, seedExtras, bestSellerNames, offerNames, galleryImagesSeed, type SeedItem, type SeedSub } from './seedData';
import * as galleryRepo from '../db/gallery';

const slugifyEn = (text: string): string =>
  slugify(text, { lower: true, strict: true }) || `item-${Date.now().toString(36)}`;

// Every product carries a real dish photo from public/images/products, named
// `<en>-<sub>.jpg` (provisioned by scripts/gen-dish-photo-plan.ts +
// scripts/download-dish-photos*.mjs). A product is only left without an image
// if its photo file is missing — nothing hard-fails.
const PUBLIC_PRODUCTS_DIR = fileURLToPath(new URL('../../../public/images/products', import.meta.url));

const imageFor = (item: SeedItem, sub: SeedSub): string | null => {
  const url = `/images/products/${slugifyEn(item.en)}-${slugifyEn(sub.en)}.jpg`;
  const file = path.basename(url);
  return fs.existsSync(path.join(PUBLIC_PRODUCTS_DIR, file)) ? url : null;
};

const clearTables = async (): Promise<void> => {
  await query(
    `TRUNCATE TABLE
       order_items, coupon_redemptions, cart_items, wishlist_items, offer_products,
       product_sizes, product_extras, reviews, orders, carts, wishlists, offers,
       coupons, banners, branches, delivery_zones, posts, contacts, newsletters,
       notifications, categories, products, activity_logs, analytics, permissions,
       roles, users, settings, gallery_images
     RESTART IDENTITY CASCADE`,
  );
};

const seedUsers = async (): Promise<Record<string, string>> => {
  const password = await bcrypt.hash('Frezzer123!', 10);
  const users = [
    { fullName: 'مدير النظام', email: 'admin@frezzerelbalad.dev', role: 'admin', phone: '01000000001', isVerified: true },
    { fullName: 'Manager', email: 'manager@frezzerelbalad.dev', role: 'manager', phone: '01000000002', isVerified: true },
    { fullName: 'Employee', email: 'employee@frezzerelbalad.dev', role: 'employee', phone: '01000000003', isVerified: true },
    { fullName: 'أحمد محمد', email: 'customer@frezzerelbalad.dev', role: 'customer', phone: '01000000004', isVerified: true },
  ];
  const ids: Record<string, string> = {};
  for (const u of users) {
    const created = await usersRepo.create({ ...u, passwordHash: password, provider: 'local' });
    ids[u.role] = created.id;
  }
  console.log('[seed] users created (password: Frezzer123!)');
  return ids;
};

const seedCategories = async (): Promise<Record<string, Record<string, string>>> => {
  const map: Record<string, Record<string, string>> = {};
  for (const section of seedSections) {
    const sectionDoc = await categoriesRepo.create({
      name: section.ar,
      nameEn: section.en,
      slug: `section-${slugifyEn(section.en)}`,
      type: 'section',
      icon: section.icon,
      order: section.order ?? Object.keys(map).length,
      isActive: true,
    });
    if (!sectionDoc) throw new Error('[seed] failed to create section category');
    const subMap: Record<string, string> = {};
    for (const sub of section.subs) {
      const subDoc = await categoriesRepo.create({
        name: sub.ar,
        nameEn: sub.en,
        slug: `sub-${slugifyEn(section.en)}-${slugifyEn(sub.en)}`,
        type: 'sub',
        parentId: sectionDoc._id as string,
        order: Object.keys(subMap).length,
        isActive: true,
      });
      if (!subDoc) throw new Error('[seed] failed to create sub category');
      subMap[sub.ar] = String(subDoc._id);
    }
    map[section.ar] = subMap;
  }
  console.log('[seed] categories created');
  return map;
};

const buildSizes = (prices: [number | null, number | null]) => {
  const names = ['500 جم', '1 كيلو'];
  const enNames = ['500g', '1kg'];
  const active = prices
    .map((p, i) => (p !== null ? { name: names[i], nameEn: enNames[i], price: p as number } : null))
    .filter(Boolean) as { name: string; nameEn: string; price: number }[];
  if (active.length === 1) {
    return [{ name: 'حجم واحد', nameEn: 'Regular', price: active[0].price }];
  }
  return active;
};

const seedProducts = async (catMap: Record<string, Record<string, string>>): Promise<void> => {
  let bestCounter = 0;
  const usedSlugs = new Set<string>();
  const descFor = (itemAr: string, itemEn: string): [string, string] => [
    `${itemAr} - مكونات طازجة 100%`,
    `${itemEn} - 100% fresh ingredients`,
  ];
  for (const section of seedSections) {
    for (const sub of section.subs) {
      const categoryId = catMap[section.ar]?.[sub.ar];
      for (const item of sub.items) {
        const base = `${slugifyEn(item.en)}-${slugifyEn(sub.en)}-${slugifyEn(section.en)}`;
        let slug = base;
        let n = 2;
        while (usedSlugs.has(slug)) {
          slug = `${base}-${n}`;
          n += 1;
        }
        usedSlugs.add(slug);
        const sizes = buildSizes(item.prices);
        const basePrice = Math.min(...sizes.map((s) => s.price));
        const isBestSeller = bestSellerNames.includes(item.ar) && bestCounter < 15;
        if (isBestSeller) bestCounter += 1;
        const isOffer = offerNames.includes(item.ar);
        const discount = isOffer ? 15 + (bestCounter % 4) * 5 : 0;
        const [description, descriptionEn] = descFor(item.ar, item.en);
        const image = imageFor(item, sub);
        await productsRepo.create({
          name: item.ar,
          nameEn: item.en,
          slug,
          description,
          descriptionEn,
          category: categoryId,
          images: image ? [image] : [],
          sizes,
          extras: seedExtras.map((e) => ({ name: e.ar, nameEn: e.en, price: e.price })),
          ingredients: item.ingredients ?? [],
          basePrice,
          preparationTime: 20,
          calories: Math.round(600 + Math.random() * 400),
          isBestSeller,
          isOffer,
          discount,
          tags: item.tags,
          isAvailable: true,
          sortOrder: item.sortOrder ?? 0,
        });
      }
    }
  }
  console.log('[seed] products created');
};

const slugToId = async (slug: string): Promise<string | null> => {
  const p = await productsRepo.getBySlug(slug);
  return p ? String(p._id) : null;
};

const idsForSlugs = async (slugs: string[]): Promise<string[]> => {
  const ids = await Promise.all(slugs.map(slugToId));
  return ids.filter((id): id is string => Boolean(id));
};

const seedCommerce = async (): Promise<void> => {
  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 86400000);

  for (const c of [
    { code: 'WELCOME20', type: 'percent', value: 20, minOrder: 150, maxDiscount: 100, maxUses: 1000, endDate: inDays(365) },
    { code: 'FREZZER10', type: 'percent', value: 10, minOrder: 100, endDate: inDays(90) },
    { code: 'SAVE30', type: 'fixed', value: 30, minOrder: 250, endDate: inDays(30) },
  ]) {
    await couponsRepo.create(c);
  }

  const offers: Array<Record<string, unknown>> = [
    {
      title: 'عرض الأسبوع',
      titleEn: 'Weekly Special',
      description: 'خصم على اللحوم والمجمدات المميزة',
      descriptionEn: 'Discounts on our premium meat & frozen products',
      discountType: 'fixed',
      discountValue: 50,
      startDate: now,
      endDate: inDays(30),
      products: await idsForSlugs([
        'steak-meat-steak',
        'flank-meat-fresh-meat',
        'minced-meat-fresh-meat',
        'kofta-burger-kofta',
        'hawawshi-hawawshi',
      ]),
      theme: 'dark',
      isActive: true,
    },
    {
      title: 'عروض الفراخ',
      titleEn: 'Chicken Deals',
      description: 'خصم 15% على منتجات الفراخ المجمدة',
      descriptionEn: 'Get 15% OFF frozen chicken products',
      discountType: 'percent',
      discountValue: 15,
      startDate: now,
      endDate: inDays(30),
      products: await idsForSlugs([
        'wings-frozen-chicken',
        'shish-frozen-chicken',
        'pane-ready-chicken-products',
        'mozzarella-pane-ready-chicken-products',
        'chicken-hawawshi-hawawshi',
      ]),
      theme: 'dark',
      isActive: true,
    },
    {
      title: 'عرض العائلة',
      titleEn: 'Family Deal',
      description: 'باكيت لحوم + حواوشي + برجر',
      descriptionEn: 'Meat bundle + hawawshi + burger combo',
      discountType: 'fixed',
      discountValue: 40,
      startDate: now,
      endDate: inDays(30),
      products: await idsForSlugs([
        'hawawshi-hawawshi',
        'chicken-hawawshi-hawawshi',
        'baladi-hawawshi-hawawshi',
        'burger-burger-kofta',
        'baladi-burger-burger-kofta',
      ]),
      theme: 'gold',
      isActive: true,
    },
  ];
  for (const offer of offers) {
    await offersRepo.create(offer as never);
  }

  for (const banner of [
    { title: 'فريزر البلد — لحوم ومجمدات طازجة', subtitle: 'اكتشف تشكيلتنا من اللحوم والفراخ والمصنعات', buttonText: 'تسوق الآن', buttonLink: '/menu', position: 'hero', order: 1, isActive: true },
    { title: 'عروض يومية على المجمدات', subtitle: 'خصومات حصرية على منتجاتك المفضلة', buttonText: 'تصفح المنتجات', buttonLink: '/menu', position: 'home', order: 2, isActive: true },
  ]) {
    await bannersRepo.create(banner);
  }

  await branchesRepo.create({
    name: 'فريزر البلد',
    nameEn: 'Frezzer El Balad',
    address: 'شبين القناطر، أمام كوبري المركز، بجوار المستشفى المركزي',
    addressEn: 'Shubin Al Qanater, in front of Kobri Al Markaz, near Al Mustashfa Al Markazy',
    phone: '01278767679',
    whatsapp: '01278767679',
    workHours: 'يومياً 9 صباحاً - 11 مساءً',
    workHoursEn: 'Daily 9AM - 11PM',
    isActive: true,
  });

  await deliveryZonesRepo.create({ name: 'داخل النطاق', nameEn: 'Main zone', fee: 25, minOrder: 100, estimatedMinutes: 30 });
  await deliveryZonesRepo.create({ name: 'النطاق الممتد', nameEn: 'Extended zone', fee: 40, minOrder: 150, estimatedMinutes: 45 });

  for (const post of [
    {
      title: 'كيف تختار اللحوم الطازجة',
      titleEn: 'How to Choose Fresh Meat',
      slug: 'choosing-fresh-meat',
      excerpt: 'نصائح مهمة لاختيار أجود أنواع اللحوم المجمدة',
      excerptEn: 'Important tips for choosing the best frozen meat',
      content: 'اختيار اللحوم الطازجة والمجمدة بشكل صحيح خطوة أساسية لتحضير وجبات لذيذة وصحية. في فريزر البلد، نحرص على تقديم أجود أنواع اللحوم من مصادر موثوقة، مع ضمان الحفاظ على الجودة من المزرعة حتى باب بيتك.',
      contentEn: 'Choosing fresh and properly frozen meat is a key step in preparing delicious and healthy meals. At Frezzer El Balad, we ensure we offer the finest meats from trusted sources, maintaining quality from farm to your doorstep.',
      image: '/images/blog/dough.jpg',
      tags: ['لحوم', 'نصائح'],
      isPublished: true,
    },
    {
      title: 'أفضل طريقة لتحضير الحواوشي في البيت',
      titleEn: 'Best Way to Prepare Hawawshi at Home',
      slug: 'home-hawawshi-guide',
      excerpt: 'وصفة سهلة وسريعة للحواوشي المنزلي',
      excerptEn: 'Easy and quick recipe for homemade hawawshi',
      content: 'الحواوشي من أشهى الأطباق المصرية/MPLyQB100% مكونات طازجة في فريزر البلد، نوفر لك حواوشي جاهز للتحضير بجودة عالية — فقط أخرجيه من المجمد وحضره على النار أو الفرن وتمتع بوجبة لذيذة.',
      contentEn: 'Hawawshi is one of the most delicious Egyptian dishes. At Frezzer El Balad, we provide ready-to-cook hawawshi of premium quality — just take it out of the freezer and cook it on the stove or in the oven for a delicious meal.',
      image: '/images/blog/feteer.jpg',
      tags: ['حواوشي', 'وصفات'],
      isPublished: true,
    },
  ]) {
    await postsRepo.create(post);
  }

  console.log('[seed] commerce data created');
};

const seedGallery = async (): Promise<void> => {
  for (const [i, g] of galleryImagesSeed.entries()) {
    await galleryRepo.create({ title: g.ar, titleEn: g.en, image: g.image, order: i });
  }
  console.log(`[seed] gallery images created (${galleryImagesSeed.length})`);
};

const seedSettings = async (): Promise<void> => {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await upsertSetting(key, value);
  }
  console.log('[seed] settings created');
};

const seedReviews = async (userIds: Record<string, string>): Promise<void> => {
  // Cover the whole menu: best sellers first, then the rest — ~40 rated meals.
  const products = await query<{ id: string }>(
    'SELECT id FROM products ORDER BY "isBestSeller" DESC, "createdAt" LIMIT 40',
  );
  const comments = [
    'أحلى لحوم في المنطقة، الطعم رائع!',
    'الفراخ المجمدة طازجة ونوعية ممتازة',
    'الحواوشي لذيذ جداً والتجربة ممتازة',
    'توصيل سريع والطلب وصل مجمد وطازج',
    'جودة ممتازة وأسعار مناسبة',
    'الأحجام كبيرة والطعم أصلي 100%',
    'مكونات طازجة حقيقي وطعم زي الأول',
    'أول مرة أجرب والنتيجة فاقت التوقع',
    'الوجبة وافرة والتغليف نظيف',
    'أحلى كفتة وبرجر جربتهم من زمان',
    'اللحمة مفرومة طازجة ونوعيتها ممتازة',
    'سجق شرقي أحلى من أي مكان تاني',
  ];
  for (const [i, product] of products.entries()) {
    // Top 10 (best sellers) get 5★; the rest 4/5 so the distribution looks real.
    const rating = i < 10 ? 5 : 4 + (i % 2);
    await query(
      `INSERT INTO reviews ("userId", "productId", "reviewType", rating, comment, status, "isVerifiedPurchase")
       VALUES ($1::uuid, $2::uuid, 'meal', $3, $4, 'published', false)`,
      [userIds.customer, product.id, rating, comments[i % comments.length]],
    );
    await query(
      `UPDATE products SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews
         WHERE "productId" = $1 AND "reviewType" = 'meal' AND status = 'published'), 0),
       "reviewsCount" = (SELECT count(*) FROM reviews
         WHERE "productId" = $1 AND "reviewType" = 'meal' AND status = 'published')
       WHERE id = $1::uuid`,
      [product.id],
    );
  }

  const experience = [
    { rating: 5, foodQuality: 5, delivery: 5, packaging: 4, service: 5, overall: 5, comment: 'تجربة رائعة من أول الطلب للتوصيل، المنتجات كانت مجمدة وممتازة.' },
    { rating: 4, foodQuality: 4, delivery: 5, packaging: 4, service: 4, overall: 4, comment: 'التوصيل سريع والتغليف محكم، المنتجات كانت طازجة ولذيذة.' },
    { rating: 5, foodQuality: 5, delivery: 4, packaging: 5, service: 5, overall: 5, comment: 'من أفضل المتاجر اللي جربتها، الطلب دايماً بالظبط.' },
  ];
  for (const r of experience) {
    await query(
      `INSERT INTO reviews ("userId", "reviewType", rating, comment, status, "isVerifiedPurchase",
         "foodQuality", delivery, packaging, service, "overall")
       VALUES ($1::uuid, 'restaurant', $2, $3, 'published', false, $4, $5, $6, $7, $8)`,
      [userIds.customer, r.rating, r.comment, r.foodQuality, r.delivery, r.packaging, r.service, r.overall],
    );
  }
  console.log('[seed] reviews created');
};

// A delivered demo order for the customer account so the order-history review
// panel and the smart review prompt are immediately demonstrable on fresh
// installs (2 days old, so the review delay has already passed).
const seedDemoOrder = async (userIds: Record<string, string>): Promise<void> => {
  const products = await query<{ id: string; name: string; "nameEn": string; "basePrice": string }>(
    'SELECT id, name, "nameEn", "basePrice" FROM products WHERE "isBestSeller" = true ORDER BY "sortOrder" LIMIT 3',
  );
  if (!products.length) return;
  const items = products.map((p) => ({
    productId: p.id,
    name: p.name,
    size: 'حجم واحد',
    qty: 1,
    unitPrice: Number(p.basePrice),
  }));
  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const deliveryFee = 25;
  const total = subtotal + deliveryFee;
  const orderNo = `FB-DEMO-${Date.now().toString(36).toUpperCase()}`;
  const created = new Date(Date.now() - 2 * 86400000).toISOString();
  const inserted = await query<{ id: string }>(
    `INSERT INTO orders ("orderNo", "userId", "status", subtotal, "deliveryFee", discount, "couponCode",
       total, "paymentMethod", "paymentStatus", "paymentReference", "paymentAmount",
       "deliveryAddress", phone, "customerName", notes, "statusHistory", "createdAt", "updatedAt")
     VALUES ($1, $2::uuid, 'completed', $3, $4, 0, '', $5, 'cash', 'paid', 'DEMO', $5,
       $6::jsonb, '01000000004', 'أحمد محمد', 'طلبية تجريبية لتقييم التجربة', $7::jsonb, $8, $8)
     RETURNING id`,
    [
      orderNo, userIds.customer, subtotal, deliveryFee, total,
      JSON.stringify({ label: 'المنزل', city: 'شبين القناطر', street: 'شارع المركز', building: '12' }),
      JSON.stringify([{ status: 'completed', changedBy: userIds.admin, at: created }]),
      created,
    ],
  );
  const orderId = inserted[0].id;
  for (const [i, it] of items.entries()) {
    await query(
      `INSERT INTO order_items ("orderId", "productId", "sortOrder", name, size, extras, qty, "unitPrice", "lineTotal")
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, '[]'::jsonb, $6, $7, $8)`,
      [orderId, it.productId, i, it.name, it.size, it.qty, it.unitPrice, it.unitPrice * it.qty],
    );
  }
  // Link the demo items' existing meal reviews to this order so they show the
  // verified-purchase badge (one review per product per user is guaranteed).
  for (const it of items) {
    await query(
      `UPDATE reviews SET "orderId" = $1::uuid, "isVerifiedPurchase" = true
       WHERE "userId" = $2::uuid AND "productId" = $3::uuid
         AND "reviewType" = 'meal' AND "orderId" IS NULL`,
      [orderId, userIds.customer, it.productId],
    );
  }
  console.log('[seed] demo completed order created for customer');
};

const seedCart = async (userIds: Record<string, string>): Promise<void> => {
  const wanted = [
    { nameEn: 'Baladi Burger', qty: 2 },
    { nameEn: 'Kofta', qty: 1 },
    { nameEn: 'Hawawshi', qty: 1 },
  ];
  for (const w of wanted) {
    const rows = await query<{ id: string; basePrice: string }>(
      `SELECT id, "basePrice" FROM products WHERE "nameEn" = $1 AND "isAvailable" = true ORDER BY "createdAt" LIMIT 1`,
      [w.nameEn],
    );
    const product = rows[0];
    if (product) {
      await cartsRepo.addItem(userIds.customer, {
        product: product.id,
        size: null,
        sizeName: '',
        extras: [],
        qty: w.qty,
        unitPrice: Number(product.basePrice),
      });
    }
  }
  console.log('[seed] cart seeded for customer demo account');
};

const ensureSchema = async (): Promise<void> => {
  const table = await row<{ t: string | null }>(`SELECT to_regclass('public.products')::text AS t`);
  if (!table?.t) await applyMigrations();
};

const isSeeded = async (): Promise<boolean> => {
  const counts = await row<{ n: string }>(`SELECT count(*)::int::text AS n FROM products`);
  return Number(counts?.n ?? 0) > 0;
};

// Idempotent repair: backfill an empty offer banner from the first image of the
// offer's first linked product. Runs on every seed invocation (even when the DB
// is already seeded) so admin-created offers without banners heal themselves
// without a destructive SEED_RESET wipe.
const repairOfferBanners = async (): Promise<void> => {
  const repaired = await query<{ id: string }>(
    `UPDATE offers o
        SET banner = sub.url
       FROM (
         SELECT op."offerId", p.images[1] AS url
           FROM offer_products op
           JOIN products p ON p.id = op."productId"
          WHERE p.images IS NOT NULL
            AND array_length(p.images, 1) > 0
            AND p.images[1] <> ''
       ) sub
      WHERE sub."offerId" = o.id
        AND (o.banner IS NULL OR o.banner = '')
      RETURNING o.id`,
  );
  if (repaired.length > 0) console.log(`[seed] offer banners backfilled (${repaired.length})`);
};

const run = async (): Promise<void> => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Never wipe production data. SEED_RESET against production is a hard error,
  // even though the seed below skips existing data by default.
  if (isProduction && process.env.SEED_RESET === '1') {
    throw new Error('[seed] SEED_RESET=1 is forbidden in production (would wipe live data).');
  }

  console.log('[seed] connecting...');
  await connectDB();
  await ensureSchema();
  await repairOfferBanners();
  if ((await isSeeded()) && process.env.SEED_RESET !== '1') {
    console.log('[seed] data already exists — skipping (set SEED_RESET=1 to wipe and reseed)');
    await disconnectDB();
    return;
  }
  await clearTables();
  // Roles must be (re)created AFTER the wipe — clearTables truncates the roles
  // table, so syncing before it would leave the DB without any roles (and every
  // permission-guarded admin endpoint would 403).
  await ensureRolePermissions();

  // Demo users, demo order and demo cart are DEVELOPMENT-only. In production,
  // the menu/catalog seed still runs (that is the real menu), but no demo
  // credentials (admin@frezzerelbalad.dev / Frezzer123!) are ever created. Create the
  // first admin via the register page using ADMIN_REGISTER_CODE instead.
  const userIds = isProduction ? {} : await seedUsers();
  const catMap = await seedCategories();
  await seedProducts(catMap);
  await seedCommerce();
  await repairOfferBanners();
  await seedGallery();
  await seedSettings();
  if (!isProduction) {
    await seedReviews(userIds);
    await seedDemoOrder(userIds);
    await seedCart(userIds);
  }

  const counts = await query<{ products: string; categories: string; users: string }>(
    `SELECT (SELECT count(*) FROM products)::int::text AS products,
            (SELECT count(*) FROM categories)::int::text AS categories,
            (SELECT count(*) FROM users)::int::text AS users`,
  );
  console.log('[seed] DONE', counts[0], `(orders statuses: ${Object.values(ORDER_STATUS).join(', ')})`);
  await disconnectDB();
};

run().catch(async (err) => {
  console.error('[seed] FAILED', err);
  await disconnectDB();
  process.exit(1);
});
