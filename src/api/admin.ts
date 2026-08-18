import { api, unwrap } from '@/lib/api';
import type {
  ActivityLogEntry,
  ApiEnvelope,
  Banner,
  Branch,
  Category,
  Contact,
  Coupon,
  DashboardData,
  DayStats,
  GalleryImage,
  Offer,
  Order,
  OrderStatus,
  Paginated,
  Post,
  Product,
  ProductPayload,
  Review,
  ReviewStatus,
  AdminReviewStats,
  SettingsMap,
  User,
} from '@/types';

export interface ListParams {
  page?: number;
  limit?: number;
  q?: string;
  availability?: string;
  category?: string;
  status?: string;
  role?: string;
}

export const adminListProducts = (params: ListParams): Promise<Paginated<Product>> =>
  unwrap(
    api.get<ApiEnvelope<Paginated<Product>>>('/products/admin', {
      params: { page: params.page ?? 1, limit: params.limit ?? 12, q: params.q, availability: params.availability, category: params.category },
    }),
  );

export const createProduct = (payload: ProductPayload): Promise<Product> =>
  unwrap(api.post<ApiEnvelope<Product>>('/products', payload));

export const updateProduct = (id: string, payload: Partial<ProductPayload>): Promise<Product> =>
  unwrap(api.patch<ApiEnvelope<Product>>(`/products/${id}`, payload));

export const toggleProduct = (id: string): Promise<Product> =>
  unwrap(api.patch<ApiEnvelope<Product>>(`/products/${id}/toggle`));

export const deleteProduct = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/products/${id}`));

export const adminListCategories = (): Promise<Category[]> =>
  unwrap(api.get<ApiEnvelope<Category[]>>('/categories', { params: { all: 'true' } }));

export const createCategory = (payload: Partial<Category>): Promise<Category> =>
  unwrap(api.post<ApiEnvelope<Category>>('/categories', payload));

export const updateCategory = (id: string, payload: Partial<Category>): Promise<Category> =>
  unwrap(api.patch<ApiEnvelope<Category>>(`/categories/${id}`, payload));

export const toggleCategory = (id: string): Promise<Category> =>
  unwrap(api.patch<ApiEnvelope<Category>>(`/categories/${id}/toggle`));

export const deleteCategory = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/categories/${id}`));

export const adminListOrders = (params: ListParams): Promise<Paginated<Order>> =>
  unwrap(
    api.get<ApiEnvelope<Paginated<Order>>>('/orders/admin', {
      params: { page: params.page ?? 1, limit: params.limit ?? 15, q: params.q, status: params.status },
    }),
  );

export const updateOrderStatus = (id: string, status: OrderStatus): Promise<Order> =>
  unwrap(api.patch<ApiEnvelope<Order>>(`/orders/${id}/status`, { status }));

export const adminCancelOrder = (id: string, reason: string): Promise<Order> =>
  unwrap(api.post<ApiEnvelope<Order>>(`/orders/${id}/admin-cancel`, { reason }));

export const adminMarkComplimentary = (id: string, reason: string): Promise<Order> =>
  unwrap(api.post<ApiEnvelope<Order>>(`/orders/${id}/complimentary`, { reason }));

export const getOrderStats = (): Promise<{
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  complimentaryOrders: number;
  pendingOrders: number;
  revenue: number;
  netRevenue: number;
  grossRevenue: number;
  discounts: number;
  deliveryFees: number;
}> => unwrap(api.get<ApiEnvelope<{ totalOrders: number; completedOrders: number; cancelledOrders: number; refundedOrders: number; complimentaryOrders: number; pendingOrders: number; revenue: number; netRevenue: number; grossRevenue: number; discounts: number; deliveryFees: number }>>('/orders/stats'));

export const adminListUsers = (params: ListParams): Promise<Paginated<User>> =>
  unwrap(
    api.get<ApiEnvelope<Paginated<User>>>('/admin/users', {
      params: { page: params.page ?? 1, limit: params.limit ?? 15, search: params.q, role: params.role },
    }),
  );

export const updateUser = (id: string, payload: Partial<Pick<User, 'fullName' | 'phone' | 'role' | 'isActive' | 'avatar'>>): Promise<User> =>
  unwrap(api.patch<ApiEnvelope<User>>(`/admin/users/${id}`, payload));

export const deleteUser = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/admin/users/${id}`));

export const getActivityLogs = (): Promise<ActivityLogEntry[]> =>
  unwrap(api.get<ApiEnvelope<ActivityLogEntry[]>>('/admin/users/logs/activity'));

export const adminListPosts = (params: ListParams): Promise<Paginated<Post>> =>
  unwrap(
    api.get<ApiEnvelope<Paginated<Post>>>('/posts/all/admin', {
      params: { page: params.page ?? 1, limit: params.limit ?? 15, q: params.q },
    }),
  );

export const createPost = (payload: Partial<Post>): Promise<Post> =>
  unwrap(api.post<ApiEnvelope<Post>>('/posts', payload));

export const updatePost = (id: string, payload: Partial<Post>): Promise<Post> =>
  unwrap(api.patch<ApiEnvelope<Post>>(`/posts/${id}`, payload));

export const deletePost = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/posts/${id}`));

export const adminListBranches = (): Promise<Branch[]> =>
  unwrap(api.get<ApiEnvelope<Branch[]>>('/branches/all'));

export const createBranch = (payload: Partial<Branch>): Promise<Branch> =>
  unwrap(api.post<ApiEnvelope<Branch>>('/branches', payload));

export const updateBranch = (id: string, payload: Partial<Branch>): Promise<Branch> =>
  unwrap(api.patch<ApiEnvelope<Branch>>(`/branches/${id}`, payload));

export const deleteBranch = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/branches/${id}`));

export const listCoupons = (): Promise<Coupon[]> =>
  unwrap(api.get<ApiEnvelope<Coupon[]>>('/coupons'));

export const createCoupon = (payload: Partial<Coupon>): Promise<Coupon> =>
  unwrap(api.post<ApiEnvelope<Coupon>>('/coupons', payload));

export const updateCoupon = (id: string, payload: Partial<Coupon>): Promise<Coupon> =>
  unwrap(api.patch<ApiEnvelope<Coupon>>(`/coupons/${id}`, payload));

export const deleteCoupon = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/coupons/${id}`));

export const adminListOffers = (): Promise<Offer[]> =>
  unwrap(api.get<ApiEnvelope<Offer[]>>('/offers'));

export const createOffer = (payload: Partial<Offer>): Promise<Offer> =>
  unwrap(api.post<ApiEnvelope<Offer>>('/offers', payload));

export const updateOffer = (id: string, payload: Partial<Offer>): Promise<Offer> =>
  unwrap(api.patch<ApiEnvelope<Offer>>(`/offers/${id}`, payload));

export const deleteOffer = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/offers/${id}`));

export const adminListBanners = (): Promise<Banner[]> =>
  unwrap(api.get<ApiEnvelope<Banner[]>>('/banners'));

export const createBanner = (payload: Partial<Banner>): Promise<Banner> =>
  unwrap(api.post<ApiEnvelope<Banner>>('/banners', payload));

export const updateBanner = (id: string, payload: Partial<Banner>): Promise<Banner> =>
  unwrap(api.patch<ApiEnvelope<Banner>>(`/banners/${id}`, payload));

export const toggleBanner = (id: string): Promise<Banner> =>
  unwrap(api.patch<ApiEnvelope<Banner>>(`/banners/${id}/toggle`));

export const deleteBanner = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/banners/${id}`));

export const adminListContacts = (params: ListParams = {}): Promise<Paginated<Contact>> =>
  unwrap(
    api.get<ApiEnvelope<Paginated<Contact>>>('/contacts', {
      params: { page: params.page ?? 1, limit: params.limit ?? 20 },
    }),
  );

export const markContactRead = (id: string): Promise<Contact> =>
  unwrap(api.patch<ApiEnvelope<Contact>>(`/contacts/${id}/read`));

export const deleteContact = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/contacts/${id}`));

export const getAdminSettings = (): Promise<SettingsMap> =>
  unwrap(api.get<ApiEnvelope<SettingsMap>>('/settings'));

export const updateSettings = (payload: Record<string, unknown>): Promise<SettingsMap> =>
  unwrap(api.patch<ApiEnvelope<SettingsMap>>('/settings', payload));

export const getDashboard = (): Promise<DashboardData> =>
  unwrap(api.get<ApiEnvelope<DashboardData>>('/analytics/dashboard'));

export const getDashboardDay = (date: string): Promise<DayStats> =>
  unwrap(api.get<ApiEnvelope<DayStats>>('/analytics/day', { params: { date } }));

export const refreshDashboard = (): Promise<{ ok: boolean }> =>
  unwrap(api.post<ApiEnvelope<{ ok: boolean }>>('/analytics/refresh'));

export const clearDashboardStats = (): Promise<{ ok: boolean }> =>
  unwrap(api.post<ApiEnvelope<{ ok: boolean }>>('/analytics/clear'));

export const exportDashboard = async (date?: string, period = 'today'): Promise<{ blob: Blob; filename: string }> => {
  const res = await api.get<Blob>('/analytics/export', {
    params: { date: date || undefined, period },
    responseType: 'blob',
  });
  // Prefer the server-provided filename (respects the selected period/date range).
  const disposition = String(res.headers?.['content-disposition'] ?? '');
  const match = disposition.match(/filename="?([^";]+)"?/);
  const fallback = `dashboard-report-${date ?? new Date().toISOString().slice(0, 10)}.xlsx`;
  return { blob: res.data, filename: match?.[1] ?? fallback };
};

export interface ReviewListParams extends ListParams {
  status?: string;
  rating?: string;
  type?: string;
  product?: string;
  sort?: string;
  verified?: string;
}

export const adminListReviews = (params: ReviewListParams): Promise<Paginated<Review>> =>
  unwrap(
    api.get<ApiEnvelope<Paginated<Review>>>('/reviews/admin', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        q: params.q,
        status: params.status,
        rating: params.rating,
        type: params.type,
        product: params.product,
        sort: params.sort,
        verified: params.verified,
      },
    }),
  );

export const adminModerateReview = (id: string, status: ReviewStatus): Promise<Review> =>
  unwrap(api.patch<ApiEnvelope<Review>>(`/reviews/${id}/moderate`, { status }));

export const adminReviewStats = (): Promise<AdminReviewStats> =>
  unwrap(api.get<ApiEnvelope<AdminReviewStats>>('/reviews/admin/stats'));

export const deleteReview = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/reviews/admin/${id}`));

export const adminListGallery = (): Promise<GalleryImage[]> =>
  unwrap(api.get<ApiEnvelope<GalleryImage[]>>('/gallery'));

export const createGalleryImage = (payload: Partial<GalleryImage>): Promise<GalleryImage> =>
  unwrap(api.post<ApiEnvelope<GalleryImage>>('/gallery', payload));

export const updateGalleryImage = (id: string, payload: Partial<GalleryImage>): Promise<GalleryImage> =>
  unwrap(api.patch<ApiEnvelope<GalleryImage>>(`/gallery/${id}`, payload));

export const toggleGalleryImage = (id: string): Promise<GalleryImage> =>
  unwrap(api.patch<ApiEnvelope<GalleryImage>>(`/gallery/${id}/toggle`));

export const deleteGalleryImage = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/gallery/${id}`));

export const uploadImage = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append('image', file);
  const { data } = await api.post<ApiEnvelope<{ url: string; filename: string }>>('/upload/single', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data.url;
};
