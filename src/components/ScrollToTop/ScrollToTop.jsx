import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop Component
 * Ensures every navigation transition (movie details, catalog, watch page, episode changes, etc.)
 * reliably and automatically resets the scroll position to the very top (0, 0).
 */
const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Disable browser automatic scroll restoration to avoid scroll jumps
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const resetToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const appLayout = document.querySelector('.app-layout');
      if (appLayout) appLayout.scrollTop = 0;
    };

    // 1. Immediate scroll
    resetToTop();

    // 2. Next animation frame (after React reconciliation)
    const rafId = requestAnimationFrame(resetToTop);

    // 3. Fallback timeout (handles asynchronous React Suspense chunk loads)
    const timerId = setTimeout(resetToTop, 50);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [pathname, search]);

  return null;
};

export default ScrollToTop;
