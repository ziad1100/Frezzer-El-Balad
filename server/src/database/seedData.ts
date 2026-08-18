// Frezzer El Balad — frozen food / meat / chicken product catalog seed data.
// Products are organized into logical categories with 500g and 1kg variants.
// Prices are DEMO prices, editable from the admin dashboard.

export interface SeedItem {
  ar: string;
  en: string;
  ingredients?: string[];
  tags: string[];
  prices: [number | null, number | null]; // [500g, 1kg]
  sortOrder?: number;
}

export interface SeedSub {
  ar: string;
  en: string;
  items: SeedItem[];
}

export interface SeedSection {
  ar: string;
  en: string;
  icon: string;
  order: number;
  subs: SeedSub[];
}

const meatTags = ['لحوم'];
const chickenTags = ['فراخ'];
const processedTags = ['مصنعات'];
const hawawshiTags = ['حواوشي'];
const marinatedTags = ['متبلة'];

export const seedSections: SeedSection[] = [
  {
    ar: 'اللحوم',
    en: 'Meat',
    icon: 'beef',
    order: 0,
    subs: [
      {
        ar: 'لحوم طازجة',
        en: 'Fresh Meat',
        items: [
          { ar: 'لحمة فلانك', en: 'Flank Meat', ingredients: ['لحمة فلانك'], tags: [...meatTags], prices: [260, 500], sortOrder: 0 },
          { ar: 'لحمة استيك', en: 'Steak Meat', ingredients: ['لحمة استيك'], tags: [...meatTags], prices: [300, 580], sortOrder: 1 },
          { ar: 'لحمة مفرومة', en: 'Minced Meat', ingredients: ['لحمة مفرومة'], tags: [...meatTags], prices: [220, 420], sortOrder: 2 },
        ],
      },
    ],
  },
  {
    ar: 'الكبدة',
    en: 'Liver',
    icon: 'beef',
    order: 1,
    subs: [
      {
        ar: 'كبدة',
        en: 'Liver',
        items: [
          { ar: 'كبدة بقري', en: 'Beef Liver', ingredients: ['كبدة بقري'], tags: [...meatTags], prices: [180, 340], sortOrder: 0 },
          { ar: 'كبدة أمريكاني', en: 'American Liver', ingredients: ['كبدة أمريكاني'], tags: [...meatTags], prices: [190, 360], sortOrder: 1 },
        ],
      },
    ],
  },
  {
    ar: 'السجق والمصنعات',
    en: 'Sausage & Processed',
    icon: 'sausage',
    order: 2,
    subs: [
      {
        ar: 'سجق وسوسيس',
        en: 'Sausage & Sosis',
        items: [
          { ar: 'سجق شرقي', en: 'Eastern Sausage', ingredients: ['سجق شرقي'], tags: [...processedTags, ...meatTags], prices: [170, 320], sortOrder: 0 },
          { ar: 'سوسيس', en: 'Sosis', ingredients: ['سوسيس'], tags: [...processedTags, ...meatTags], prices: [160, 300], sortOrder: 1 },
        ],
      },
      {
        ar: 'منتجات أخرى',
        en: 'Other Products',
        items: [
          { ar: 'جلاش', en: 'Goulash', ingredients: ['جلاش'], tags: [...processedTags], prices: [150, 280], sortOrder: 0 },
          { ar: 'دبوس بلدي', en: 'Baladi Kebab', ingredients: ['دبوس بلدي'], tags: [...processedTags, ...meatTags], prices: [140, 260], sortOrder: 1 },
        ],
      },
    ],
  },
  {
    ar: 'البرجر والكفتة',
    en: 'Burger & Kofta',
    icon: 'burger',
    order: 3,
    subs: [
      {
        ar: 'برجر وكفتة',
        en: 'Burger & Kofta',
        items: [
          { ar: 'برجر', en: 'Burger', ingredients: ['برجر'], tags: [...processedTags, ...meatTags], prices: [180, 340], sortOrder: 0 },
          { ar: 'برجر بلدي', en: 'Baladi Burger', ingredients: ['برجر بلدي'], tags: [...processedTags, ...meatTags], prices: [170, 320], sortOrder: 1 },
          { ar: 'كفتة', en: 'Kofta', ingredients: ['كفتة'], tags: [...meatTags], prices: [180, 340], sortOrder: 2 },
          { ar: 'استربس', en: 'Strips', ingredients: ['استربس'], tags: [...processedTags, ...chickenTags], prices: [150, 280], sortOrder: 3 },
        ],
      },
    ],
  },
  {
    ar: 'الفراخ',
    en: 'Chicken',
    icon: 'chicken',
    order: 4,
    subs: [
      {
        ar: 'فراخ مجمدة',
        en: 'Frozen Chicken',
        items: [
          { ar: 'ريش', en: 'Wings', ingredients: ['ريش فراخ'], tags: [...chickenTags], prices: [300, 580], sortOrder: 0 },
          { ar: 'شيش', en: 'Shish', ingredients: ['شيش طاووق'], tags: [...chickenTags, ...marinatedTags], prices: [170, 320], sortOrder: 1 },
        ],
      },
    ],
  },
  {
    ar: 'منتجات الفراخ الجاهزة',
    en: 'Ready Chicken Products',
    icon: 'chicken',
    order: 5,
    subs: [
      {
        ar: 'بانيه واستربس',
        en: 'Pane & Strips',
        items: [
          { ar: 'بانيه', en: 'Pane', ingredients: ['بانيه فراخ'], tags: [...chickenTags, ...processedTags], prices: [160, 300], sortOrder: 0 },
          { ar: 'بانيه موزاريلا', en: 'Mozzarella Pane', ingredients: ['بانيه فراخ', 'جبن موزاريلا'], tags: [...chickenTags, ...processedTags], prices: [190, 360], sortOrder: 1 },
        ],
      },
    ],
  },
  {
    ar: 'الحواوشي',
    en: 'Hawawshi',
    icon: 'sandwich',
    order: 6,
    subs: [
      {
        ar: 'حواوشي',
        en: 'Hawawshi',
        items: [
          { ar: 'حواوشي', en: 'Hawawshi', ingredients: ['عجين', 'لحمة مفرومة', 'بصل', 'خضار'], tags: [...hawawshiTags, ...meatTags], prices: [170, 320], sortOrder: 0 },
          { ar: 'حواوشي فراخ', en: 'Chicken Hawawshi', ingredients: ['عجين', 'فراخ', 'بصل', 'خضار'], tags: [...hawawshiTags, ...chickenTags], prices: [150, 280], sortOrder: 1 },
          { ar: 'حواوشي أرز', en: 'Rice Hawawshi', ingredients: ['عجين', 'لحمة', 'أرز'], tags: [...hawawshiTags, ...meatTags], prices: [160, 300], sortOrder: 2 },
          { ar: 'حواوشي بلدي', en: 'Baladi Hawawshi', ingredients: ['عجين', 'لحمة بلدي', 'بصل', 'بهارات'], tags: [...hawawshiTags, ...meatTags], prices: [170, 320], sortOrder: 3 },
        ],
      },
    ],
  },
];

export const seedExtras = [
  { ar: 'جبنة إضافية', en: 'Extra Cheese', price: 15 },
  { ar: 'صلصة إضافية', en: 'Extra Sauce', price: 10 },
];

// Bestsellers (deterministic)
export const bestSellerNames = [
  'لحمة استيك', 'كبدة بقري', 'برجر', 'كفتة', 'سجق شرقي',
  'بانيه موزاريلا', 'حواوشي بلدي', 'بانيه', 'لحمة مفرومة', 'ريش',
];

// Offers flagged with a discount %
export const offerNames = [
  'برجر بلدي', 'استربس', 'حواوشي فراخ', 'سوسيس', 'جلاش',
];

export interface SeedGalleryImage {
  ar: string;
  en: string;
  image: string;
}

export const galleryImagesSeed: SeedGalleryImage[] = [];
