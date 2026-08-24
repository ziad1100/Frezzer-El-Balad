/**
 * Curated gallery — real dish photos from public/images/products.
 *
 * The set covers Welad Halal's frozen food / meat / chicken catalog.
 */
export interface GalleryItem {
  src: string;
  /** i18n key under `gallery.items.*` used for both alt text and the caption. */
  label: string;
}

export const galleryItems: GalleryItem[] = [
  // Meat
  { src: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&h=600&fit=crop', label: 'steak' },
  { src: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=600&h=600&fit=crop', label: 'flankSteak' },
  { src: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=600&h=600&fit=crop', label: 'mincedMeat' },
  // Liver
  { src: 'https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?w=600&h=600&fit=crop', label: 'beefLiver' },
  { src: 'https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?w=600&h=600&fit=crop', label: 'americanLiver' },
  // Processed
  { src: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&h=600&fit=crop', label: 'orientalSausage' },
  { src: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&h=600&fit=crop', label: 'sausage' },
  { src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=600&fit=crop', label: 'goulash' },
  // Burger & Kofta
  { src: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=600&fit=crop', label: 'burger' },
  { src: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&h=600&fit=crop', label: 'baladyBurger' },
  { src: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=600&fit=crop', label: 'kofta' },
  { src: 'https://images.unsplash.com/photo-1562967916-eb82221dfb44?w=600&h=600&fit=crop', label: 'strips' },
  // Chicken
  { src: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=600&h=600&fit=crop', label: 'wings' },
  { src: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=600&fit=crop', label: 'shish' },
  { src: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&h=600&fit=crop', label: 'pane' },
  { src: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&h=600&fit=crop', label: 'mozzarellaPane' },
  // Hawawshi
  { src: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&h=600&fit=crop', label: 'hawawshi' },
  { src: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&h=600&fit=crop', label: 'chickenHawawshi' },
  { src: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&h=600&fit=crop', label: 'riceHawawshi' },
  { src: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&h=600&fit=crop', label: 'baladyHawawshi' },
];
