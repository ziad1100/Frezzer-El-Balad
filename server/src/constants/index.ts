export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  CUSTOMER: 'customer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const RESOURCES = [
  'products',
  'categories',
  'orders',
  'users',
  'branches',
  'offers',
  'banners',
  'coupons',
  'reviews',
  'contacts',
  'newsletter',
  'notifications',
  'settings',
  'analytics',
  'activity',
  'posts',
  'gallery',
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ['create', 'read', 'update', 'delete', 'hide'] as const;
export type Action = (typeof ACTIONS)[number];

export const PERMISSION_PRESETS: Record<
  Role,
  Record<Resource, Action[]>
> = {
  admin: Object.fromEntries(RESOURCES.map((r) => [r, [...ACTIONS]])) as never,
  manager: Object.fromEntries(
    RESOURCES.map((r) => [
      r,
      r === 'settings' || r === 'activity' ? ['read'] : ['create', 'read', 'update', 'hide', 'delete'],
    ]),
  ) as never,
  employee: {
    products: ['read', 'update'],
    categories: ['read'],
    orders: ['read', 'update', 'create'],
    reviews: ['read', 'create', 'update'],
    contacts: ['read', 'update'],
    newsletter: ['read'],
    notifications: ['read'],
    ...Object.fromEntries(
      RESOURCES.filter((r) => !['products', 'categories', 'orders', 'reviews', 'contacts', 'newsletter', 'notifications'].includes(r)).map((r) => [r, ['read']]),
    ),
  } as never,
  customer: {
    orders: ['create', 'read', 'update'],
    reviews: ['create', 'read', 'update', 'delete'],
    notifications: ['read'],
    ...Object.fromEntries(RESOURCES.map((r) => [r, []])),
  } as never,
};

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY_FOR_DELIVERY: 'ready_for_delivery',
  ON_DELIVERY: 'on_delivery',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DELIVERY_FAILED: 'delivery_failed',
  REFUNDED: 'refunded',
  COMPLIMENTARY: 'complimentary',
} as const;

export const ORDER_STATUS_FLOW = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY_FOR_DELIVERY,
  ORDER_STATUS.ON_DELIVERY,
  ORDER_STATUS.COMPLETED,
];

export const TERMINAL_ORDER_STATUSES: readonly string[] = [
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.DELIVERY_FAILED,
  ORDER_STATUS.REFUNDED,
  ORDER_STATUS.COMPLIMENTARY,
];

/** Valid admin status transitions (server-side source of truth). */
export const ORDER_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.READY_FOR_DELIVERY]: [ORDER_STATUS.ON_DELIVERY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ON_DELIVERY]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.DELIVERY_FAILED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.COMPLETED]: [ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.REFUNDED]: [],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.DELIVERY_FAILED]: [],
  [ORDER_STATUS.COMPLIMENTARY]: [],
};

/** Human-readable status labels for customer notifications: [ar, en]. */
export const ORDER_STATUS_LABELS: Record<string, [string, string]> = {
  [ORDER_STATUS.PENDING]: ['جديد', 'New'],
  [ORDER_STATUS.CONFIRMED]: ['تم التأكيد', 'Confirmed'],
  [ORDER_STATUS.PREPARING]: ['جاري التجهيز', 'Preparing'],
  [ORDER_STATUS.READY_FOR_DELIVERY]: ['جاهز للتوصيل', 'Ready for Delivery'],
  [ORDER_STATUS.ON_DELIVERY]: ['في الطريق', 'Out for Delivery'],
  [ORDER_STATUS.COMPLETED]: ['تم التسليم', 'Delivered'],
  [ORDER_STATUS.CANCELLED]: ['ملغي', 'Cancelled'],
  [ORDER_STATUS.DELIVERY_FAILED]: ['فشل التسليم', 'Delivery Failed'],
  [ORDER_STATUS.REFUNDED]: ['تم استرداد المبلغ', 'Refunded'],
  [ORDER_STATUS.COMPLIMENTARY]: ['مجاني / هدية', 'Complimentary'],
};

export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  VODAFONE_CASH: 'vodafone_cash',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  REFUNDED: 'refunded',
} as const;

export const COUPON_TYPES = {
  PERCENT: 'percent',
  FIXED: 'fixed',
} as const;

export const OFFER_TYPES = {
  PERCENT: 'percent',
  FIXED: 'fixed',
} as const;

export const DEFAULT_SETTINGS = {
  restaurantName: { ar: 'ولاد حلال', en: 'Welad Halal' },
  logo: '',
  tagline: { ar: 'لحوم وفراخ ومجمدات بجودة عالية وأسعار مناسبة', en: 'Premium meat, chicken & frozen products at affordable prices' },
  themeColors: { primary: '#1E3A5F', accent: '#38BDF8', background: '#0F172A' },
  workingHours: { ar: 'يومياً من 9 صباحاً حتى 11 مساءً', en: 'Daily 9AM - 11PM' },
  phone: '',
  whatsapp: '',
  facebook: 'Welad Halal',
  instagram: '@weladhalal',
  tiktok: '',
  googleMaps: '',
  deliveryFee: 25,
  minimumOrder: 100,
  reviewPromptCooldownDays: 3,
  reviewPromptDelayHours: 24,
};
