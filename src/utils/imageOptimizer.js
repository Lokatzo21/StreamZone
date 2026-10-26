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
    let targetSize = 'w500';
    if (width <= 200) targetSize = 'w185';
    else if (width <= 360) targetSize = 'w342';
    else if (width <= 600) targetSize = 'w500';
    else targetSize = 'w780';

    return url.replace(/\/t\/p\/(original|w\d+)\//, `/t/p/${targetSize}/`);
  }

  return url;
};

export const getOptimizedBackdropUrl = (url, isTV = false) => {
  if (!url || typeof url !== 'string') return url;

  // Optimize TMDB backdrop URLs
  if (url.includes('image.tmdb.org/t/p/')) {
    // On ARMv7 TV or standard screens, w1280 is sharp, HDR-capable and ~250KB (vs 12MB original!)
    const targetSize = isTV ? 'w1280' : 'w1280';
    return url.replace(/\/t\/p\/(original|w\d+)\//, `/t/p/${targetSize}/`);
  }

  return url;
};

export const generatePosterSrcSet = (url) => {
  if (!url || !url.includes('image.tmdb.org/t/p/')) return null;

  const baseUrl = url.replace(/\/t\/p\/(original|w\d+)\//, '/t/p/');
  return `${baseUrl}w342/ 342w, ${baseUrl}w500/ 500w, ${baseUrl}w780/ 780w`;
};
