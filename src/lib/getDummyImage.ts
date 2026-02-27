/**
 * Kategori slug'ına göre dummy resim URL'i ve alt metni döndürür
 */
export function getDummyImageForCategory(categorySlug: string | undefined, title: string): { url: string; alt: string } | null {
  if (!categorySlug) return null;

  // Kategori slug'larına göre dummy resimleri eşleştir
  const dummyImages: Record<string, string> = {
    'saat-bilgileri': 'https://cms.hizliulasim.com/wp-content/uploads/2026/01/saat-bilgileri.jpg',
    'otobus-hatlari': 'https://cms.hizliulasim.com/wp-content/uploads/2026/02/otobus-hatlari.jpeg',
    // Buraya daha fazla kategori eklenebilir
    // 'baska-kategori': 'https://cms.hizliulasim.com/wp-content/uploads/2026/01/baska-kategori.jpg',
  };

  const imageUrl = dummyImages[categorySlug];
  
  if (imageUrl) {
    return {
      url: imageUrl,
      alt: title,
    };
  }

  return null;
}
