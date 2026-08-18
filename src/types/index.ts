export interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export type Role = 'admin' | 'manager' | 'employee' | 'customer';

export interface User {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  avatar: string;
  isVerified: boolean;
  isActive: boolean;
  addresses: Address[];
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  label: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
  landmark?: string;
  notes?: string;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  avatar?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ProductSize {
  _id?: string;
  name: string;
  nameEn: string;
  price: number;
  isAvailable: boolean;
}

export interface ProductExtra {
  _id?: string;
  name: string;
  nameEn: string;
  price: number;
}

export interface Product {
  _id: string;
  name: string;
  nameEn: string;
  slug: string;
  description: string;
  descriptionEn: string;
  category: string;
  images: string[];
  sizes: ProductSize[];
  extras: ProductExtra[];
  ingredients: string[];
  ingredientsEn?: string[];
  basePrice: number;
  discount: number;
  rating: number;
  reviewsCount: number;
  preparationTime: number;
  calories: number;
  isAvailable: boolean;
  isBestSeller: boolean;
  isOffer: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type ReviewStatus = 'pending' | 'published' | 'hidden';
export type ReviewType = 'meal' | 'restaurant';

export interface ReviewAuthor {
  _id: string;
  fullName: string;
  avatar?: string;
  email?: string;
}

export interface ReviewProductRef {
  _id: string;
  name: string;
  nameEn?: string;
  images?: string[];
}

export interface Review {
  _id: string;
  user: string | ReviewAuthor;
  product: string | ReviewProductRef;
  orderId: string;
  reviewType: ReviewType;
  status: ReviewStatus;
  rating: number;
  comment: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  foodQuality?: number | null;
  delivery?: number | null;
  packaging?: number | null;
  service?: number | null;
  overall?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  total: number;
  average: number;
  '5': number;
  '4': number;
  '3': number;
  '2': number;
  '1': number;
}

export interface PaginatedReviews {
  items: Review[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  summary?: ReviewSummary;
}

export interface ReviewOrderItemState {
  productId: string;
  name: string;
  nameEn?: string;
  slug?: string;
  images?: string[];
  itemName: string;
  qty: number;
  size?: string | null;
  reviewId: string | null;
  reviewRating: number | null;
}

export interface OrderReviewState {
  order: { _id: string; status: string; orderNo: string };
  items: ReviewOrderItemState[];
  restaurant: Pick<Review, 'rating' | 'comment' | 'foodQuality' | 'delivery' | 'packaging' | 'service' | 'overall' | 'createdAt' | 'updatedAt'> & { _id: string } | null;
}

export interface EligibleOrder {
  _id: string;
  orderNo: string;
  createdAt: string;
}

export interface PendingReviewOrder {
  orderId: string;
  orderNo: string;
  createdAt: string;
  unreviewedItems: number;
  hasExperienceReview: boolean;
}

export interface MealRatingAgg {
  _id: string;
  name: string;
  nameEn?: string;
  reviews: number;
  average?: number;
}

export interface AdminReviewStats {
  total: number;
  published: number;
  pending: number;
  hidden: number;
  today: number;
  fiveStar: number;
  oneStar: number;
  average: number;
  restaurantTotal: number;
  restaurantAverage: number;
  mostReviewed: MealRatingAgg[];
  highestRated: MealRatingAgg[];
  lowestRated: MealRatingAgg[];
}

export interface Category {
  _id: string;
  name: string;
  nameEn: string;
  slug: string;
  type: 'section' | 'sub';
  parentId?: string | null;
  image: string;
  icon: string;
  order: number;
  isActive: boolean;
}

export interface CartItemInput {
  product: string;
  size?: string | null;
  sizeName?: string;
  extras: { name: string; price: number }[];
  qty: number;
}

export interface CouponResult {
  code: string;
  amount: number;
  type: 'percent' | 'fixed';
}

export interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  address: string;
  addressEn: string;
  phone: string;
  whatsapp: string;
  workHours: string;
  workHoursEn: string;
  lat: number;
  lng: number;
  googleMapsUrl: string;
  image: string;
  isActive: boolean;
}

export interface Offer {
  _id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  banner: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  theme: 'dark' | 'red' | 'gold';
  startDate: string;
  endDate: string;
  products: string[];
  isActive: boolean;
}

export interface Post {
  _id: string;
  title: string;
  titleEn: string;
  slug: string;
  excerpt: string;
  excerptEn: string;
  content: string;
  contentEn: string;
  image: string;
  tags: string[];
  publishedAt: string;
  isPublished: boolean;
}

export interface OrderItem {
  product: string;
  name: string;
  nameEn?: string;
  size?: string;
  extras: { name: string; price: number }[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  _id: string;
  orderNo: string;
  user: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode: string;
  total: number;
  adjustmentAmount: number;
  isComplimentary: boolean;
  adjustmentReason: string;
  adjustedBy: string | { _id: string; fullName: string } | null;
  adjustedAt: string | null;
  payment: {
    method: PaymentMethod;
    status: string;
    reference: string;
    amount: number;
  };
  status: OrderStatus;
  deliveryAddress: Address;
  phone: string;
  customerName: string;
  notes: string;
  statusHistory: { status: string; changedBy: string; at: string; reason?: string }[];
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'on_delivery' | 'completed' | 'cancelled' | 'refunded' | 'complimentary';
export type PaymentMethod = 'cash' | 'card' | 'vodafone_cash';

export interface Contact {
  _id: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Coupon {
  _id: string;
  code: string;
  name: string;
  nameEn: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrder: number;
  maxDiscount: number;
  maxUses: number;
  usedCount: number;
  perUserLimit: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Banner {
  _id: string;
  title: string;
  subtitle: string;
  image: string;
  buttonText: string;
  buttonLink: string;
  position: 'hero' | 'home' | 'deals';
  order: number;
  isActive: boolean;
}

export interface GalleryImage {
  _id: string;
  title: string;
  titleEn: string;
  image: string;
  order: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodMetrics {
  revenue: number;
  orders: number;
  unitsSold: number;
  customers: number;
  topProducts: { _id: string; name: string; count: number; revenue: number }[];
}

export interface DashboardData {
  revenue: number;
  netRevenue: number;
  grossRevenue: number;
  discounts: number;
  deliveryFees: number;
  orders: number;
  customers: number;
  products: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  complimentaryOrders: number;
  recentRevenue: number;
  recentOrders: number;
  recentCustomers: number;
  revenueTrend: { date: string; revenue: number; orders: number }[];
  dailyStats: { date: string; revenue: number; orders: number; unitsSold: number }[];
  periodOverview: { today: PeriodMetrics; week: PeriodMetrics; month: PeriodMetrics };
  statusBreakdown: { status: string; count: number }[];
  topProducts: { _id: string; name: string; count: number; revenue: number }[];
}

export interface DayStats {
  date: string;
  orders: number;
  completed: number;
  cancelled: number;
  refunded: number;
  complimentary: number;
  revenue: number;
  grossRevenue: number;
  discounts: number;
  deliveryFees: number;
}

export interface ActivityLogEntry {
  _id: string;
  actor: string;
  role: string;
  action: string;
  resource: string;
  targetId: string;
  createdAt: string;
}

export interface ProductPayload {
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  category: string;
  images?: string[];
  sizes?: ProductSize[];
  extras?: ProductExtra[];
  ingredients?: string[];
  ingredientsEn?: string[];
  basePrice: number;
  discount?: number;
  preparationTime?: number;
  calories?: number;
  isAvailable?: boolean;
  isBestSeller?: boolean;
  isOffer?: boolean;
  tags?: string[];
}

export interface SettingsMap {
  deliveryFee?: number;
  minimumOrder?: number;
  freeDeliveryOver?: number;
  [key: string]: unknown;
}
