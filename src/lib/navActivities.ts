// ============================================================
// navActivities.ts — popis za Prev/Next koji putuje View → Edit → View (S171)
// ============================================================
// Saša (T-S171-4): „više njih redom" — View → Edit → Save → Next. Edit je popis
// gubio, pa je View nakon spremanja sam učitao cijelu Areu i Next je skakao po
// svemu (iz košare se to vidi odmah; iz liste rjeđe, jer je zamjenski popis sličan).
//
// ⚠ Save koji promijeni DATUM mijenja `session_start` retka. Bez zamjene u popisu
//   View ga ne nađe (`currentIndex = -1`) i ugasi i Prev i Next — zato se redak
//   u popisu ažurira, ne baca.
// ============================================================

import type { ActivityGroup } from '@/hooks/useActivities';

/** Isti trenutak, različit zapis (`+00:00` iz baze, `.000Z` iz `toISOString`). */
const sameInstant = (a: string | null, b: string | null) =>
  !!a && !!b && new Date(a).getTime() === new Date(b).getTime();

/**
 * Redak `oldSessionStart` (+ kategorija) dobiva `newSessionStart`. Ključ se
 * računa iznova istim oblikom kao `useActivities` (`user_category_session`).
 * Ništa ne odgovara ⇒ popis se vraća nepromijenjen.
 */
export function replaceSessionInNav(
  list: ActivityGroup[],
  oldSessionStart: string,
  newSessionStart: string,
  categoryId: string | null,
): ActivityGroup[] {
  return list.map(g => {
    if (!sameInstant(g.session_start, oldSessionStart)) return g;
    if (categoryId && g.category_id !== categoryId) return g;
    return {
      ...g,
      session_start: newSessionStart,
      sessionKey: `${g.user_id}_${g.category_id}_${newSessionStart}`,
      events: g.events.map(e => ({ ...e, session_start: newSessionStart })),
    };
  });
}

/** Popis iz `location.state` — ili `null` (izravan URL, F5). */
export function navFromState(state: unknown): ActivityGroup[] | null {
  const v = (state as { navActivities?: unknown } | null)?.navActivities;
  return Array.isArray(v) ? (v as ActivityGroup[]) : null;
}
