import { useEffect, useState } from 'react';

/**
 * Je li prozor širok barem `px` (prati promjenu širine).
 *
 * ⚠ Za ono što se NE SMIJE MONTIRATI na uskom ekranu — `hidden md:block` samo
 *   sakrije, a komponenta i dalje radi svoj posao: skine Plotly (1,4 MB gzipa) i
 *   pokrene vlastite upite (S170, Structure Sunburst). Za čisti izgled CSS je dosta.
 */
export function useMinWidth(px: number): boolean {
  const q = `(min-width: ${px}px)`;
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(q).matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(q);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- citanje-okoline: `px` se promijenio
    setWide(mq.matches);
    const on = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return wide;
}
