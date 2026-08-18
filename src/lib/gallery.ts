/**
 * Curated gallery — real dish photos from public/images/products.
 *
 * Every entry must reference an existing file; the seed guard test
 * (server/src/database/seedData.test.ts) fails loudly if any goes missing,
 * so the gallery can never ship a broken image.
 *
 * The set is intentionally varied across the menu — pizzas, crepes, feteer,
 * rocket rolls, hawawshi, tagine, pasta, seafood, meat and desserts — rather
 * than a wall of near-identical pizzas.
 */
export interface GalleryItem {
  src: string;
  /** i18n key under `gallery.items.*` used for both alt text and the caption. */
  label: string;
}

export const galleryItems: GalleryItem[] = [
  // Pizzas
  { src: '/images/products/margherita-cheese.jpg', label: 'margherita' },
  { src: '/images/products/chicken-bbq-chicken.jpg', label: 'bbqChicken' },
  { src: '/images/products/fajita-chicken.jpg', label: 'fajita' },
  { src: '/images/products/vegetables-cheese.jpg', label: 'vegetables' },
  // Chicken & grilled
  { src: '/images/products/strips-chicken.jpg', label: 'strips' },
  { src: '/images/products/kofta-meat.jpg', label: 'kofta' },
  { src: '/images/products/chicken-hawawshi-hawawshi.jpg', label: 'hawawshi' },
  { src: '/images/products/chicken-tagine-tagine.jpg', label: 'tagine' },
  // Seafood
  { src: '/images/products/shrimp-seafood.jpg', label: 'shrimp' },
  { src: '/images/products/tuna-seafood.jpg', label: 'tuna' },
  // Cheese & sides
  { src: '/images/products/mozzarella-cheese.jpg', label: 'mozzarella' },
  { src: '/images/products/cheddar-potato-appetizers.jpg', label: 'potato' },
  // Pasta
  { src: '/images/products/chicken-pasta-pasta.jpg', label: 'pasta' },
  // Meat & mixes
  { src: '/images/products/meat-mix-mix.jpg', label: 'meatMix' },
  { src: '/images/products/beef-meat.jpg', label: 'beef' },
  // Egyptian breads & rolls
  { src: '/images/products/meshaltet-butter-meshaltet.jpg', label: 'meshaltet' },
  { src: '/images/products/sausage-kiri-rocket-roll.jpg', label: 'sausageRoll' },
  { src: '/images/products/beef-rocket-roll.jpg', label: 'beefRocketRoll' },
  // Sweet feteer & desserts
  { src: '/images/products/kunafa-sweet-feteer.jpg', label: 'kunafa' },
  { src: '/images/products/basbousa-kunafa-sweet-feteer.jpg', label: 'basbousa' },
  { src: '/images/products/chocolate-oreo-sweet-feteer.jpg', label: 'oreoChocolate' },
  { src: '/images/products/chocolate-banana-sweet-feteer.jpg', label: 'chocolateBanana' },
  { src: '/images/products/lotus-sweet-feteer.jpg', label: 'lotus' },
  { src: '/images/products/white-chocolate-sweet-feteer.jpg', label: 'whiteChocolate' },
];
