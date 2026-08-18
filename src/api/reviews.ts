import { api, unwrap } from '@/lib/api';
import type {
  ApiEnvelope,
  EligibleOrder,
  OrderReviewState,
  PaginatedReviews,
  PendingReviewOrder,
  Review,
  ReviewSummary,
} from '@/types';

export interface ReviewListQuery {
  page?: number;
  limit?: number;
}

export const listMealReviews = (productId: string, params: ReviewListQuery = {}): Promise<PaginatedReviews> =>
  unwrap(api.get<ApiEnvelope<PaginatedReviews>>(`/reviews/meal/${productId}`, { params }));

export const getRestaurantStats = (): Promise<ReviewSummary> =>
  unwrap(api.get<ApiEnvelope<ReviewSummary>>('/reviews/restaurant'));

export const getOrderReviewState = (orderId: string): Promise<OrderReviewState> =>
  unwrap(api.get<ApiEnvelope<OrderReviewState>>(`/reviews/order/${orderId}`));

export const getPendingReviewOrders = (): Promise<PendingReviewOrder[]> =>
  unwrap(api.get<ApiEnvelope<PendingReviewOrder[]>>('/reviews/pending-orders'));

export const getReview = (id: string): Promise<Review> =>
  unwrap(api.get<ApiEnvelope<Review>>(`/reviews/${id}`));

export const getEligibleOrders = (productId: string): Promise<EligibleOrder[]> =>
  unwrap(api.get<ApiEnvelope<EligibleOrder[]>>(`/reviews/eligible/${productId}`));

export interface ReviewCreatePayload {
  product: string;
  orderId: string;
  rating: number;
  comment?: string;
}

export const createMealReview = (payload: ReviewCreatePayload): Promise<Review> =>
  unwrap(api.post<ApiEnvelope<Review>>('/reviews', payload));

export interface QuickReviewCreatePayload {
  product: string;
  rating: number;
  comment?: string;
}

export const createQuickReview = (payload: QuickReviewCreatePayload): Promise<Review> =>
  unwrap(api.post<ApiEnvelope<Review>>('/reviews/quick', payload));

export interface RestaurantReviewCreatePayload {
  orderId: string;
  rating: number;
  comment?: string;
  foodQuality?: number;
  delivery?: number;
  packaging?: number;
  service?: number;
  overall?: number;
}

export const createRestaurantReview = (payload: RestaurantReviewCreatePayload): Promise<Review> =>
  unwrap(api.post<ApiEnvelope<Review>>('/reviews/restaurant', payload));

export interface ReviewUpdatePayload {
  rating?: number;
  comment?: string;
  foodQuality?: number;
  delivery?: number;
  packaging?: number;
  service?: number;
  overall?: number;
}

export const updateReview = (id: string, payload: ReviewUpdatePayload): Promise<Review> =>
  unwrap(api.patch<ApiEnvelope<Review>>(`/reviews/${id}`, payload));

export const deleteReview = (id: string): Promise<null> =>
  unwrap(api.delete<ApiEnvelope<null>>(`/reviews/${id}`));

export const getMyReviews = (params: ReviewListQuery = {}): Promise<PaginatedReviews> =>
  unwrap(api.get<ApiEnvelope<PaginatedReviews>>('/reviews/my', { params }));