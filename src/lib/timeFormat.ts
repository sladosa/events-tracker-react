// ============================================================
// timeFormat.ts — trajanje u ljudski citljiv oblik
// ============================================================
//
// Izdvojeno iz `ActivityHeader.tsx` (S139). Dva razloga, oba izmjerena:
//   1. `formatDuration` je postojao DVAPUT, bajt u bajt isti — u `ActivityHeader`
//      (izvezen) i lokalno u `ViewDetailsPage.tsx:49`.
//   2. Izvoz ne-komponenti iz fajla s komponentom gasi Vite Fast Refresh za taj
//      fajl (`react-refresh/only-export-components`).
//
// /!\ Cista funkcija bez stanja: ako ikad zatreba druga jedinica ili jezik,
//     mijenja se OVDJE, a ne na dva mjesta koja se mogu razici.

export function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
