# S170 — testovi (2026-10-13)

Filter by za `depends_on` atribute, `Rate?` bez broja rata, lazy Plotly/ExcelJS, zadano razdoblje,
Structure broji jednim RPC-om (`sql/057`).
Pregled: [PENDING_TESTS.md](../PENDING_TESTS.md#s170--filtar-izbornik-rate-bez-broja-lazy-plotlyexcel-structure-rpc-2026-10-13)

Brojke su izmjerene na TEST-u 13.10.2026. (`Financije_all`, kopija PROD-a iz S157 + kasnije izmjene na TEST-u).

## T-S170-1 ✅ (17.10., Saša: 370 = baza) Filter by `Izvor` je izbornik (TEST)

1. `npm run dev` (banner TEST), Area `Financije_all`, kategorija `Transakcija`, razdoblje This Year.
2. Filter by → `Izvor`.
3. **Očekivano:** izbornik (ne polje za tekst): `— All —, Racun, Visa, Cash, Mastercard`, ravan, bez ponavljanja.
4. Odaberi `Racun` ⇒ lista ~**355** redaka (svi `Racun`); na mobitelu isto.
- **Pad:** polje „filter by Izvor…", ili `Racun` dvaput.

## T-S170-2 ✅ Filter by `Podtip` grupiran po `Tip`u (TEST)

1. Kao gore, Filter by → `Podtip`.
2. **Očekivano:** izbornik s grupama (`Advokati`, `auto C5`, …, `Kuća`, …), unutar grupe abecedno; `N/A` i prazne grupe nema.
3. Odaberi `Kuća › Popravci, održavanje` ⇒ **18** redaka (stari tekstualni filtar `Popravci` davao je **30**, jer je hvatao i `auto C5 / popravci`).
4. Odaberi `gorivo` (pod `auto C5`) ⇒ **22** retka — filtar hvata gorivo **oba** auta (grupa je samo prikaz).
5. `Status` ⇒ ravan izbornik `Izvrsen, Planiran`.
- **Pad:** polje za tekst, ili 30 umjesto 18.

## T-S170-3 ✅ `Rate?` uključen bez broja rata (TEST)

1. Add Activity, `Financije_all > Transakcija`, Isplata 30,00, Izvor Mastercard, kvačica `Rate?`, `Broj rata` prazno.
2. Finish ⇒ **crvena poruka** *„"Rate?" je uključeno, a "Broj rata" je prazan — upiši broj rata (2 ili više) ili makni kvačicu."* Ništa nije spremljeno, forma ostaje.
3. Upiši `1` ⇒ Finish ⇒ ista poruka s „je 1".
4. Upiši `3` ⇒ Finish ⇒ rata modal (3 rate). Poništi/obriši testni redak.
- **Pad:** redak spremljen bez modala.

## T-S170-4 Brže otvaranje — Plotly i Excel se ne skidaju na početku (PROD, nakon deploya)

1. Desktop Chrome, DevTools → Network (JS), Ctrl+Shift+R na `/app`.
2. **Očekivano:** nema `vendor-plotly-*.js` ni `vendor-excel-*.js` u početnom učitavanju (prije: 1,4 MB + 0,26 MB gzipa).
3. Overview → „Kamo ide novac" ⇒ kratko „Učitavam krug…", pa krug; tek sada se pojavi `vendor-plotly`.
4. Activities → Export ⇒ kratko „Loading…", pa modal; isto Import, Structure Import, Structure Export i brisanje u Structureu.
5. **Kokin iPhone:** app se otvara osjetno brže (subjektivno; mjerenje je korak 2).
- **Pad:** modal se ne otvori, ili krug ostane na „Učitavam krug…".

## T-S170-5 ✅ Financije se otvaraju na This Year (TEST i PROD)

Kvar iz S166 koji je E2E otkrio ovdje: kad postavka Aree i granice podataka stignu istovremeno,
filtar je ostajao na **All Time**.
1. Odaberi `Financije_all`, F5 pet puta zaredom ⇒ svaki put Period = **This Year**.
2. Ručno All Time ⇒ Activities ⇒ Overview ⇒ ostaje All Time; F5 ⇒ This Year.
- **Pad:** bilo koji F5 ostane na All Time.

## T-S170-6 ✅ PROD: migracija `057` (Saša, SQL editor)

1. Supabase (PROD) → SQL editor → sadržaj `sql/057_category_event_counts.sql` → Run ⇒ `Success`.
2. Provjera u istom editoru: `select count(*), sum(n) from rpc_category_event_counts();` (kao `postgres` broji SVE evente — to je u redu; app ga zove kao korisnik, pa RLS vrijedi).
- Redoslijed s deployem **nije bitan**: bez funkcije app broji starim putem (čuva E2E `S170_structure_event_counts`).

## T-S170-7 ✅ Structure tab — jedan zahtjev za brojanje (PROD nakon 057 + deploya)

1. DevTools → Network, filtar `rpc_category` ⇒ Structure tab ⇒ **1** zahtjev po učitavanju.
2. Filtar `events?select=id` ⇒ **0** HEAD zahtjeva (prije: 39 po učitavanju; izmjereno na TEST-u 156 → 0 u istom toku).
3. Brojke `N events` / `no events yet` uz kategorije iste kao prije; `Transakcija` ne nudi Add Child (brava S24).

---

## Drugi dio sesije — Visa u traci (T2), T21, T12

## T-S170-8 PROD: Visa u config trake (Saša, POSLIJE deploya)

⚠ Tek nakon deploya: stari bundle ne zna `window`/`measure`, pa bi Visu računao neto i ±3 dana.
```powershell
cd C:\0_Sasa\events-tracker-react\data-prep_tools
$env:ET_TARGET='prod'; .\Financije\run.bat set_due_visa_S170.py
```
1. Zaglavlje `[PROD]`. Ispis „Visa „Planiran" po dospijeću" — redak s `← ODMAH U TRACI` je ono što će Koka vidjeti odmah.
   ⚠ Ako se pojavi stara košara **03.10.** (doba `next:3`), prvo izvod kroz `visa_uvoz_izvoda.py` (ispravlja datume), pa tek config.
2. `... set_due_visa_S170.py --apply --yes-prod` ⇒ `U bazi: Visa ✓ · ostale postavke netaknute ✓`.

## T-S170-9 PROD (~03.–11.11.): prva Visa košara u traci

1. Overview → traka „Čeka potvrdu": `Visa · naplata 05.11.2026. · N stavki`, Σ s oznakom **(samo isplate)**.
2. Brzi izbor dana: od **03.11.** do danas (najviše 11.11.).
3. Kad PBZ naplata sjedne na RF: dodir dana ⇒ sažetak ⇒ „Da, upiši" ⇒ RF redak opisa `Visa`, `Transfer / izmedju racuna`.
4. Kontrola: `visa_uvoz_izvoda.py` s tim izvodom kaže `RF naplata … ✓ već upisana` (ne dodaje drugi).
- **Pad:** Σ manji od PBZ naplate za iznos `PRIMLJENA UPLATA` (= neto), ili alat dodaje drugi redak naplate.

## T-S170-10 ✅ (17.10., Saša) TEST: uvoz ne traži kvačicu „potvrđeno" za kartični redak (T21)

1. `npm run dev`, `Financije_all`, Excel export retka **prije zadnjeg sidra** ZABA: jedan `Izvor = Mastercard`, jedan `Izvor = Racun`.
2. U fileu promijeni opis/iznos na oba ⇒ Import.
3. **Očekivano:** pregled javlja „potvrđeno" (i traži kvačicu) **samo za Racun** redak; MC redak je obična izmjena.
4. Ponovi s MC retkom kojem `Izvor` mijenjaš u `Racun` **i `Status` u `Izvrsen`** ⇒ kvačica se traži (ulazi u saldo).
   ⚠ Samo `Izvor → Racun` uz `Status = Planiran` kvačicu **ne** traži, i to je ispravno: saldo broji
   `Izvor = Racun` **i** `Status ≠ Planiran`, pa redak ni poslije izmjene ne ulazi u saldo (Saša 17.10.:
   opis testa bio je nepotpun, app točan).

## T-S170-11 ✅ TEST: delta sheet — Σ košara jednog dospijeća (T12)

1. Export → Delta (ZABA), file otvori u Excelu.
2. Kontrola košare: `Σ košara za naplatu (dan desno)` | Σ | **dan** (najbliže dospijeće, npr. 11.10. ili 11.11.).
3. Σ = samo retci s tim `Datum naplate`; upiši drugi dan (npr. 11.12.) ⇒ Σ se promijeni.
4. Kolona `Potvrda` (ako prozor nosi sidro): kartični retci u glavnom bloku **bez** oznake „potvrđeno".

**Dorada istog dana (Sašin prijedlog):** sekcija je složena po košarama; ispred svake košare redak-oznaka `naplata dd.mm.yyyy · n stavki` s gumbom `+`/`−` (1/2 = sve); dan uz Σ ima padajući izbornik; odabrana košara se oboji žuto. Otvaranje grupa po izboru datuma namjerno NE (formula ne može, makro ne radi na mobitelu).

## T-S170-12 `fill_from_izvod` vidi kontrolu košare i kad list nosi kolonu `Potvrda` (T12)

Delta sheet iz T-S170-11 (sa sidrom u prozoru) + `fill_from_izvod.py --zaba … --mc …` koji dopisuje kartične retke.
**Očekivano:** `Σ kosare prosirena do retka N` — **ne** „List nema kontrolu košare".
(Izmjereno na generiranom fileu 13.10.: `last_col = Potvrda`, `ctrl_col = Stanje (kontrola)`, svi rasponi do 99.)
