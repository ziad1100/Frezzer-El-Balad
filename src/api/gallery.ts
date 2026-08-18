import { api, unwrap } from '@/lib/api';
import type { ApiEnvelope, GalleryImage } from '@/types';

export const listGalleryImages = (): Promise<GalleryImage[]> =>
  unwrap(api.get<ApiEnvelope<GalleryImage[]>>('/gallery/public'));
