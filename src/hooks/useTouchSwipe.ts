import { useEffect, useRef } from 'react';

/**
 * Fires onSwipeLeft (= Next) or onSwipeRight (= Prev) on horizontal touch swipe.
 * Ignores gestures where vertical movement exceeds horizontal (scroll).
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
