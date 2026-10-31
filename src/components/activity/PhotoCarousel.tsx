// PhotoCarousel — slike jednog zapisa, jedna po jedna (S190).
// Mobitel: povlačenje lijevo/desno. Laptop: ‹ › na samoj slici (na dodirnom ekranu skrivene).
// Ista komponenta za karticu vježbe i traku slika u listi — dvije kopije bi se razišle.
import { useRef, useState } from 'react';

export interface CarouselPhoto { id: string; url: string; filename?: string | null }

interface Props {
  photos: CarouselPhoto[];
  /** Visina okvira — kartica želi manju sliku od galerije. */
  className?: string;
  startIndex?: number;
}

export function PhotoCarousel({ photos, className = 'aspect-video', startIndex = 0 }: Props) {
  const [i, setI] = useState(Math.min(startIndex, Math.max(0, photos.length - 1)));
  const start = useRef<{ x: number; y: number } | null>(null);
  const n = photos.length;
  if (n === 0) return null;
  const go = (d: number) => setI(cur => Math.max(0, Math.min(n - 1, cur + d)));

  return (
    <div className="space-y-1.5 select-none">
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-gray-100 ${className}`}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={e => { start.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={e => {
          const s = start.current;
          start.current = null;
          if (!s) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        }}
      >
        <img
          src={photos[i].url}
          alt={photos[i].filename ?? `Slika ${i + 1}`}
          draggable={false}
          className="w-full h-full object-contain"
        />
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={i === 0}
              aria-label="Prethodna slika"
              className="[@media(hover:none)]:hidden absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 border border-gray-200 text-lg leading-none disabled:opacity-30"
            >‹</button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={i === n - 1}
              aria-label="Sljedeća slika"
              className="[@media(hover:none)]:hidden absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 border border-gray-200 text-lg leading-none disabled:opacity-30"
            >›</button>
            <span className="absolute left-2 bottom-1.5 text-[11px] bg-white/85 rounded px-1.5 text-gray-600 tabular-nums">
              {i + 1} / {n}
            </span>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {photos.map((p, k) => (
            <span key={p.id} className={`w-1.5 h-1.5 rounded-full ${k === i ? 'bg-blue-600' : 'bg-gray-300'}`} />
          ))}
        </div>
      )}
    </div>
  );
}
