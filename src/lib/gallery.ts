/**
 * Curated gallery — real dish photos from public/images/products.
 *
 * The set covers Frezzer El Balad's frozen food / meat / chicken catalog.
 */
export interface GalleryItem {
  src: string;
  /** i18n key under `gallery.items.*` used for both alt text and the caption. */
  label: string;
}

export const galleryItems: GalleryItem[] = [
  // Meat
  { src: '/images/products/flank-steak.jpg', label: 'flankSteak' },
  { src: '/images/products/steak.jpg', label: 'steak' },
  { src: '/images/products/minced-meat.jpg', label: 'mincedMeat' },
  // Liver
  { src: '/images/products/beef-liver.jpg', label: 'beefLiver' },
  { src: '/images/products/american-liver.jpg', label: 'americanLiver' },
  // Processed
  { src: '/images/products/oriental-sausage.jpg', label: 'orientalSausage' },
  { src: '/images/products/sausage.jpg', label: 'sausage' },
  { src: '/images/products/goulash.jpg', label: 'goulash' },
  // Burger & Kofta
  { src: '/images/products/burger.jpg', label: 'burger' },
  { src: '/images/products/balady-burger.jpg', label: 'baladyBurger' },
  { src: '/images/products/kofta.jpg', label: 'kofta' },
  { src: '/images/products/strips.jpg', label: 'strips' },
  // Chicken
  { src: '/images/products/wings.jpg', label: 'wings' },
  { src: '/images/products/shish.jpg', label: 'shish' },
  { src: '/images/products/pane.jpg', label: 'pane' },
  { src: '/images/products/mozzarella-pane.jpg', label: 'mozzarellaPane' },
  // Hawawshi
  { src: '/images/products/hawawshi.jpg', label: 'hawawshi' },
  { src: '/images/products/chicken-hawawshi.jpg', label: 'chickenHawawshi' },
  { src: '/images/products/rice-hawawshi.jpg', label: 'riceHawawshi' },
  { src: '/images/products/balady-hawawshi.jpg', label: 'baladyHawawshi' },
];
