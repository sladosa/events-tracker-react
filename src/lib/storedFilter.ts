/**
 * Zapamceni filtar (Area + lanac kategorija + shortcut) — tko ga smije obnoviti.
 *
 * /!\ ZASTO POSTOJI (S160, Sasin nalaz 03.10. pri testiranju). `dbScopedKey` (S140)
 *     veze kljuc uz BAZU, ali ne uz KORISNIKA. Prijava drugog racuna u istom
 *     pregledniku obnovila je tudji `areaId` ⇒ zuta traka „Nisam uspio ucitati
 *     postavke ove Aree" i prazan Structure — isti simptom kao S140, drugi uzrok.
 *     Saša testove vlasnika radi pod Kokinim racunom u svom pregledniku, pa ovo
 *     nije rubni slucaj nego redovni tok.
 *
 * /!\ Zapis BEZ `userId` (snimljen prije S160) se ODBACUJE, ne prihvaca. Prihvatiti
 *     ga znaci da prvo spremanje na njega utisne TRENUTNOG korisnika — dakle tudji
 *     filtar postane „moj", tocno kvar koji se zatvara. Cijena je da se filtar
 *     jednom zaboravi (isti dogovor kao `dbScopedKey`).
 *
 * /!\ Nepoznat korisnik (`userId === null`) ne obnavlja nista: bez identiteta se ne
 *     zna je li zapis njegov, a krivo obnovljen filtar izgleda kao kvar baze.
 */
import type { Category } from '@/types';

export interface StoredFilterState {
  userId: string | null;
  areaId: string | null;
  selectionChain: Category[];
  selectedShortcutId: string | null;
}

/** Vrati zapis samo ako je snimljen pod OVIM korisnikom; inace `null`. */
export function parseStoredFilter(raw: string | null, userId: string | null): StoredFilterState | null {
  if (!raw || !userId) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const s = parsed as Partial<StoredFilterState>;
  if (s.userId !== userId) return null;
  return {
    userId: s.userId,
    areaId: s.areaId ?? null,
    selectionChain: Array.isArray(s.selectionChain) ? s.selectionChain : [],
    selectedShortcutId: s.selectedShortcutId ?? null,
  };
}
