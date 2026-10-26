/**
 * Image Optimizer utility for Streamzona
 * Dynamically selects optimal TMDB image dimensions to ensure:
 * 1. Ultra-fast initial page loads (LCP < 1.2s)
 * 2. Mobile data savings (especially on FHD+ phones like POCO M6 Pro 5G)
 * 3. Smooth decoding without OOM on 32-bit ARMv7 Smart TVs (Samsung AU7000)
 */

export const getOptimizedPosterUrl = (url, width = 500) => {
  if (!url || typeof url !== 'string') return url;
  
  // Optimize TMDB poster URLs
  if (url.includes('image.tmdb.org/t/p/')) {
    // Available TMDB poster widths: w92, w154, w185, w342, w500, w780, original
    const targetSize = width <= 360 ? 'w342' : 'w500';
    return url.replace(/\/t\/p\/(original|w\d+)\//, `/t/p/${targetSize}/`);
  }

  return url;
};

export const getOptimizedBackdropUrl = (url, isTV = false) => {
  if (!url || typeof url !== 'string') return url;

  // Optimize TMDB backdrop URLs
  if (url.includes('image.tmdb.org/t/p/')) {
    // w1280 is crisp 1080p/4K HDR capable and ~200KB (vs 12MB original!)
    return url.replace(/\/t\/p\/(original|w\d+)\//, '/t/p/w1280/');
  }

  return url;
};
