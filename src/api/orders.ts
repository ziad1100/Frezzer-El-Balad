import { api, unwrap } from '@/lib/api';
import type { ApiEnvelope, CartItemInput, Order, Paginated, SettingsMap } from '@/types';

export interface CreateOrderPayload {
  items: CartItemInput[];
  couponCode?: string;
  address: {
    label: string;
    city: string;
    street: string;
    building: string;
    apartment?: string;
    landmark?: string;
  };
  phone: string;
  notes?: string;
  paymentMethod: 'cash' | 'card';
}

export const createOrder = (payload: CreateOrderPayload): Promise<Order> =>
  unwrap(api.post<ApiEnvelope<Order>>('/orders', payload));

export const getMyOrders = (params: { page?: number; limit?: number } = {}): Promise<Paginated<Order>> =>
  unwrap(api.get<ApiEnvelope<Paginated<Order>>>('/orders/history', { params }));

export const cancelOrder = (id: string): Promise<Order> =>
  unwrap(api.post<ApiEnvelope<Order>>(`/orders/${id}/cancel`));

export const getSettings = (): Promise<SettingsMap> =>
  unwrap(api.get<ApiEnvelope<SettingsMap>>('/settings/public'));