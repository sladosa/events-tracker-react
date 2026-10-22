# PENDING TESTS

**Otvoreno: NE VODI SE OVDJE** -- vodi se iskljucivo u tablicama (`audit_tests.py`). Pravila filea: [na dnu](#o-ovom-fileu).

**Branch:** `test-branch` (dev) / `main` (PROD) · **Zadnji update:** S179 (2026-10-22, F1 faza u Structure uvozu — pregled, Primijeni, Poništi; `namjena` na TEST-u) · povijest sesija: `DONE_HISTORY.md`

---

## S179 — Preuređivanje u Structure uvozu: pregled, Primijeni, Poništi (2026-10-22)

Popunjen sheet `Preuređivanje` više se ne javlja kao „NIJE primijenjeno" — uvoz ga predaje modalu, koji ga planira nad svježom snimkom, pokaže korake s brojkama i primjerima, i primjenjuje uz kvačicu; Poništi u istom prozoru. Ponovno mjerenje provjerava da je baza točno ono što je pregled predvidio. Na TEST-u (kopija PROD-a) pod vlasnikom: 9.743 promjene, apply 2,4–4,4 s, undo 1,9–3,2 s.

**Detalji testova:** [tests/S179_tests.md](tests/S179_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S179-1 | TEST lokalno: `structure_s179.xlsx` ⇒ pregled 10 koraka / 9.743 / 5.448 (brojke po koraku u detaljima) ⇒ Apply ⇒ „exactly what the preview predicted" ⇒ druga kartica `Audible` 68, pločica `RF račun`, saldo isti ⇒ Undo ⇒ „exactly what it was before", `Audible` 0 | ✅ S179 (22.10., Saša, TEST lokalno) — sve brojke po koraku točne; Apply **4,9 s**, provjera 13,6 s; druga kartica: izbornik samo `Audible`, `Audible` 68 (All Time), `RF račun` 905,45 € uz sidro 11.10. 878,09 € i povijest (6), Košare `VISA · ~05.11.` pod `RF račun`; Undo 9.752 / 2,2 s / provjera ✓; poslije: `Sašin tekući RF` 905,45 €, `Audible_Koka`/`_Sasa` natrag |
| T-S179-2 | TEST: razmak na kraju vrijednosti ⇒ crvena greška, nema Apply, ništa upisano | ✅ S179 (22.10., Saša) — razmak u koracima 1 i 2 ⇒ dvije crvene greške, bez kvačice i Apply; zaglavlje 9.675 promjena (bez ta dva koraka) |
| T-S179-3 | TEST: Add forma — `Namjena` tek uz Tip; `Zabava` ⇒ Zajedničko, `auto Lacetti` ⇒ Saša, `auto C5` ⇒ Koka | ✅ S179 (22.10., Saša) — `Zabava` ⇒ Zajedničko, `auto Lacetti` ⇒ Saša, polje ispod Statusa; `auto C5` nije snimljen (isti mehanizam, `default_map`) |
| T-S179-4 | E2E: sheet s preimenovanjem ⇒ lista novi naziv ⇒ Poništi ⇒ stari | ✅ S179 — čuva automatski test (`S179_restructure_apply_undo`, protuprovjera pada) |
| T-S179-5 | `preuredjivanje_grep.py` nad `structure_s179.xlsx` ⇒ 71 jak pogodak; za PROD korake `set_breakdown.py` 92/113/125, `uvezi_transu.py:72` | ✅ S179 — izmjereno |
| T-S179-6 | PROD puštanje §16: backup ⇒ sonda `-` ⇒ `058` ⇒ sonda DA/NE ⇒ deploy ⇒ `namjena` uvozom ⇒ sheet §8.2 pod Kokom ⇒ saldo nepomaknut, `N/A` isti, grep ispravljen | ⬜ |

---

## S175 — Čišćenje: studeni krug u tri testa, deset sekcija u arhivu (2026-10-19)

Testovi koji su čekali prvi mjesečni krug u studenom (MC, Visa, ZABA) iz osam sesija sažeti su u T-S175-1..3, a dva praćenja Kokinog mobitela u jedno pitanje (T-S175-4). T-S145-3 prepušten unosu BUG-S145-BOOLEDIT, T-S172-4 preseljen u BACKLOG. Sekcije S145–S173 (svih 10) su u `DONE_HISTORY.md`. Kod: Košare ↗ označava redak po povratku (T-S175-5); **F5** — sheet `AreaSettings` u Structure roundtripu, export = jedna Area (T-S175-6); „Create categories & continue" ne dira postojeću Areu (T-S175-7).

**Detalji testova:** [tests/S175_tests.md](tests/S175_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S175-1 | ~02.11.–11.11. PROD: MC_2026-10 kroz `fill_from_izvod --mc` (15 rata + 4 naknade sparene, KONTROLA ✓) ⇒ Koka uvozi `_filled` ⇒ ponovni prolaz 0/0 ⇒ 11.11. traka „pokaži kupnje" i Potvrdi; prvi MC plan „Zadnja rata…" | ⬜ |
| T-S175-2 | ~03.–11.11. PROD: Visa košara u traci „(samo isplate)", Saša kao grantee vidi usporedbu bez gumba, Koka upiše naplatu, `visa_uvoz_izvoda` kaže „već upisana" i spari rate iz appa, ✓ u cent | ⬜ |
| T-S175-3 | ZABA_2026-10: `fill_from_izvod --zaba` imenom, presedani iz `ET_TARGET`, MC naplata 11.10. preskočena (nikad nov redak), „Σ kosare prosirena" uz `Potvrda`, `promet_check` 2026-10 ✓ | ⬜ |
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
