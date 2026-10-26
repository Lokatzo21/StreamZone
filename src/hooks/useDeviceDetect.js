import { useState, useEffect } from 'react';

/**
 * Custom hook for Multiplatform Device Detection & TV D-Pad Spatial Navigation
 * Specifically handles:
 * - Samsung Crystal UHD 4K AU7000 (Tizen 6.0, ARMv7 32-bit, 10-foot UI)
 * - POCO M6 Pro 5G / High Refresh Rate Mobile displays
 * - Tablets & Desktop screens
 */
export const useDeviceDetect = () => {
  const [deviceInfo, setDeviceInfo] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        isSmartTV: false,
        isTizenAU7000: false,
        isMobile: false,
        isPocoM6Pro: false,
        isTablet: false,
        isDesktop: true
      };
    }

    const ua = navigator.userAgent || '';
    const hasTvQuery = window.location.search.includes('tv=1') || window.location.search.includes('mode=tv');
    
    // Samsung Smart TV / Tizen OS signature detection
    const isSmartTV = hasTvQuery || /Tizen|SMART-TV|SmartTV|SamsungBrowser|KANTSU2E|Maple|HbbTV|CrKey|Large Screen|NetCast|Web0S/i.test(ua);
    const isTizenAU7000 = /Tizen 6\.0|KANTSU2E|UN65AU7000/i.test(ua) || (isSmartTV && /Tizen/i.test(ua));

    // Mobile detection (calibrated for POCO M6 Pro 5G and mobile viewports)
    const width = window.innerWidth;
    const isMobile = !isSmartTV && (width <= 768 || ('ontouchstart' in window && width <= 840));
    const isPocoM6Pro = isMobile && (/POCO|23129RA5FL|Xiaomi|Redmi/i.test(ua) || (width >= 380 && width <= 420 && window.devicePixelRatio >= 2.5));
    const isTablet = !isSmartTV && width > 768 && width <= 1024;
    const isDesktop = !isSmartTV && !isMobile && !isTablet;

    return {
      isSmartTV,
      isTizenAU7000,
      isMobile,
      isPocoM6Pro,
      isTablet,
      isDesktop
    };
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Apply class tags to root DOM for specific CSS adaptation rules
    if (deviceInfo.isSmartTV) {
      root.classList.add('device-tv');
      body.classList.add('device-tv');
      if (deviceInfo.isTizenAU7000) {
        root.classList.add('tizen-au7000');
        body.classList.add('tizen-au7000');
      }
    } else {
      root.classList.remove('device-tv', 'tizen-au7000');
      body.classList.remove('device-tv', 'tizen-au7000');
    }

    if (deviceInfo.isMobile) {
      root.classList.add('device-mobile');
      if (deviceInfo.isPocoM6Pro) root.classList.add('device-poco');
    } else {
      root.classList.remove('device-mobile', 'device-poco');
    }

    if (deviceInfo.isTablet) root.classList.add('device-tablet');
    else root.classList.remove('device-tablet');

    if (deviceInfo.isDesktop) root.classList.add('device-desktop');
    else root.classList.remove('device-desktop');

    // TV D-Pad Spatial Navigation Handler for remote controls
    if (deviceInfo.isSmartTV) {
      const handleKeyDown = (e) => {
        // Tizen Return / Back remote keycode is 10009
        if (e.keyCode === 10009 || e.key === 'Escape') {
          // If modal is open, let modal close handle it; otherwise history.back()
          const openModal = document.querySelector('.auth-modal-backdrop, .search-modal-backdrop, .profile-modal-backdrop');
          if (!openModal && window.history.length > 1) {
            e.preventDefault();
            window.history.back();
            return;
          }
        }

        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (!arrowKeys.includes(e.key)) return;

        const active = document.activeElement;
        const focusableSelector = 'button:not([disabled]), a[href], [tabindex="0"], input:not([disabled]), select:not([disabled])';
        const focusables = Array.from(document.querySelectorAll(focusableSelector))
          .filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
          });

        if (focusables.length === 0) return;

        if (!active || !focusables.includes(active)) {
          e.preventDefault();
          focusables[0].focus();
          focusables[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        const currentRect = active.getBoundingClientRect();
        const currentCenter = {
          x: currentRect.left + currentRect.width / 2,
          y: currentRect.top + currentRect.height / 2
        };

        let bestCandidate = null;
        let minDistance = Infinity;

        focusables.forEach(target => {
          if (target === active) return;
          const targetRect = target.getBoundingClientRect();
          const targetCenter = {
            x: targetRect.left + targetRect.width / 2,
            y: targetRect.top + targetRect.height / 2
          };

          const dx = targetCenter.x - currentCenter.x;
          const dy = targetCenter.y - currentCenter.y;

          let isMatch = false;
          if (e.key === 'ArrowRight' && dx > 15) isMatch = true;
          else if (e.key === 'ArrowLeft' && dx < -15) isMatch = true;
          else if (e.key === 'ArrowDown' && dy > 15) isMatch = true;
          else if (e.key === 'ArrowUp' && dy < -15) isMatch = true;

          if (isMatch) {
            // Distance calculation with directional weight
            const distance = Math.hypot(dx, dy) + (
              (e.key === 'ArrowLeft' || e.key === 'ArrowRight') ? Math.abs(dy) * 2 : Math.abs(dx) * 2
            );
            if (distance < minDistance) {
              minDistance = distance;
              bestCandidate = target;
            }
          }
        });

        if (bestCandidate) {
          e.preventDefault();
          bestCandidate.focus();
          bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [deviceInfo.isSmartTV, deviceInfo.isTizenAU7000, deviceInfo.isMobile, deviceInfo.isPocoM6Pro, deviceInfo.isTablet, deviceInfo.isDesktop]);

  return deviceInfo;
};
