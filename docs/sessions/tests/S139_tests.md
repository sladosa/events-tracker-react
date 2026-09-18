# S139 — detaljni koraci za otvorene testove

> ⚠ **Ovaj file je nastao tek u S140.** Ritual (korak 2) traži detaljne korake za svaki nov
> test, ali S139 ga nije napisao — pa je `PENDING_TESTS.md` upućivao na arhivu u kojoj
> `S139_tests.md` nikad nije ni postojao. Saša je to primijetio gledajući `docs/sessions/tests/`.
> Zatvoreni testovi S139 (`T-S139-1..7`, `-11`, `-13`) su izmjereni u samoj sesiji i ne
> ponavljaju se; ovdje su **samo tri koja čekaju ručnu potvrdu**, plus `T-S139-12` koji je
> u međuvremenu zatvoren.

---

## T-S139-8 — `ViewDetailsPage`: efekt premješten ispod deklaracije

**Što je promijenjeno:** `useEffect` koji zove `loadActivityData` preseljen je s mjesta
**iznad** deklaracije te funkcije na mjesto **ispod** nje (`3f23422`). Ponašanje bi trebalo
biti **identično** — efekti se ionako vrte nakon rendera. Test postoji zato što je to dirnulo
put kojim se otvara svaki View, a ne zato što se očekuje promjena.

**Preduvjeti:** `npm run dev` (banner mora pisati **TEST DATABASE**). PROD nije potreban —
ovo je čisto pitanje redoslijeda rendera, ne podataka.

**Koraci**

1. Activities tab, odaberi bilo koju Areu s barem 3 retka.
2. Na retku ⋮ → **View details**.
3. Provjeri da se redak **učitao**: vide se atributi, a ne „Activity not found" ni prazan ekran.
4. Klikni **Prev**, pa **Next**, pa opet **Prev** — barem tri puta.
5. Iz Viewa idi na **Edit**, **ništa ne mijenjaj**, pa se vrati (Cancel ili back).
6. Promijeni Areu u filtru, pa ponovo otvori View na nekom retku te Aree.

**Očekivano:** svaki put se redak učita; Prev/Next stvarno mijenja zapis; povratak iz Edita
pokazuje isti redak.

**Pad:** prazan ekran, „Activity not found" na koraku 3 ili 6, ili Prev/Next koji ne mijenja
ništa.

⚠ **NE prijavljivati kao pad ovog testa:** ako u Editu **promijeniš datum** retka (čime se
pomakne `session_start`), View zna javiti „Activity not found" dok se ne napravi F5. To je
**BUG-S131-VIEWSTALE**, poznat i otvoren, neponovljen, i **nema veze sa S139**. Zato korak 5
izričito kaže *ništa ne mijenjaj*.

---

## T-S139-9 — `ExcelExportModal`: izvoz uzima SADAŠNJE stanje, ne staro

**Što je promijenjeno:** `filters` je memoiziran (`useMemo`), a `doDownload` je u dep listu
dobio `filter.categoryId` i **`useProfileFilters`** (`0736d60`). Dok je `filters` bio goli
objektni literal, `doDownload` se stvarao iznova na svakom renderu — pa nepotpuna dep lista
**nije mogla zastarjeti**. Memoizacija taj štit uklanja, i zato se sada mjeri.

⚠ **Test mora ostati UNUTAR jednog otvaranja modala.** Zatvaranje i ponovno otvaranje
remontira komponentu i time **sakriva** baš kvar koji se traži — a usput resetira prekidač
„Koristi filtre iz profila" na uključeno (CLAUDE.md, § Excel).

**Preduvjeti:** Area koja **ima export profil s vlastitim filtrom** (na PROD-u `Financije_all`,
profil `Kokin_format` nosi `periodKey`). Na TEST-u profil treba prvo napraviti, pa je ovo
prirodnije provjeriti na PROD-u — izvoz **ništa ne piše u bazu**.

**Koraci**

1. U filter panelu postavi raspon na **All time** (da se razlikuje od profila).
2. Otvori **Export**.
3. Odaberi profil koji nosi vlastiti filtar (npr. `Kokin_format`).
4. Prekidač **„Koristi filtre iz profila" = uključen**. Zapiši broj iz retka
   *„… events will be exported"*. → **Download**.
5. **Bez zatvaranja modala** isključi prekidač. Broj se **mora promijeniti**. → **Download**.
6. Otvori oba filea i usporedi broj redaka.

**Očekivano:** brojka u koraku 5 se promijeni **odmah**, i drugi file ima **više** redaka
(All time) nego prvi (profilov uži raspon).

**Pad:** brojka se ne promijeni, ili se promijeni a **drugi file ipak ima iste retke kao
prvi** — to znači da je izvoz uzeo staro stanje prekidača, dakle točno kvar koji dep lista
sprječava.

⚠ Brojka i file moraju govoriti isto. Razilaženje to dvoje je **BUG-S129 razred** („brojka
mora opisivati file koji izlazi, ne panel") i prijavljuje se čak i ako su oba filea uredna.

---

## T-S139-10 — `hidden_in_add` preživi Structure roundtrip

**Što je promijenjeno:** `make_financije_all_structure.py` je dobio kolonu `HiddenInAdd`
(imao je 19 kolona uz komentar „redoslijed kao u app exportu", a app ih ima 23).

**Zašto je to bilo opasno:** `hidden_in_add` ne živi u vlastitoj postavci nego **unutar
`validation_rules`**, a taj se na UPDATE-u prepisuje **u cijelosti**. File bez te kolone daje
`newRules` bez ključa ⇒ zastavica se **tiho briše**.

**Stanje na PROD-u (izmjereno 2026-09-18, read-only):** točno **3** atributa nose
`hidden_in_add`, svi na kategoriji `Transakcija` u Arei `Financije_all`:

| atribut | slug |
| --- | --- |
| `Stanje` | `stanje` |
| `Valuta` | `valuta` |
| `Izvod opis` | `izvod_opis` |

### ⚠ BLOKADA — pročitati prije nego se išta uveze

**`Financije_all` je Kokina Area** (vlasnik `dubravka.pavic-sladoljev@…`), a Saša je na njoj
**write grantee** (izmjereno na PROD-u, `data_shares`).

1. Od S134 **grantee ne smije uređivati strukturu** — to je Sašina vlastita odluka (S133).
2. Gore od toga: `structureImport.ts:498` čita `areas` s `.eq('user_id', userId)`, pa uvoz
   Structure filea **tuđe** Aree ne mijenja nju nego **tiho stvara duplikat Aree istog imena**
   pod uvoznikom. Popravak toga je **otvorena stavka u Backlogu**, nije napravljen.

⇒ **Uvoz ide pod Kokinim računom, ili se ne radi.** Uvoz pod Sašinim dao bi drugi
`Financije_all` i izgledao bi uspješno.

**Koraci — dio A (bez rizika, može se odraditi odmah)**

1. Pod bilo kojim računom koji Areu **vidi**: Structure tab → **Export** za `Financije_all`.
2. Otvori xlsx, sheet `Structure`, nađi kolonu **`HiddenInAdd`**.
3. Provjeri da su **`Stanje`, `Valuta`, `Izvod opis`** označeni `TRUE`.

**Očekivano (A):** kolona postoji i nosi `TRUE` na ta tri retka. Ovo mjeri **app export**, koji
je i prije bio ispravan — služi kao polazno stanje i kao `--base` za dio B.

**Koraci — dio B (traži Kokin račun)**

4. Pokreni generator s tim exportom:
   `Tools\run.bat data-prep_tools\Financije\make_financije_all_structure.py --base <export.xlsx> --review <Financije_review_*.xlsx> --out <novi.xlsx>`
5. Otvori `<novi.xlsx>` i provjeri da **i on** ima `HiddenInAdd` = `TRUE` na ta tri retka.
   ⚠ **Ako ovdje padne, stani** — dio 6 bi tada obrisao zastavice.
6. **Pod Kokinim računom:** Structure → Import → `<novi.xlsx>`.
   ⚠ **Hard refresh (Ctrl+Shift+R) prije uvoza** — stari keširani bundle tiho osakati
   Structure import (S118).
7. Poslije uvoza: Add Activity u `Financije_all` → ta tri polja **ne smiju** biti vidljiva.

**Očekivano (B):** sva tri atributa i dalje imaju `hidden_in_add`; polja ostaju skrivena.

**Pad:** polja se pojave u Add formi ⇒ zastavica je obrisana ⇒ generator je ipak izašao bez
kolone ili s praznom vrijednošću.

⚠ **Uvoz i dalje NIJE popravljen** — bilo koji **drugi** Structure file bez kolone
`HiddenInAdd` (stariji export, ručno skraćen file, tuđi alat) i dalje briše zastavicu bez
ijedne poruke. To je otvorena stavka u Backlogu i ovaj test je **ne** zatvara.

---

## T-S139-12 — ✅ zatvoren u S140

E7-3 nije bio bug aplikacije nego tvrdnja napisana iz dizajna: `Confirm revoke` postoji samo
kad grantee **ima evente** u Arei. Isti uzrok rušio je i **E10-2**. Detalji su u CLAUDE.md
§ Open bugs i u commitu `8be1b50`.
