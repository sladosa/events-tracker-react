// ============================================================
// dayDrillReturn.ts — razdoblje prije „isti dan u Activities ↗" (S172)
// ============================================================
// Košare ↗ postavljaju filtar na JEDAN dan (Custom). Bez povratka bi Overview
// nakon klika na tab ostao na tom danu: saldo bi pokazao stanje NA TAJ DAN, ne
// danas, a razrez samo taj dan — broj koji se ne slaže s bankom, bez greške
// (Sašin nalaz, 17.10.2026.).
//
// ⚠ Vraća se SAMO ako je filtar još onaj koji je ↗ postavio. Razdoblje koje je
//   čovjek u Activities promijenio sam je njegov izbor i ostaje.
// ⚠ Modul, ne storage — isti obrazac kao harmonika (`lastOpenTile`): preživi
//   odlazak u View i povratak (AppHome se odmontira), NE preživi F5.
// ⚠ Vraća se u HANDLERU taba, prije montiranja Overviewa — iz efekta u
//   OverviewTab-u pločice bi prvo učitale saldo za taj dan pa za današnji.
// ============================================================

import type { PeriodKey } from '@/hooks/useDateBounds';

export interface SavedPeriod {
  area: string;
  /** Dan koji je ↗ postavio (`dateFrom` = `dateTo`). */
  day: string;
  dateFrom: string | null;
  dateTo: string | null;
  periodLabel: string;
  periodKey: PeriodKey;
}

let saved: SavedPeriod | null = null;

export function rememberPeriodBeforeDay(s: SavedPeriod): void {
  saved = s;
}

/**
 * Što vratiti pri povratku na Overview, ili `null`. Zapamćeno se troši u svakom
 * slučaju — inače bi stara snimka čekala i vratila razdoblje nekom budućem povratku.
 */
export function takePeriodToRestore(cur: {
  areaId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  periodKey: PeriodKey;
}): SavedPeriod | null {
  const s = saved;
  saved = null;
  if (!s || s.area !== cur.areaId) return null;
  if (cur.periodKey !== 'custom' || cur.dateFrom !== s.day || cur.dateTo !== s.day) return null;
  return s;
}
