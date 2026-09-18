/**
 * Kljucevi `localStorage`-a vezani uz JEDNU bazu.
 *
 * /!\ ZASTO POSTOJI (S140, Sasin nalaz). `FilterContext` je pamtio filtar pod golim
 *     kljucem `events-tracker-filter-state`, a u njemu stoje `areaId` i cijeli
 *     `selectionChain` (objekti kategorija, s imenima). Kljuc nije nosio oznaku baze,
 *     pa su `npm run dev` (TEST) i `npm run dev:prod` (PROD) dijelili ISTI zapis.
 *
 *     Posljedica nije bila kozmeticka: nakon rada na PROD-u, TEST je pokazivao
 *     `Unknown > Transakcija`, praznu listu i traku „Nisam uspio ucitati postavke ove
 *     Aree", a „Pokusaj ponovno" nije pomagao — jer PROD-ov `areaId` na TEST-u nikad
 *     nece postojati. Aplikacija je izgledala POKVARENO, a podaci su bili netaknuti.
 *     Izmjereno istog dana: PROD `Transakcija` = `986a4612…`, TEST = `cde31231…`.
 *
 *     /!\ Ime kategorije se vidjelo IAKO retka nema, jer dolazi iz spremljenog
 *     `selectionChain`-a, ne iz baze. Zato je simptom izgledao kao kvar citanja, a ne
 *     kao stara snimka — i zato se dijagnoza triput otela prema bazi (koja je bila
 *     zdrava: `areas` 16 redaka, 0 padova u 8 pokusaja).
 */

/** Ref Supabase projekta iz `VITE_SUPABASE_URL` (`https://<ref>.supabase.co`). */
function projectRef(): string {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const host = url ? new URL(url).hostname : '';
    const ref = host.split('.')[0];
    return ref || 'unknown';
  } catch {
    // Neispravan ili odsutan URL ne smije srusiti citanje filtra — gori je pad
    // aplikacije nego filtar koji se ne pamti.
    return 'unknown';
  }
}

/**
 * Kljuc vezan uz bazu koju ovaj build gada.
 *
 * /!\ Jednom cisti i STARI, negranicen kljuc. Bez toga bi zauvijek lezao u pregledniku
 *     s id-evima druge baze i cekao sljedecu zabunu — a nitko ga nema odakle obrisati.
 *     Cijena je da se filtar jednom zaboravi, sto je pogodnost, ne podatak.
 */
export function dbScopedKey(base: string): string {
  try {
    localStorage.removeItem(base);
  } catch {
    /* private mode — nije bitno */
  }
  return `${base}:${projectRef()}`;
}
