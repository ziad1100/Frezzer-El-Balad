import { api, unwrap } from '@/lib/api';
import type { ApiEnvelope, Category, Paginated, Product } from '@/types';

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  section?: string;
  tag?: string;
  bestSeller?: boolean;
  offer?: boolean;
  slug?: string;
}

export const listProducts = (params: ProductQuery = {}): Promise<Paginated<Product>> =>
  unwrap(api.get<ApiEnvelope<Paginated<Product>>>('/products', { params }));

export const getProduct = (slug: string): Promise<Product> =>
  unwrap(api.get<ApiEnvelope<Product>>(`/products/${slug}`));

export const listCategories = (): Promise<Category[]> =>
  unwrap(api.get<ApiEnvelope<Category[]>>('/categories'));

export const getBestSellers = (): Promise<Product[]> =>
  unwrap(api.get<ApiEnvelope<Product[]>>('/products/best-sellers'));

export const getOffers = (): Promise<Product[]> =>
  unwrap(api.get<ApiEnvelope<Product[]>>('/products/offers'));