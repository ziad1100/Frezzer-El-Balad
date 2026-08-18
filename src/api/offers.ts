import { api, unwrap } from '@/lib/api';
import type { ApiEnvelope, Offer, Product } from '@/types';

export type OfferWithProducts = Omit<Offer, 'products'> & { products: Product[] };

export const getActiveOffers = (): Promise<OfferWithProducts[]> =>
  unwrap(api.get<ApiEnvelope<OfferWithProducts[]>>('/offers/active'));

export const getOffer = (id: string): Promise<OfferWithProducts> =>
  unwrap(api.get<ApiEnvelope<OfferWithProducts>>(`/offers/${id}`));
