import { useEffect, useRef } from 'react';

/**
 * Fires onSwipeLeft (= Next) or onSwipeRight (= Prev) on horizontal touch swipe.
 * Ignores gestures where vertical movement exceeds horizontal (scroll).
 *
 * Sluša cijeli dokument ⇒ i povlačenje u komponenti s VLASTITIM povlačenjem (preglednik slika,
 * traka slika) bi mijenjalo stranicu (S191, T-S191-4: listanje slika u Viewu skakalo na Next).
 * Takva komponenta nosi `data-no-page-swipe`; dodir koji počne u njoj ovdje se ne broji.
 */
export function useTouchSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  minDelta = 50,
) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-no-page-swipe]')) {
        startX.current = null;
        startY.current = null;
        return;
      }
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (startX.current === null || startY.current === null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      startX.current = null;
      startY.current = null;
      if (Math.abs(dy) > Math.abs(dx)) return; // vertical scroll — ignore
      if (dx < -minDelta) onSwipeLeft();
      else if (dx > minDelta) onSwipeRight();
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, minDelta]);
}
