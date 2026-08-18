import { api, unwrap } from '@/lib/api';
import type { ApiEnvelope, ProductSize } from '@/types';

export interface CartServerItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn: string;
    images: string[];
    sizes: ProductSize[];
    slug: string;
  } | null;
  size: string | null;
  sizeName: string;
  extras: { name: string; nameEn: string; price: number }[];
  qty: number;
  unitPrice: number;
}

export interface ServerCart {
  items: CartServerItem[];
  couponCode: string;
}

export const getCart = (): Promise<ServerCart> =>
  unwrap(api.get<ApiEnvelope<ServerCart>>('/cart'));
