# PENDING TESTS

**Otvoreno: NE VODI SE OVDJE** -- vodi se iskljucivo u tablicama (`audit_tests.py`). Pravila filea: [na dnu](#o-ovom-fileu).

**Branch:** `test-branch` (dev) / `main` (PROD) · **Zadnji update:** S192 (2026-11-05, studeni krug Financija: T-S175-2/3 ✅, T-S175-1 do trake 11.11., T-S181-3 ✅; nalazi T39–T49 u `FINANCIJE_PROCES.md` §4) · povijest sesija: `DONE_HISTORY.md`

---

## S192 — Studeni krug Financija (ispit „dovoljno gotove") (2026-11-05)

Visa, ZABA i MC izvod 10/2026 zatvoreni u cent bez ručnog slaganja uvoznog filea; RF usklađen usporedbom Delta sheeta s bankom. Trenje kruga je zapisano kao T39–T49 (`docs/FINANCIJE_PROCES.md` §4) za sesiju održavanja — kod se u krugu nije mijenjao.

**Detalji testova:** [tests/S192_tests.md](tests/S192_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S192-1 | RF sidro kad Keks 22 € sjedne: banka = pločica **253,15** ⇒ Koka „u banci" 253,15, *ekran banke*, Potvrdi ⇒ saldo ostaje 253,15 | ⬜ |

---

## S191 — Testovi koraka 5, popravci (2026-11-01)

Uz T-S190: katalog (Name ispred Sluga, Group obavezan, istezanje / rotacija_kicme u Core, rolanje izvan kataloga — TEST usklađen `katalog.py --pravila --apply`); View: dug tekst se prelama ispod naziva.

**Detalji testova:** [tests/S191_tests.md](tests/S191_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S191-1 | View vježbe s dugim Description (mobitel): opis ispod naziva, preko cijele širine, prelama se, novi redovi ostaju; kratke vrijednosti (Slug, Type) i dalje desno | ✅ S191 (01.11., Saša, mobitel) — opis ispod naziva, prelama se; kratke desno. Korak 3 (druga Area) nije rađen — isti kod za sve Aree |
| T-S191-2 | Katalog ⇒ Add: Type `Strength`, Group `Upper-pull`, Name `Hand lateral raises` ⇒ „Slično u kategoriji“ je `lat_raises` (ne halo / bird_dog / squat…); promjena Typea ili Groupa popis ne mijenja | ✅ S191 (01.11., Saša) — slično: lat_raises, leg_raises, calf_raises (riječ „raises“); Upper-pull → Core i Strength → Mobility ne mijenjaju popis |
| T-S191-3 | View vježbe iz kataloga: nema retka s datumom ni vremena uz „Event #1“; Prev/Next u katalogu isto; View u `Financije_all` / `Fitness_Garmin` i dalje pokazuje datum i vrijeme | ✅ S191 (01.11., Saša) — katalog bez datuma i vremena, Prev/Next isto |
| T-S191-4 | View s fotografijama: dodir na sličicu otvara preglednik slika kao u Editu (1 / 2, ‹ › / povlačenje, ✕), ne novu karticu preglednika; **povlačenje u pregledniku lista slike, ne mijenja vježbu**; Next na drugi zapis zatvara ga | ✅ S191 (01.11., Saša, F12 mobilni) — 1. krug pao (povlačenje skakalo na Prev/Next) ⇒ `data-no-page-swipe`; 2. krug: preglednik, povlačenje lista slike, vježba ostaje |
| T-S191-5 | Katalog ⇒ Edit `lat_raises` (s opisom): „Slično“ više nije krugovi_ruke / carry / kosa_k_side (riječi opisa), nego vježbe sličnog imena (leg_raises, calf_raises — „Podizanje“) | ⬜ |
| T-S191-6 | **Pravi mobitel:** izbornik ⇒ kartica ⇒ Uredi vježbu ⇒ „Add" otvara STRAŽNJU kameru ⇒ slikaj ⇒ Spremi ⇒ kartica pokazuje sliku; ✕ na slici + Spremi ⇒ nema je. Usput Add treninga (prednja kamera, kao prije) i Edit (galerija) spremaju sliku | ⬜ S192: koraci 1–3 ✅ (stražnja kamera, slika u katalogu, Odustani ne briše); ✕ na dodiru NEVIDLJIV (pogađao se slučajno, dodir sredine otvara povećanje) ⇒ popravljeno, ponoviti korake 4–6 |

---

## S190 — Katalog vježbi i izbor vježbe (2026-10-31)

Korak 5 treninga na `test-branch` (TEST): Area `Katalog vježbi` (56 vježbi), jedinstven slug s prijedlogom iz imena i popisom sličnih, Edit bez vremena za Areu bez štoperice i datuma, postavka bez Event Note, tekst koji raste (sve Aree), izbornik iz druge Aree (skupine, najčešće u 12 mj, kartica prije izbora, uređivanje vježbe iz kartice), 📷 N u listi (sve Aree). Probna Area `S190 Trening proba`. Automatski: unit `uniqueOptionsFrom` 37, `catalogPicker` 13; E2E `S190_unique_catalog` 3, `S190_catalog_picker` 1 (sabotaže padaju).

**Detalji testova:** [tests/S190_tests.md](tests/S190_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S190-1 | Katalog ⇒ Add: ime „Hand lateral raises" ⇒ slug `hand_lateral` + „slično" `lat_raises`; slug `lat_raises` ⇒ crveno, Finish odbije; bez Event Note i datuma | ✅ S191 (01.11., Saša, mobitel) — koraci 2–8 očekivano (i novo: prazan Group ⇒ „Polje Group je obavezno“); nađeno: „slično“ je nudilo sve Strength/Upper vježbe a `lat_raises` ispao (Type/Group iz izbornika u sličnosti) ⇒ popravljeno S191, provjera T-S191-2 |
| T-S190-2 | Katalog ⇒ Edit `lat_raises`: bez datuma/vremena/Duration i Event Note; Description raste u nove retke (i u drugim Areama) | ✅ S191 (01.11., Saša) — očekivano; usput nađeno: View dug opis ne prelama (vrijednost `shrink-0`, naziv stisnut) ⇒ popravljeno S191, provjera T-S191-1 |
| T-S190-3 | `S190 Trening proba` ⇒ Add ⇒ izbornik: skupine, 6 + „Sve", dodir ⇒ kartica, Izaberi; Uredi vježbu ⇒ promjena skupine seli vježbu; poslije Finisha „1× u 12 mj" (mobitel i laptop) | ✅ S191 (01.11., Saša) — očekivano |
| T-S190-4 | Slike vježbe: Edit kataloga +2 slike ⇒ 📷 2 u listi, traka, povlačenje / ‹ ›; sličica i slike u kartici izbornika | ✅ S191 (01.11., Saša, F12 mobilni) — Edit +1 slika (2), 📷 2 ⇒ traka ispod retka, povlačenje, zatvaranje; izbornik: sličica s 2, kartica lista slike, Izaberi. Usput: View otvarao sliku u novoj kartici ⇒ T-S191-4 |
| T-S190-5 | Structure export: `AddNote` FALSE, Slug `Unique = from: name`, `vjezba` `OptionsFrom`; nepromijenjen uvoz = bez promjene | ⬜ |

---

## S181 — Excel roundtrip Financija s Namjenom (2026-10-24)

Namjena u profilu iza Podtipa. Na TEST-u izmjereno: izvoz identičan staromu (osim položaja stupca), roundtrip `0 · 0`, promjena Namjene = 1 Modify bez pitanja o potvrđenom stanju, delta formule ispravne. Nađen BUG-S181-DEPNAME (dropdown Namjene nudi Podtipove) i popravljen na `test-branch`; alati za izvode i Excel uvoz upisuju zadanu Namjenu na nove retke. Deploy 25.10. (S182): T-S181-2 i T-S181-4 ✅; ostaje T-S181-3 (studeni).

**Detalji testova:** [tests/S181_tests.md](tests/S181_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S181-1 | PROD pod Kokom: Ctrl+Shift+R ⇒ Import Profile `Claude-temp_R\s181\c_profil_namjena.xlsx` kao `Kokin_format` ⇒ toast „12 hidden cols … + filter overrides", Namjena iza Podtipa; Claude potvrdi da se promijenio samo `export_profiles` | ✅ S181 (24.10., Saša pod Kokom) — očekivani toast; PROD čitanjem: promijenio se samo `export_profiles`, i PROD = TEST poslije u svih 8 ključeva |
| T-S181-2 | PROD **poslije deploya**: Export `Kokin_format` (Download Excel) ⇒ u Excelu Namjena pod `Razno` nudi Zajedničko · Koka · Saša · Nena / Kućište (ne Podtipove), uz prazan Tip isto; Podtip pod `auto C5` nudi gorivo · leasing · popravci · registracija | ✅ S182 (25.10., Saša pod Kokom, Download Excel `Kokin_format`, 450 redaka) — Namjena pod `Razno` nudi 4 namjene, Podtip pod `auto C5` 4 podtipa; korak „prazan Tip" nije rađen ručno, čuva ga mjerenje S181 (`verify_dd.mjs`: uz prazan Tip 4 namjene) i `excelDependentRanges.test.mjs` |
| T-S181-4 | PROD **poslije deploya**, uz prvi Excel uvoz s novim retkom: Namjena ostavljena prazna ⇒ pregled kaže „Zadano iz pravila …: Namjena N (…)", u appu redak ima tu Namjenu; redak s upisanom Namjenom ostaje kakav je | ✅ S182 (25.10., Saša pod svojim računom, RF delta) — pregled `2 New · 0 Modify · 15 Unchanged` + „Namjena 1 (Zajedničko 1)"; baza: Passport 39 → Zajedničko, naknada 2,54 (upisano Saša) → Saša |
| T-S181-3 | Uz studeni krug (T-S175-1..3): `fill_from_izvod` ispiše `Namjena [PROD]: * → Zajedničko, auto C5 → Koka, auto Lacetti → Saša` i novi retci u `_filled` imaju Namjenu; `visa_uvoz_izvoda --file` isto (`Namjena novih redaka: …`) | ✅ S192 (05.11.) — `fill_from_izvod --zaba` ispisao točno taj redak; Visa file: 5/5 novih redaka s Namjenom (Šatrak `auto C5` → Koka), 0 od 42 praznih (pročitano openpyxl). MC bez novih redaka (0 · 54) ⇒ nije bilo što upisati |

---

## S175 — Čišćenje: studeni krug u tri testa, deset sekcija u arhivu (2026-10-19)

Testovi koji su čekali prvi mjesečni krug u studenom (MC, Visa, ZABA) iz osam sesija sažeti su u T-S175-1..3, a dva praćenja Kokinog mobitela u jedno pitanje (T-S175-4). T-S145-3 prepušten unosu BUG-S145-BOOLEDIT, T-S172-4 preseljen u BACKLOG. Sekcije S145–S173 (svih 10) su u `DONE_HISTORY.md`. Kod: Košare ↗ označava redak po povratku (T-S175-5); **F5** — sheet `AreaSettings` u Structure roundtripu, export = jedna Area (T-S175-6); „Create categories & continue" ne dira postojeću Areu (T-S175-7).

**Detalji testova:** [tests/S175_tests.md](tests/S175_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S175-1 | ~02.11.–11.11. PROD: MC_2026-10 kroz `fill_from_izvod --mc` (15 rata + 4 naknade sparene, KONTROLA ✓) ⇒ Koka uvozi `_filled` ⇒ ponovni prolaz 0/0 ⇒ 11.11. traka „pokaži kupnje" i Potvrdi; prvi MC plan „Zadnja rata…" | ⬜ S192 (05.11.): **A–C ✅** — 54/54 spareno, NOVI 0 (rate i naknade u ispravcima), Konzum 6/6 `~` 28,51 → 28,46; 2 Kokine kupnje 29./30.10. (30,12 + 2,60) nisu na izvodu ⇒ Datum naplate → 11.12. (ne `--brisi`, T47); uvoz 0 · 54 · 81, ponovni prolaz 0 · 0, KONTROLA ✓ 2.783,26. **Ostaje E (11.11., Koka):** traka MC Σ **2.783,26** → dan → Da, upiši. D (rata modal) nije se dogodio |
| T-S175-2 | ~03.–11.11. PROD: Visa košara u traci „(samo isplate)", Saša kao grantee vidi usporedbu bez gumba, Koka upiše naplatu, `visa_uvoz_izvoda` kaže „već upisana" i spari rate iz appa, ✓ u cent | ✅ S192 (05.11.) — k1, k3, k4 ✅: Koka „Ne — iznos…" 1.751,12 @ 05.11. (Σ trake 1.526,07); alat „RF naplata ✓ već upisana", Konzum 2/3 i Maxi Konzum 2/6 spareni, KONTROLA ✓; uvoz 5 · 37, ponovni 0 · 0, obje košare (05.10. razlika 34,74 = dvije kupnje od 03.10.) zatvorene. **k2 ❌** grantee ne vidi usporedbu ⇒ T39 (`FINANCIJE_PROCES.md` §4), test uz popravak |
| T-S175-3 | ZABA_2026-10: `fill_from_izvod --zaba` imenom, presedani iz `ET_TARGET`, MC naplata 11.10. preskočena (nikad nov redak), „Σ kosare prosirena" uz `Potvrda`, `promet_check` 2026-10 ✓ | ✅ S192 (05.11.) — presedani `(prod, …)` bez `--presedan`; MC naplata 11.10. među „već na listu"; `promet_check` 2026-10 Δ 1,60 ⇒ parking 01.11. upisan kao `Mastercard` ⇒ Edit `Racun` ⇒ **0,00 / 40**; sidro s ekrana 10.529,31. Alat bi uveo storno KEKS kao duplikat i nije vidio krivi Izvor ⇒ T45; uvoz nije trebao. „Σ kosare prosirena" nije mjereno (ZABA i MC odvojeno) |
| T-S175-4 | Pitanje Koki: od sredine listopada lista nikad bez iznosa i `+` uvijek iz prve? | ✅ S175 (19.10., Koka: „sve vidim ok") — nadiđeno upotrebom; zatvara i T-S168-4, T-S154-2 |
| T-S175-5 | Košare ↗ na kupnji ⇒ Activities taj dan ⇒ tab Overview ⇒ This Year, Košare otvorene **i ta kupnja označena** (lokalno TEST, pa PROD nakon deploya) | ✅ S175 (19.10., Saša, TEST) — ↗ s kupnje 04.10. (Visa ~05.11.) ⇒ povratak: označena ta kupnja; PROD isti kod, čuva E2E 3e |
| T-S175-6 | TEST: F5 — Structure export samo uz odabranu Areu; `Financije_all` ⇒ sheet `AreaSettings` 325 redaka; nepromijenjen uvoz ⇒ `Area settings changed (areas)` 0; promjena naslova pločice ⇒ 1 i pločica preimenovana | ✅ S176 (22.10., Saša, TEST) — export bez Aree javlja „Select an Area…"; `AreaSettings` do r. 326 + HELP; promjena naslova „Kamo ide novac TEST" ⇒ `Area settings changed 1 · Financije_all: dashboard`, i vraćanje naslova radi. Usput dvije želje (help po retku sheeta, os datuma na strani Prihodi) — v. BACKLOG |
| T-S175-7 | Activities uvoz „Create categories & continue" sa starim fileom: kategorija stvorena, a naslov pločice i opcije izbornika postojeće Aree ostanu novi | ✅ S175 — čuva E2E `S175_create_categories_keeps_area` (sabotaža vrati `Staro`) |

---

## S174 — Klasifikacija povijesti: uvozni guard + pravila po trgovcu (T17) (2026-10-18)

Uvoz više ne traži kvačicu „potvrđeno stanje" za razvrstavanje (samo bankino polje pita — isto pravilo kao Edit). 31 pravilo po trgovcu (AI predložio, Python prebrojao, Saša odobrio) je 4. ključ `razvrstaj_na.py`: starija povijest ZABA 38 → 70, RF 29 → 90 prijedloga (PROD snimka 18.10.).

**Detalji testova:** [tests/S174_tests.md](tests/S174_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S174-1 | Guard pita samo za bankino polje (unit `importConfirmedBankFields`, 10 tvrdnji) | ✅ S174 — čuva automatski test (protuprovjera i sabotaža ruše 4) |
| T-S174-2 | TEST lokalno: uvoz `na_razvrstavanje_kokin_tekuci_zaba_202401-202509_20261018_1628.xlsx` ⇒ 0 · 70 · 0, **bez** kutije „POTVRĐENOG stanja" (staro: 15); izmijenjen iznos jednog Racun retka ⇒ pita za 1 | ✅ S175 (19.10., Saša, TEST) — file s njegovim ručnim razvrstavanjem: `0 · 193 · 0` (+64 nepromijenjeno = 257; 70 prijedloga + ~123 ručno), **bez** kutije potvrđenog stanja; kopija s iznosom `Nena grijanje` 131,87→131,88 ⇒ kutija „1 redak je unutar POTVRĐENOG stanja" |
| T-S174-3 | PROD: starija povijest s pravilima (nasljeđuje T-S169-7) — ZABA 257 / 70 (32 pravila), RF 384 / 90 (61) ⇒ razvrstavanje ⇒ `--preuzmi` ⇒ uvoz pod Kokom, bez kutije potvrđenog stanja | ⬜ |
| T-S174-4 | Provjera unatrag po pravilu (PROD snimka): iz pravila 144/147 (98,0 %), 12 mj 54/56 | ✅ S174 — izmjereno (in-sample, v. detalje) |
| T-S174-5 | PROD, **POSLIJE uvoza T-S174-3**: Nenini retci — `ispravi_tip` ×2 (`Claude-temp_R/s174_pravila/nena_naredbe.ps1`) ⇒ Koka uvozi `0 · 36 · 0` (Transfer / Nena) i `0 · 5 · 0` (Razno / Nena's funds), saldo nepomaknut | ⬜ |

---

**Arhivirano u S137:** `S136` (svi testovi ✅) → `Claude-temp_R/test-sessions/archive/`. Zadnji je pao `T-S136-7`, potvrđen i popravljen 15.09. Narativ je u `DONE_HISTORY.md`.

## Arhivirane sekcije — pune tablice su u `DONE_HISTORY.md`

> **S175 (2026-10-19): deset sekcija** — `S145`, `S154`, `S156`, `S158`, `S161`, `S168`, `S170`, `S171`, `S172`, `S173` (+ detaljni fileovi u arhivu). Nijedan test nije zatvoren procjenom: studeni testovi su **sažeti** u T-S175-1..4 (kriterij „sažimanje", S136 — isti budući događaj, deset ID-eva), T-S145-3 prepušten unosu u Open bugs, T-S172-4 BACKLOG-u. 11 fileova → 2.

> **S148 (2026-09-24): sekcija `S148`** (+ `S148_tests.md` u arhivu) — svih 5 testova zatvoreno mjerenjem u istoj sesiji.

> **S147 (2026-09-24): još četiri sekcije** — `S131`, `S108`, `S137`, `S146` (+ detaljni `S108`/`S137`/`S146_tests.md` u arhivu). Osam testova zatvoreno **izvođenjem** (hrpa B na `dev:prod`, `T-S137-8` na TEST-u, `T-S146-1` ponovljenim E2E runom), nijedan procjenom. PENDING **299 → 113** redaka. ⚠ Redak „Otvoreno (S131)" nabrajao je **22** testa koji su u tablici već bili ✅ — ručni popis uz tablicu, razred koji je S116 ukinuo samo za zaglavlje.

> **S146 (2026-09-23): još šest sekcija** — `S130`, `S135`, `S107c`, `S107d`, `S107i`, `S107j`. **Osam** zatvorenih testova: četiri S107 po kriteriju *stari pipeline / nadiđeno novijom sesijom* · T-S135-11 jer ga je **S140 istražio** a status je ostao „neistrazeno" · T-S130-10 po **šestom kriteriju, ZASTARJELO**, uvedenom u ovoj sesiji · T-S130-9 **preseljen** u CLAUDE.md § Delta sheet jer je **odluka, ne test** — i na njega se šesti kriterij namjerno **ne** primjenjuje.

> **20 sekcija (588 redaka) preseljeno u `DONE_HISTORY.md` u S140.** Ovdje ostaje samo
> ono s **otvorenim** testovima, da se „sto jos treba" vidi bez skrolanja.
>
> /!\ Ovo NIJE krsenje pravila „retci se ne brisu, nego dobivaju ✅ + razlog" (S136) —
> retci su prezivjeli u cijelosti, samo u drugom fileu, i pretraga po ID-u ih i dalje
> nalazi. Oba filea su u `docs/sessions/`, pa su relativni linkovi na detaljne fileove
> presli nedirnuti.
>
> /!\ **Kriterij za selidbu nije bio „sekcija je zelena"** — to je izmjereno kao NESIGURNO:
> `T-S134-16` zivi pod sekcijom **S135**, dakle retci migriraju izmedju sekcija. Selile su
> samo sekcije koje (a) nemaju nijedan ⬜ i (b) ne drze **jedini** redak za test cijem
> session fileu jos ima zivih testova. Bez uvjeta (b) bi `audit_tests.py` za takav test
> javio „PENDING nema redak za" — dakle zamijenili bismo jedan sum drugim.

---

## O ovom fileu

> ⚠ Redak `**Otvoreno: NE VODI SE OVDJE**` mora ostati na VRHU filea, izvan svake sekcije
> (S146) — `audit_tests.py` ga traži; da ode sa sekcijom u arhivu, audit javi fantomske
> proturječnosti. Ova objašnjenja su preseljena na dno u S162 (Saša: uvod je bio predug za
> skrolanje do testova); stari lanac „Zadnji update … Ranije: …" je povijest i živi u `DONE_HISTORY.md`.

> **Arhivirani session fileovi izlaze iz gita** (ritual, korak 3): sele u
> `Claude-temp_R/test-sessions/archive/`, koji je gitignoriran. Linkovi na njih zato
> pokazuju izvan repoa i rade samo lokalno.
> 
> /!\ Do S139 arhiviranje **nije diralo linkove**, pa ih je 21 od 30 pokazivao u prazno
> (`tests/S111_tests.md` i dalje, svi postojeci u arhivi). Mrtav link se cita kao
> „tog dokaza vise nema", a dokaz je cijelo vrijeme bio na disku.

> 
> /!\ **Od S140 sekcija napusta ovaj file ZAJEDNO sa svojim detaljnim fileom** (ritual,
> korak 3). Do tada se arhivirao samo `tests/SXX_tests.md`, a sekcija je ostajala — pa je
> dokument rastao zauvijek i polovica mu je bila zatvoreni posao.



> Kurirani popis je ukinut u **S116** jer se odrzavao rukom i razilazio s tablicama
> (propustao je 60 testova). Stanje mjeri `python data-prep_tools/Tools/audit_tests.py`.
>
> /!\ **Ovaj redak mora ostati u ZAGLAVLJU** (S146). Do tada je stajao unutar sekcije
> `S120` i **otisao s njom u arhivu** — nakon cega je audit istog trena prijavio
> **8 fantomskih proturjecnosti**, jer bez markera usporedjuje tablice s *praznim*
> kuriranim popisom. To je razred koji je S139 vec jednom zatvorio, ozivljen
> **selidbom, ne izmjenom** (isti razred kao samoreferenca u `DONE_HISTORY.md`).
