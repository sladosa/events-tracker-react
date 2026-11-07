# PENDING TESTS

**Otvoreno: NE VODI SE OVDJE** -- vodi se iskljucivo u tablicama (`audit_tests.py`). Pravila filea: [na dnu](#o-ovom-fileu).

**Branch:** `test-branch` (dev) / `main` (PROD) · **Zadnji update:** S194 (2026-11-06, deploy S185–S193 na PROD + 059/060; alati Financija T45/T41/T47/T44/T49, T40 izmjeren; T-S192-1 ✅) · povijest sesija: `DONE_HISTORY.md`

---

<!-- NA-REDU:BEGIN (generira audit_tests.py --write -- ne uredjivati rucno) -->

## Na redu

> Generirano iz tablica ispod (`python data-prep_tools/Tools/audit_tests.py --write`). Status se mijenja u tablici, nikad ovdje.

**Testovi — čekaju datum ili događaj** (14)

- **T-S195-1** — **čeka: prvi izvod prosinca (MC ~02.12.)** — Probni prolaz PROD: krug.bat --suho ⇒ [PROD], izvještaj iz krug_lokalno\ (ne OneDrive), ništa … · _S195_
- **T-S195-2** — **čeka: T-S195-1** — Pravi krug + Kokin uvoz: krug.bat ⇒ xlsx + html u Za uvoz; Koka odluči (DELETE / prazno) i … · _S195_
- **T-S195-3** — **čeka: T-S195-2** — Drugi krug poslije uvoza: obrađeni izvodi ✓ GOTOVO, 0 · 0, premješteni u Analizirani_izvodi\; … · _S195_
- **T-S195-4** — **čeka: PBZVISA_2026-11 (~03.12.)** — Visa (K7): prije plaćanja ⏳ „Saša plati X do …" i nema Visa redaka u fileu; poslije trake Visa … · _S195_
- **T-S194-1** — **čeka: ZABA_2026-11 (početak prosinca)** — Prosinački krug, ZABA: fill_from_izvod --zaba ZABA_2026-11 ⇒ storno (ako ga ima) kao „≈ isti … · _S194_
- **T-S194-2** — **čeka: MC_2026-11 (~02.12.)** — Prosinački krug, MC: --mc MC_2026-11 ⇒ kupnje s kraja izvoda „→ POMAKNUTO u košaru 11.01." (ne … · _S194_
- **T-S194-3** — **čeka: PBZVISA_2026-11 (~03.12.)** — Prosinački krug, Visa: ispis „ISPRAVCI (n)" = broj ispisanih redaka; bliski iznos istog dana … · _S194_
- **T-S194-5** — **čeka: deploy** — T46 PROD poslije deploya: Overview Financije_all, To = neki prošli dan ⇒ uz „Stanje po računu" … · _S194_
- **T-S194-6** — **čeka: deploy + uvoz izvoda** — T42 PROD, prvi uvoz izvoda poslije deploya: u crvenom okviru NEMA „N older records" za rate … · _S194_
- **T-S193-1** — **čeka: deploy prije 11.11. + traka MC (Koka)** — 11.11., Koka, traka MC: „Da, upiši" ⇒ novi skupni redak (Σ 2.783,26) u Editu ima Namjena = … · _S193_
- **T-S193-2** — **čeka: deploy prije 11.11. + traka MC** — 11.11., Saša (grantee): ista traka — upiši 2783,26 ⇒ „✓ slaže se" i „Potvrđuje vlasnica Aree"; … · _S193_
- **T-S193-3** — **čeka: deploy + prvi Kokin uvoz** — Prvi Kokin Excel uvoz poslije deploya: završni ekran „Trajanje: …" (40-ak ispravaka ≲ 1 min); … · _S193_
- **T-S191-6** — **čeka: deploy na PROD (mobitel bez hotspota)** — Pravi mobitel: izbornik ⇒ kartica ⇒ Uredi vježbu ⇒ „Add" otvara STRAŽNJU kameru ⇒ slikaj ⇒ … · _S191_
- **T-S175-1** — **čeka: 11.11. (Koka, traka MC Σ 2.783,26)** — ~02.11.–11.11. PROD: MC_2026-10 kroz fill_from_izvod --mc (15 rata + 4 naknade sparene, … · _S175_

**Testovi — mogu odmah** (1)

- **T-S191-5** — Katalog ⇒ Edit lat_raises (s opisom): „Slično“ više nije krugovi_ruke / carry / kosa_k_side … · _S191_

**Posao (nije test)** (5)

- **T-S174-3** — PROD: starija povijest s pravilima (nasljeđuje T-S169-7) — ZABA 257 / 70 (32 pravila), RF 384 … · _Posao_
- **T-S174-5** — PROD, POSLIJE uvoza T-S174-3: Nenini retci — ispravi_tip ×2 … · _Posao_
- **P-1** — Gibljivost: npm run dev:prod → filtar Health_Sasa → Structure → Export → file u Claude-temp_R\ … · _Posao_
- **P-2** — Skica View-a treninga (<https://claude.ai/artifact/Uon18ZHeVYD5oEYYkrpmJy>) — tvoje mišljenje … · _Posao_
- **P-3** — Pospremi probne vježbe u katalogu na TEST-u: hand_lat_test, lat_raises_test, stara test (S191) · _Posao_

<!-- NA-REDU:END -->

---

## Posao (nije test) — veće stvari koje čekaju tebe ili Koku

Sati rada, ne provjera promjene; ostaje ovdje da se vidi (Saša, S192). Status u zadnjoj ćeliji, isto kao kod testova. `P-<n>` je posao bez testne sesije.

| ID | Posao | Status |
| --- | --- | --- |
| T-S174-3 | PROD: starija povijest s pravilima (nasljeđuje T-S169-7) — ZABA 257 / 70 (32 pravila), RF 384 / 90 (61) ⇒ razvrstavanje ⇒ `--preuzmi` ⇒ uvoz pod Kokom, bez kutije potvrđenog stanja | ⬜ |
| T-S174-5 | PROD, **POSLIJE uvoza T-S174-3**: Nenini retci — `ispravi_tip` ×2 (`Claude-temp_R/s174_pravila/nena_naredbe.ps1`) ⇒ Koka uvozi `0 · 36 · 0` (Transfer / Nena) i `0 · 5 · 0` (Razno / Nena's funds), saldo nepomaknut | ⬜ |
| P-1 | **Gibljivost:** `npm run dev:prod` → filtar `Health_Sasa` → Structure → **Export** → file u `Claude-temp_R\` ⇒ Claude doda leaf `Gibljivost` (3 testa, 5 brojki u cm), ti uvezeš i izmjeriš prvi put (S191) | ⬜ |
| P-2 | **Skica View-a treninga** (<https://claude.ai/artifact/Uon18ZHeVYD5oEYYkrpmJy>) — tvoje mišljenje prije koraka 6 (S191) | ⬜ |
| P-3 | Pospremi probne vježbe u katalogu na TEST-u: `hand_lat_test`, `lat_raises_test`, stara `test` (S191) | ⬜ |

---

## S195 — `krug`: jedna naredba za mjesečni krug Financija (2026-11-07)

`krug.bat` (PROD) / `run.bat krug.py --suho` (TEST): razvrstač → izvodi u korijenu `izvodi\` → stanje iz baze → jedan Excel (odluke u `Delete?`, napomene) + izvještaj na hrvatskom u `OneDrive\Izvodi\Za uvoz`; sidro ZABA/RF iz izvoda. Spec: `docs/KRUG_SPEC.md`. Studeni izveden na TEST-u od početka do kraja (T-S195-5); T-S194-1..3 se u prosincu čitaju iz izvještaja `krug`a (odjeljak Detalji = ispis istih alata).

**Detalji testova:** [tests/S195_tests.md](tests/S195_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S195-1 | **Probni prolaz PROD:** `krug.bat --suho` ⇒ `[PROD]`, izvještaj iz `krug_lokalno\` (ne OneDrive), ništa upisano ni premješteno | ⬜ čeka: prvi izvod prosinca (MC ~02.12.) |
| T-S195-2 | **Pravi krug + Kokin uvoz:** `krug.bat` ⇒ xlsx + html u `Za uvoz`; Koka odluči (DELETE / prazno) i uveze; pregled = OČEKIVANO iz izvještaja | ⬜ čeka: T-S195-1 |
| T-S195-3 | **Drugi krug poslije uvoza:** obrađeni izvodi ✓ GOTOVO, 0 · 0, premješteni u `Analizirani_izvodi\`; ZABA sidro UPISANO (bilješka „ispisano stanje s izvoda · ZABA_2026-11.pdf"); treći put nijedno novo sidro | ⬜ čeka: T-S195-2 |
| T-S195-4 | **Visa (K7):** prije plaćanja ⏳ „Saša plati X do …" i nema Visa redaka u fileu; poslije trake Visa u fileu, Σ ✓ u cent | ⬜ čeka: PBZVISA_2026-11 (~03.12.) |
| T-S195-5 | **Studeni na TEST-u, od početka do kraja:** krug ⇒ file 34 New · 73 Modify (+1 odluka) ⇒ uvoz kroz app 34 · 73 · 1 (DELETE), 25 s ⇒ drugi krug 3/3 ✓ + sidro 10.664,71 na 01.11. ⇒ treći krug bez novog sidra | ✅ S195 (07.11.) — izmjereno (Claude, Sašin TEST račun, backup `2026-11-07_1205`) |

---

## S194 — Deploy i alati Financija: ZABA storno / krivo mjesto, Visa blizak iznos, MC kraj izvoda (2026-11-06)

Deploy `main` = `c232ee5` (S185–S193) + `059`/`060` na PROD-u. Alati (bez deploya): `fill_from_izvod --zaba` (T45: storno, par 1:1 uz smjer i Izvor, kartični redak = KRIVO MJESTO — jasan se sam premjesti), `--mc` (T47: kupnja s kraja izvoda sama u iduću košaru), `visa_uvoz_izvoda` (T41 blizak iznos, T44 naslov), `razvrstaj_izvode` (T49 korijen). Sve izmjereno na TEST-u (stari/novi usporedno); ovdje su provjere u prosinačkom krugu.

**Detalji testova:** [tests/S194_tests.md](tests/S194_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S194-1 | **Prosinački krug, ZABA:** `fill_from_izvod --zaba ZABA_2026-11` ⇒ storno (ako ga ima) kao „≈ isti redak", kartični redak plaćen s računa u „MOŽDA KRIVO MJESTO"; uvoz bez duplikata, `promet_check` 2026-11 ✓ | ⬜ čeka: ZABA_2026-11 (početak prosinca) |
| T-S194-2 | **Prosinački krug, MC:** `--mc MC_2026-11` ⇒ kupnje s kraja izvoda „→ POMAKNUTO u košaru 11.01." (ne `--brisi`), KONTROLA ✓ u cent | ⬜ čeka: MC_2026-11 (~02.12.) |
| T-S194-3 | **Prosinački krug, Visa:** ispis „ISPRAVCI (n)" = broj ispisanih redaka; bliski iznos istog dana sparen kao ispravak | ⬜ čeka: PBZVISA_2026-11 (~03.12.) |
| T-S194-4 | **T40 PROD:** `Visa=cutoff:2:5` (Structure uvoz pod Kokom: Automations 1, ostalo 0); Add 02.11. → 05.11., 03.11. → 05.12. | ✅ S194 (06.11.) — Saša |
| T-S194-5 | **T46 PROD poslije deploya:** Overview `Financije_all`, To = neki prošli dan ⇒ uz „Stanje po računu" čip „na dan … · Custom ↺ This Year"; klik ⇒ čip nestaje, saldo današnji | ⬜ čeka: deploy |
| T-S194-6 | **T42 PROD, prvi uvoz izvoda poslije deploya:** u crvenom okviru NEMA „N older records" za rate (samo žig/datum naplate/status); sivi redak „… change only what the bank statement confirms" | ⬜ čeka: deploy + uvoz izvoda |

---

## S193 — Održavanje Financija: traka, brz uvoz, razdoblje (2026-11-05)

T48 (traka upisuje Namjenu), T39 (grantee u traci vidi usporedbu), T50 (uvoz ne dira razdoblje), T43 (uvoz ispravaka 42 retka: TEST >300 s → 11 s, trajanje na završnom ekranu). Sve čuvaju E2E; ovdje su samo provjere na PROD-u koje se dogode same.

**Detalji testova:** [tests/S193_tests.md](tests/S193_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S193-1 | **11.11., Koka, traka MC:** „Da, upiši" ⇒ novi skupni redak (Σ 2.783,26) u Editu ima **Namjena = Zajedničko** | ⬜ čeka: deploy prije 11.11. + traka MC (Koka) |
| T-S193-2 | **11.11., Saša (grantee):** ista traka — upiši 2783,26 ⇒ „✓ slaže se" i „Potvrđuje vlasnica Aree"; bez polja za dan | ⬜ čeka: deploy prije 11.11. + traka MC |
| T-S193-3 | **Prvi Kokin Excel uvoz poslije deploya:** završni ekran „Trajanje: …" (40-ak ispravaka ≲ 1 min); nakon zatvaranja filtar i dalje This Year s datumima | ⬜ čeka: deploy + prvi Kokin uvoz |

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
| T-S191-6 | **Pravi mobitel:** izbornik ⇒ kartica ⇒ Uredi vježbu ⇒ „Add" otvara STRAŽNJU kameru ⇒ slikaj ⇒ Spremi ⇒ kartica pokazuje sliku; ✕ na slici + Spremi ⇒ nema je. Usput Add treninga (prednja kamera, kao prije) i Edit (galerija) spremaju sliku | ⬜ čeka: deploy na PROD (mobitel bez hotspota) — na PROD-u ✕ i regresija preko Edit slike bilo koje Aree; kartica kataloga tek kad katalog stigne na PROD. S192: koraci 1–3 ✅ (stražnja kamera, slika u katalogu, Odustani ne briše); ✕ na dodiru NEVIDLJIV (pogađao se slučajno, dodir sredine otvara povećanje) ⇒ popravljeno, ponoviti korake 4–6 |

---

## S175 — Čišćenje: studeni krug u tri testa, deset sekcija u arhivu (2026-10-19)

Testovi koji su čekali prvi mjesečni krug u studenom (MC, Visa, ZABA) iz osam sesija sažeti su u T-S175-1..3, a dva praćenja Kokinog mobitela u jedno pitanje (T-S175-4). T-S145-3 prepušten unosu BUG-S145-BOOLEDIT, T-S172-4 preseljen u BACKLOG. Sekcije S145–S173 (svih 10) su u `DONE_HISTORY.md`. Kod: Košare ↗ označava redak po povratku (T-S175-5); **F5** — sheet `AreaSettings` u Structure roundtripu, export = jedna Area (T-S175-6); „Create categories & continue" ne dira postojeću Areu (T-S175-7).

**Detalji testova:** [tests/S175_tests.md](tests/S175_tests.md)

| ID | Test | Status |
| --- | --- | --- |
| T-S175-1 | ~02.11.–11.11. PROD: MC_2026-10 kroz `fill_from_izvod --mc` (15 rata + 4 naknade sparene, KONTROLA ✓) ⇒ Koka uvozi `_filled` ⇒ ponovni prolaz 0/0 ⇒ 11.11. traka „pokaži kupnje" i Potvrdi; prvi MC plan „Zadnja rata…" | ⬜ čeka: 11.11. (Koka, traka MC Σ 2.783,26) — S192 (05.11.): **A–C ✅** — 54/54 spareno, NOVI 0 (rate i naknade u ispravcima), Konzum 6/6 `~` 28,51 → 28,46; 2 Kokine kupnje 29./30.10. (30,12 + 2,60) nisu na izvodu ⇒ Datum naplate → 11.12. (ne `--brisi`, T47); uvoz 0 · 54 · 81, ponovni prolaz 0 · 0, KONTROLA ✓ 2.783,26. **Ostaje E (11.11., Koka):** traka MC Σ **2.783,26** → dan → Da, upiši. D (rata modal) nije se dogodio |
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
| T-S174-4 | Provjera unatrag po pravilu (PROD snimka): iz pravila 144/147 (98,0 %), 12 mj 54/56 | ✅ S174 — izmjereno (in-sample, v. detalje) |

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
