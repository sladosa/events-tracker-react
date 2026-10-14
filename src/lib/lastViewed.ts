// ============================================================
// lastViewed.ts — koji je redak zadnji prikazan u View-u (S171, T-S171-4)
// ============================================================
// Saša: „teško je prepoznati iz kojeg si eventa došao natrag". View ovdje
// upisuje ključ retka na kojem je čovjek STAO — i nakon Prev/Next — a pločica
// Košare ga označi. Modul, ne `location.state`: Back preglednika i swipe na
// iPhoneu state ne nose, a stari `highlightKey` ostaje u povijesti i označio bi
// krivi redak. F5 ga briše, kao i ostalo pamćenje Overviewa.
// Ključ je oblik `useActivities` (`user_category_session` ili event id).
// ============================================================

let lastViewedKey: string | null = null;

export function setLastViewed(key: string | null): void {
  lastViewedKey = key;
}

export function getLastViewed(): string | null {
  return lastViewedKey;
}
