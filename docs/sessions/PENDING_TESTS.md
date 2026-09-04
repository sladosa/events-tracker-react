# PENDING TESTS

**Branch:** `test-branch` (dev) / `main` (PROD)
**Zadnji update:** S127 (2026-09-04) — BUG-S127-PRESETFREEZE: shortcut je zamrzavao izvedene vrijednosti i time gasio `set_attribute` pravilo.

---

## S127 — shortcut je zamrzavao izvedene vrijednosti (2026-09-04)

Detalji: [S127_tests.md](tests/S127_tests.md)

⚠ **NIJE deployano na `main`.** Dok ne bude, Koka i dalje vidi staro ponašanje.

### Provjereno strojno (ne traži nikoga)

| kontrola | rezultat |
| --- | --- |
| uzrok izmjeren na PROD-u, ne pretpostavljen | ✅ preset `Isplata` (`ae04685d`, 02.09.) nosi `datum_naplate = 2026-10-11T12:00` |
| preset se bira SAM (`usage_count = 0`) | ✅ `ProgressiveCategorySelector.tsx:411-416` |
| PROD pravilo je ispravno (`Racun → same`) | ✅ `areas.settings.automations` |
| `2026-10-04` ne odgovara nijednom pravilu | ✅ ⇒ ručni unos iz Edita, dan popravljen a mjesec ostao |
| zapis `7a84bcd1` nakon Kokinog Edita (07:42) | ✅ `datum_naplate = 2026-09-04`, slaže se s `Izvor = Racun` |
| `ruleManagedAttrs.test.mjs` | ✅ 22 / 22 (bila 13 — dodana evaluacija pravila, jezgra koju sad dijele Add i Edit) |
| test pada kad se kod pokvari (oba smjera) | ✅ 8/13 i 7/13 uz dva namjerna kvara |
| ⭐ **T-S127-1 potvrđen uživo** (Sašine slike 1 i 2) | ✅ prazno po otvaranju → `04/09/2026 12:00` uz `Izvor = Racun` |
| slika 3 potvrdila predviđenu nesimetriju Edita | ✅ `Status → Planiran`, `Datum naplate` nepomičan ⇒ popravljeno |
| ⭐ **T-S127-8 potvrđen uživo** — Edit, `Racun → Mastercard` | ✅ `Datum naplate → 11/10/2026`, `Status → Planiran` |
| ⭐ **T-S127-4 potvrđen uživo** — shortcut, `Mastercard → Racun` | ✅ datum se vrati na današnji |
| **retci koje bi slučajna izmjena `Izvora` raz-potvrdila** | ⚠ **2.300** s popunjenim `Izvod opis`; `Izvrsen` 2.363, `Planiran` 56 |
| **31 ZABA izvod, `check_chain`** | ✅ **neprekinut** 2024-01-01 → 2026-07-01 |
| ⭐ **`−200,14` LOKALIZIRAN na mjesece** | ✅ 2025-08 `−46,74` · 2025-10 `−150,00` · 2025-07 `+0,80` · 2026-03 `−2,80` · 2026-04 `−1,40` |
| 2025-02 `−49,00` / 2025-03 `+49,00` | ✅ poništavaju se ⇒ **datum s krive strane zatvaranja izvoda**, ne redak koji fali |
| PROD vs TEST po mjesecima | ✅ **`Δpromet` identičan u svakom mjesecu koji izvod pokriva** |
| **sidra 2024. upisana** | ✅ TEST 12 (1 već postojalo) · PROD 13 |
| tekući saldo nakon upisa | ✅ `12.772,86` (= `12.784,36` − današnjih `11,50`), sidro i dalje 30.07.2026. |
| ⭐ **Kokina ishodišna stanja PROVJERENA** | ✅ RF `12.712,28` @ 01.01.2023. ⇒ kroz **2 godine i 158k prometa** zatvara na **−11,49** prema `RF_2024-12` |
| ZABA ishodište `1.845,45` | ✅ manjak od `15.752,07` je **98,3 %** objašnjen s **11 nedostajućih skupnih MC naplata** (`16.025,88`); stvarni neobjašnjeni ostatak 2023. je **`273,81`** |
| njen MC model je ISPRAVAN | ✅ jedina naplata koju ima (`926,52` @ 11.12.2023.) je **točno studeni** (`926,52`), na 11. — dakle mehanizam je znala, samo nije upisivala |
| MC izvodi prije 2024-01 | ❌ **ne postoje** ⇒ 11 naplata se ne može rekonstruirati |
| datum ishodišnog sidra | ⚠ mora biti **2022-12-31**, ne 01.01.2023.: na 01.01. postoji stvarna RF transakcija `79,63` koju bi „strogo nakon" inače izbacilo |
| typecheck + build | ✅ |

### Traži tebe — pogledom u aplikaciji

| # | test | status |
| --- | --- | --- |
| **T-S127-1** | ⭐ `Datum naplate` prazan dok `Izvor` nije odabran, pa **današnji** | ✅ |
| T-S127-2 | Mastercard i dalje daje 11. sljedećeg mjeseca, i vraća se natrag | ⬜ |
| T-S127-3 | ručni unos `Datum naplate` se i dalje poštuje | ⬜ |
| **T-S127-4** | ⭐ shortcut nosi `Izvor`, a datum se **računa pri svakoj upotrebi** | ✅ |
| T-S127-5 | Kokin postojeći preset `Isplata` izliječen bez diranja baze | ⬜ |
| T-S127-6 | zapis od 04.09. ispravljen na `04.09.` (Sašin ručni ispravak) | ✅ |
| T-S127-7 | ⚠ **mjerenje:** ima li nacrt (`Resume`) istu bolest | ⬜ |
| **T-S127-8** | ⭐ **Edit sada evaluira `set_attribute`** — promjena `Izvora` miče `Datum naplate` | ✅ (koraci 3–4 još nisu prikazani) |
| **T-S127-9** | ⚠ otvaranje retka ne smije ništa promijeniti (855 Visa redaka) | ⬜ |
| T-S127-10 | promjena **datuma** u Editu i dalje ne miče `Datum naplate` (svjesno) | ⬜ |

### ⚠ Otvoreno

- **Testirati se može na TEST bazi** — `Financije_all` (`98dd91f3`) ondje ima
  **identičnu** `attribute_rules` konfiguraciju. `npm run dev` / `dev:test` →
  TEST; `dev:prod` → PROD. Samo T-S127-5 traži PROD, i to čitanjem.
- **Regresijski rizik je izmjeren:** od 6 PROD preseta **samo** Kokin `Isplata`
  uopće nosi `default_attributes`; ostalih pet imaju `null` i promjena ih ne
  može dotaknuti.
- **⚠ `Status` se u Editu i dalje mijenja PRAVILOM, ne dokazom** (Sašin nalaz,
  04.09.). `depends_on.default_map` radi u Editu od ranije — S127 ga nije dirao —
  ali sada je posljedica veća jer se istim potezom miče i `Datum naplate`.
  Izmjereno na PROD-u: **2.300 redaka nosi `Izvod opis`**, dakle potvrdu s
  izvoda. Promjena `Izvora` na takvom retku okrene `Status` u `Planiran` iako
  `Izvod opis` i dalje tvrdi da je banka naplatila — dva polja koja se
  proturječe, i ništa to ne javi. Obrnuti smjer je gori: kartični redak
  prebačen na `Racun` dobije `Izvrsen`, dakle tvrdnju **da se dogodilo**, a to
  je točno onaj automat koji je odbačen („dospjelo ⇒ izvršeno").
  ⚠ **Nije popravljeno — traži Sašinu odluku**, jer isti mehanizam u Add Activityju
  radi ono što treba (T-S127-4).
- **Auto-odabir shortcuta bez korisnikova klika** — jedna slučajna snimka postane
  trajno pravilo za sve unose u toj kategoriji, i to nevidljivo (`usage_count`
  kaže „nikad korišten"). Nije popravljeno; treba odluka.
- **`userOwned` i dalje ne razlikuje „čovjek je upisao" od „nešto je popunilo".**
  Zatvorena su oba ulaza koja su danas postojala (preset i `default_value` na
  targetu), ali sam kriterij ostaje izračun iz stanja — isti razred kao S122
  (`userTouchedRef`).

---

## S126 — ZABA kolovoz usklađena s bankom, `Tip/Podtip` iz izbrojane povijesti (2026-09-03)

Detalji: [S126_tests.md](tests/S126_tests.md)

✅ **Deployano na `main` 03.09.2026.** (`b4aeecb`, 22 commita: S125 + S126).
Koka na `events-tracker-react.netlify.app` od sada vidi sve niže opisano.
⚠ **Hard refresh je dio postupka** (S118) — na mobitelu zatvori i ponovno otvori
aplikaciju, inače vrti stari bundle.

### Provjereno strojno (ne traži nikoga)

| kontrola | rezultat |
| --- | --- |
| ⭐ **saldo `Kokin tekući ZABA`** | ✅ **12.784,36 €** = ispisano `NOVO STANJE` s `ZABA_2026-08.pdf`, u cent |
| lanac izvoda (`POČETNO` 13.815,33 = naše sidro 30.07.) | ✅ između dva izvoda ne fali ništa |
| uvoz | ✅ 75 novih / 16 izmjena / 1 nepromijenjen — točno kako je preview najavio |
| `Izvod opis` na ZABA retcima od 31.07. | ✅ 46 / 46 |
| izmjene su dirnule samo `Izvod opis` | ✅ izvještaj: svih 16 nosi `Changed: Izvod opis` |
| košara 11.09. | ✅ 46 redaka / 1.048,72, raspon `Σ` pokriva sve |
| `deltaSheetLayout.test.mjs` | ✅ 36 / 36 (bila 33) |
| `importForeignRows.test.mjs` | ✅ 26 / 26 — pao 2 prije deploya, **greška testa** (računao položaj sekcije), ne koda |
| typecheck + build | ✅ |

### Traži tebe — pogledom u aplikaciji / Excelu

| # | test | status |
| --- | --- | --- |
| **T-S126-1** | ⭐ novi raspored delta sheeta — kontrola IZNAD sekcije | ⬜ |
| T-S126-2 | `Provjeri` nosi stil zaglavlja | ⬜ |
| **T-S126-3** | ⭐ kontrola košare: `naplaceno = 1.068,70` ⇒ `razlika = 19,98` | ⬜ |
| T-S126-4 | skraćen `Izvod opis`; redak **naknade** ostaje cijel | ⬜ |
| **T-S126-5** | ⭐ prijedlozi iz povijesti točni (Holding: `12045603` ≠ `03879097`) | ⬜ |
| T-S126-6 | komentar koji NIJE upisan (2× `22,90`, `28,06`) | ⬜ |
| T-S126-7 | 33 retka s `Tip = N/A` — sidro čeka njih | ⬜ |
| T-S126-8 | sumarni retci ne prekidaju uvoz (potvrđeno danas, ostaje pogled) | ⬜ |

### ⚠ Otvoreno

- **Sidro `12.784,36 @ 26.08.2026.` NIJE upisano — namjerno** (Sašina odluka).
  Delta prozor kreće `max(dan nakon sidra, danas − N)`, pa bi sidro na 26.08.
  **zaključalo** kolovoz i onih 33 `N/A` redaka ne bi se moglo dohvatiti delta
  sheetom. Upisuje se **čim razvrstavanje sjedne**.
- Dva MC retka (`9,99` ×2) nisu uvezena — vjerojatno isti trošak pod krivim
  datumom. **Prvo ispravak datuma u bazi, pa uvoz** (razred S115).

---

## S125 — `043` na PROD-u, košara, i Excel put za tuđi redak (2026-09-02)

Detalji: [S125_tests.md](tests/S125_tests.md)

⚠ **Kod je na `test-branch`; `main` je i dalje na `bb13153` (S124).** Na PROD-u su
samo migracije `043` i `044`. Sve niže radi **lokalno protiv PROD baze** — Koka na
`events-tracker-react.netlify.app` još ništa od ovoga ne vidi.

### Provjereno strojno (ne traži nikoga)

| kontrola | rezultat |
| --- | --- |
| razlika od 15 € razriješena (`Izvor` Visa → Racun na `rest. Kvatrić`) | ✅ pločica = banka, **1.920,34** |
| `043` na PROD-u — `events.edited_by` odgovara | ✅ (prije `400 column does not exist`) |
| UI: Koka ispravlja Sašin redak | ✅ autorstvo ostalo · `edited_by` upisan · 8/8 atributa pod autorom |
| **Excel: Koka ispravlja Sašin redak** | ✅ 10 → 10 redaka (bez duplikata) · 1 promijenjen · atributi pod Sašom |
| `Σ košare 03.09.` prije/poslije oba uvoza | ✅ 205,36 nepromijenjena |
| unit testovi | ✅ 31 + 21 + 11 |
| E2E `T-S123-3` (✎ na oba rasporeda) | ✅ 34 s, pada na pokvarenom kodu |

### Traži tebe — pogledom u aplikaciji

| # | test | status |
| --- | --- | --- |
| **T-S125-1** | ⭐ ✎ na tuđem retku, **desktop** širina (ovo je bio BUG-S123-EDITMARK) | ⬜ |
| T-S125-2 | ista oznaka na uskom ekranu | ⬜ |
| **T-S125-3** | ⭐ sekcija `KOSARA` nosi i već potvrđene retke; `Σ` = 205,36; sažeci je ne broje | ⬜ |
| T-S125-4 | stupac `Provjeri` — naslov u retku-razdjelniku, objašnjenje kao input message, poruka nestaje na ispravak | ⬜ |
| **T-S125-5** | ⭐ Excel: vlasnik Aree ispravlja tuđi redak — 1 Modify, **bez** „imported as NEW" | ✅ S126 |
| **T-S125-6** | ⭐ Excel: `DELETE` na tuđem retku se **odbija**, atributi ostaju | ⬜ |
| T-S125-7 | grantee ne dobiva ponudu „Ispravi kao vlasnik" | ⬜ |
| T-S125-8 | ugašena kvačica Delta sheeta kaže zašto i što učiniti | ⬜ |
| T-S125-9 | brojač događaja u delta načinu ne tvrdi puni izvoz | ⬜ |
| T-S125-10 | izvoz koji ne može učitati podatke **pada s porukom**, ne izlazi prazan | ⬜ |

⚠ **T-S125-6 je najvažniji pad ako padne:** bez zaštite bi tuđi redak označen za
brisanje ostao **bez ijednog atributa, a prisutan** — uništen, a naizgled netaknut.

### ⚠ Otvoreno

- **Nijedan od ovih testova nije prošao kroz deployani PROD kod** — `main` čeka merge.
- `T-S125-5/-6` su nad **stvarnim RLS-om** provjereni samo za ispravak; grana brisanja
  je pokrivena unit testom, ne živim RLS-om.

---

## S124 — usklađenje s izvodima, ispravci i tranša na PROD-u (2026-09-01)

Detalji: [S124_tests.md](tests/S124_tests.md)

⚠ **Sve je već primijenjeno na PROD skriptama**, ne Excel importom — Sašina odluka:
Koku ne opterećivati batchom u kojem nijedan redak ne traži njenu odluku. Testovi zato
provjeravaju **ishod na PROD-u**, ne postupak uvoza.

### Provjereno strojno (ne traži nikoga)

| kontrola | rezultat |
| --- | --- |
| svih 7 MC izvoda: `spareno + za uvoz = ukupno s papira` | ✅ u cent |
| košara 11.07. | ✅ 48 redaka · 1.244,74 = banka |
| košara 11.08. | ✅ 47 redaka · 1.332,52 = banka |
| `uvoz 0 · duplikat 0 · pitanja 0` na svih 7 | ✅ |
| `Racun` redci nepromijenjeni (saldo netaknut) | ✅ 479/210 |

### Traži tebe — pogledom u aplikaciji

| # | test | status |
| --- | --- | --- |
| T-S124-1 | Overview: saldo `Kokin tekući ZABA` **isti kao prije** (sve dirnuto je MC) | ⬜ |
| T-S124-2 | 28.06.: nema `LH 1/3`; `LUFTHAN…447/448` nose `Rate? DA · 1/3`, opis im **ostaje bankin** | ⬜ |
| T-S124-3 | 11.07.: nema `LH 2/3`; 29.07. postoje `LUFTHAN… RATA 2/3` 62,01 ×2 + `NAKNADA` 1,32 ×2 | ⬜ |
| **T-S124-4** | ⭐ **nijedan redak nije prešao u `Izvrsen` bez `Izvod opis`** | ⬜ |
| T-S124-5 | novi Podtip `Wellness` je u dropdownu pod `Zabava` (Add Activity) | ⬜ |
| T-S124-6 | 26 novih redaka 10.–31.07. imaju Kokine opise (`Parking`, `Ina`, `Bazen`…), ne strojni tekst | ⬜ |
| T-S124-7 | `TERME JEZERCICA-POOL BAR` 9,80 je `Domaćinstvo / Kave/jelo vani`, **ne** Wellness | ⬜ |

⚠ **T-S124-4 je najvažniji pad ako padne:** značio bi da je `Status` promijenjen kao
zaključak iz **dospijeća**, a ne kao posljedica **potvrde izvodom** — pravilo koje je
izričito odbačeno.

### ⚠ Nije testirano i ostaje otvoreno

- **Excel import put nije provjeren ovim batchom** (išao je skriptom). Da alat i app govore
  isti jezik i dalje treba dokazati — na TEST-u ili na Kokinom prvom vlastitom mjesecu.
- 3 preostala `event_date` pomaka namjerno nisu dirana (pomicanje miče i `session_start`).

---

## S123 — Kokin roundtrip, ispravci tuđih redaka, i `Datum naplate` (2026-08-31)

Detalji: [S123_tests.md](tests/S123_tests.md)

⚠ **Sve je na `test-branch`. PROD je na `5533420`** — Koka od ovoga još ništa ne vidi.
⚠ **Redoslijed puštanja nije stvar ukusa:** prvo `sql/043` na PROD, **pa tek onda**
merge na `main`. Obrnuto znači da UI otvori Edit, a RLS ga odbije — i to tiho
(`UPDATE` „uspije" s 0 redaka), a kod atributa nakon uspješnog `DELETE`.

### Automatizirano

| test | čuva | provjereno obrnuto |
| --- | --- | --- |
| `T-S123-1/-2` | vlasnica ima Edit a nema Delete; ispravak čuva autorstvo i **atribut preživi** | ⛔ ne može — DDL se odavde ne izvršava |
| `deltaAccount.test.mjs` (11) | delta sheet uzima račun iz profila, ne iz panela | ✅ bez popravka pada 6/11 |
| `deltaSheetLayout.test.mjs` (18) | raspored sekcije „planirano" + `row_hash` u profilu | ✅ manja praznina ⇒ padaju 3 tvrdnje |

### Novo — traži tebe, **tek nakon `043` + deploya**

| # | test | status |
| --- | --- | --- |
| T-S123-3 | ⭐ oznaka ✎ „netko drugi je ispravio redak" — **jedino što nije automatizirano** | ⬜ |
| T-S123-4 | vlasnica nema Delete na tuđem retku (na svom ga ima) | ⬜ |
| T-S123-5 | ⭐ delta sheet uzima račun iz **profila**, ne iz panela | ⬜ |
| T-S123-6 | prazan delta sheet se **javlja**, izvoz se ne prekida | ⬜ |
| T-S123-7 | ⭐ sekcija „planirano": granica, prazan kontrolni stupac, uvoz nakon promjene `Status` | ⬜ |
| T-S123-8 | Export profil se bira sam; bilješka na `row_hash`; profil ga smije sakriti | ⬜ |

### ⚠ Blokira deploy — nije test nego posao

| # | što | status |
| --- | --- | --- |
| **T-S123-9** | ~~`Datum naplate` raščistiti prije nego sekcija „planirano" ode Koki~~ — **✅ ZATVORENO S124**: `MC_2026-06.pdf` je cijelo vrijeme bio u `izvodi/Analizirani_izvodi/`. Košara se razlaže na 48 (= 1.244,74 u cent) + 2 duplikata + 23 kriva datuma, a cijela MC 2026. zatvara se u cent na svih 7 izvoda. Alat: `uskladi_izvod.py` | ✅ |

Alat: `python data-prep_tools/Financije/kosara_naplate.py --naplata 2026-07-11 --banka 1244.74`
File: `data-prep_data/Financije/kosara_20260711_mastercard.xlsx` (app format lijevo, dijagnostika desno)

Izmjereno 31.08. — košara **73 retka / 2.231,02** vs banka **1.244,74**:

| dijagnoza | redaka | Σ |
| --- | --- | --- |
| OK | 40 | 946,48 |
| **RATA** — pravilo ne vrijedi | 21 | 832,86 |
| KRIVI MJESEC ⇒ 11.08. | 11 | 431,10 |
| KRIVI MJESEC ⇒ 11.06. | 1 | 20,58 |

⚠ Ni nakon micanja krivo datiranih se **ne zatvara** (946,48 + 832,86 = 1.779,34).
Ostatak traži **`MC_2026-06.pdf`** — pravilo je iscrpljeno.
⚠ **Tranša 4 se ne uvozi prije ovoga** — dedup po `(datum, iznos)` bi krivo
datirane preskočio, pa bi i košara 11.08. ispala kraća točno za njih.

### Zatvoreno u S123

- `BUG-S123-DELTAACCT` — delta sheet je uzimao račun iz živog filtra
- „vlasnica ne može ispraviti Sašin redak" — `sql/043` + UI (samo Edit)
- Export profil: zadani odabir + `row_hash` smije u profil (`Delete?` nikad)

---

## S122 — fantomski nacrt: dijalog nad formom u koju nitko nije tipkao (2026-08-29)

Detalji: [S122_tests.md](tests/S122_tests.md)

**Nalaz je Sašin, iz T-S121-3.** Kad je auto-save u S121 konačno proradio, počeo je pisati
nacrt i za forme koje nitko nije dotaknuo — Add se sam napuni defaultima, a prvi tik piše
bezuvjetno. Repro (izmjeren na PROD-u 29.08.): otvori Add → **6 s** → back gumb → sljedeći
Add nudi „Resume Previous Session?" nad nacrtom bez ijednog tvog znaka.

### Automatizirano

| test | čuva | provjereno obrnuto |
| --- | --- | --- |
| `T-S122-1` (2 slučaja) | netaknut Add ekran **ne** ostavlja nacrt; utipkan znak ga **ostavlja** | ✅ s izvađenim guardom prvi slučaj pada |

⚠ Drugi slučaj postoji da prvi ne bude prazan: „nema dijaloga" prolazi i kad se nacrt
uopće ne može napisati — a to je točno bio S121 bug.

### Novo — traži tebe, **tek nakon deploya na PROD**

| # | test | status |
| --- | --- | --- |
| T-S122-2 | ⭐ otvori Add → čekaj 10 s → back → opet Add: **nema** dijaloga | ⬜ |
| T-S122-3 | isto, ali utipkaj nešto prije backa: dijalog **mora** iskočiti i Resume vratiti polja | ⬜ |
| T-S122-4 | ⭐ **shortcutovi po Arei** — kvačica „samo ova Area", `<optgroup>` u punom popisu, sufiks `23× · 12.06.` | ⬜ |

---

## S121 — dva Sašina nalaza s PROD-a, oba veća nego što su izgledala (2026-08-28)

Detalji: [S121_tests.md](tests/S121_tests.md)

### Automatizirano, ne traži ništa (2 filea, 4 slučaja)

| test | čuva | provjereno obrnuto |
| --- | --- | --- |
| `T-S121-1` | Finish ne ostavlja nacrt ⇒ **nema duplikata** | ✅ bez popravka nacrt se vrati na t+15 s |
| `T-S121-2` | palo čitanje postavki Aree se **prijavljuje** | ✅ sva tri slučaja padaju bez popravka |

⚠ **Oba su zamalo bila lažna i to je zapisano u samim specovima.** `T-S121-1` je isprva
čekao da auto-save napiše nacrt — a auto-save **nikad nije radio**, pa bi test mjerio ništa;
sada nacrt piše kroz `Save +`. `T-S121-2` je prvo tvrdio „nema trake" (prolazi i na
pokvarenom kodu — trake ondje nema), pa brojao upite (`>2`, ne razlikuje jer
`useAreaDashboard` živi u tri komponente), pa tek onda mjerio **ishod**: Overview tab mora
preživjeti prolazni 503.

### Novo — traži tebe, na PROD-u nakon deploya

| # | test | status |
| --- | --- | --- |
| T-S121-3 | ⭐ **Add → Finish → odmah Add: nema „Resume Previous Session?"** | ✅ PROD 29.08. — oba prolaza, i brzi i s 30 s čekanja na success dijalogu |
| T-S121-4 | nacrt čuva nedovršen unos (zatvori tab → Resume vrati polja); Cancel ga briše | ✅ PROD 29.08. — Resume vratio polja. ⚠ korak 5 (Cancel briše nacrt) nije vrtjen zasebno |
| T-S121-5 | traka „Nisam uspio učitati postavke ove Aree" (Offline → promjena Aree) — **opcionalno**, automat pokriva | ⬜ |

### Otvoreno za Claudea

| # | što | status |
| --- | --- | --- |
| T-S121-6 | **`e16-filter-persistence` je flaky** — pada i bez izmjena iz S121 (1/3 bez, 2/3 s). Dok je flaky, S120 popravak nije čuvan. | ⬜ |
| T-S121-7 | razrez po Tipu mora nositi redak `gotovina, nerazvrstano` (izmjereno: 9.894 € podignuto vs 86 € zabilježeno) | ⬜ zahtjev, ne test |

### Arhivirano u S121

`S107w_tests.md` (11/11 ✅, audit ga sam prijavio) → `Claude-temp_R/test-sessions/archive/`.

⚠ `audit_tests.py` je **pucao** na Windows konzoli (`UnicodeEncodeError` na ✅ prije prvog
retka) — izgledao je pokvaren, a samo nije mogao ispisati. Popravljen; ritual ga traži svaku
sesiju pa mora raditi bez `chcp 65001`.

---

## S120 — što je zatvoreno i, važnije, što je OSTALO

### Zatvoreno (17)

**Mjereno protiv TEST baze i alata, bez ijednog ručnog koraka (10):**
`T-S111-3` `T-S111-4` `T-S114-1` `T-S114-2` `T-S114-3` `T-S114-4` `T-S111-6` `T-S110-4`
`T-S107d-1` `T-S115-1` — dokaz je upisan uz svaki redak u tablicama ispod, ne ovdje.

**Automatizirano (1):** `T-S119-6` → `e2e/tests/S119_list_columns_map.spec.ts`.

**Pokriveno automatom koji je 26.08. prošao (2):** `T-S107b-3`, `T-S107b-4`.

**Papirologija — zaglavlje je to tvrdilo, tablica nije znala (4):**
`T-S107d-6` `T-S111-2` `T-S107u-2` `T-S107m-6`.

⚠ Tri su zatvorena **djelomično** i to piše uz redak: `T-S111-4` (korak s Excel exportom nije
izvršen), `T-S111-6` (zaštita blizanca se više ne da izazvati), `T-S107b-4` (help blok).

### ✅ Prošlo uživo na PROD-u 2026-08-26 (Sašin Android, nakon deploya `main@ad0c6e1`)

| test | dokaz |
| --- | --- |
| **T-S119-1** ⭐ | iznos vidljiv uz desni rub, bez ijednog pomicanja ustranu |
| **T-S119-2** ⭐ | `RF` / `ZABA` sitno i sivo između datuma i iznosa |
| **T-S120-1** ⭐ | drill → View Details → natrag: čip `Sašin tekući RF ×` **ostao**, lista i dalje filtrirana |
| **T-S119-3** | `Anja 73/96` (25.08.2025.): `+450,00 €` **i** `−0,70 €`, složeni jedan ispod drugog |
| **T-S119-4** | `neka dostava - rucnici i toster` prelomljeno u dva reda, bez vodoravnog scrolanja |
| **T-S119-5** | `25.08.25. po` (lanjski, s godinom) vs `26.08. sr` (ovogodišnji, bez nje) |
| **T-S120-2** | `N/A  KEKS PAY` — jedan `N/A`, ne `N/A/N/A` |
| **T-S108-12** | Overview na telefonu: polje „u banci" **prima unos**, čip i brojevi na ekranu, ništa ne ispada |
| **T-S107v-7** | ekran `Couldn't load this activity · 57014` s gumbom **Try again** — i retry je uspio. Test je tražio točno to („kad se opet dogodi") |
| — | plava oznaka retka vidljiva pri povratku iz View Detailsa |

**Time je prolaz na telefonu gotov: 8 od 8 što ovisi o Saši.** Ostaje `T-S118-6` (Kokin prolaz),
`T-S119-7` (desktop), `T-S120-3`/`-4` (Excel uvoz, desktop).

⚠ **Usput potvrđeno da lanac salda drži.** PROD pločica 26.08.: ZABA `13.231,31 €`,
RF `796,43 €`. TEST je isti dan davao `13.239,31` — razlika je **točno 8,00 €**, Sašin redak
`26.08. ZABA −8,00 dnevna karta C5`. I RF pokazuje **1 promjenu** poslije sidra od 11.08. iako
je na listi šest RF redaka nakon tog datuma: samo `18.08. RF naknada −2,69` ima `Izvor = Racun`,
ostalo su Visa kupovine koje račun terete tek skupnom naplatom. Model radi kako je zamišljen.

**⚠ Nalaz koji je iz toga ispao — popravljen isti dan (commit `742c83a`, čeka sljedeći deploy):**
na sporoj vezi lista je pokazivala `—` ondje gdje idu iznos i račun. To **nije bio prazan
podatak nego upit u letu**. Za novac `—` je **tvrdnja** („ovaj redak nema iznos"), pa je lista
sekundu-dvije to tvrdila o svakom retku. `useListColumnValues` je razliku već znao
(`:38` — *„a missing key means not loaded yet, not empty"*), ali `loaded` nikad nije stigao do
ćelija. Sada dok upit traje stoji blijedi placeholder.

**⚠ Sporost i `57014` — izmjereno što NIJE uzrok** (2026-08-26):
PROD servisnim ključem `0,14–0,30 s` · **grantee na 3.715 eventa** (TEST, isti odnos kao Saša
kod Koke) `0,09–0,41 s` · atributni filtar u oba režima `0,3–0,7 s`. Dakle ni podaci, ni
RLS-grantee, ni filtar. Ostaje **S105 obrazac** — free-tier PROD se povremeno guši (isti kod
greške, ista tablica, „čas 0,2 s čas timeout"), što potvrđuje i to da je `Try again` odmah
upalio. **Nije potvrđeno kao zaključak.** Ako se ponovi: zabilježi **sat i minutu** i ekran.
Pravi potez ostaje **Postgres upgrade na PROD-u** (`Settings → Infrastructure`, otvoreno od S105).

### Novo u S120 — traži telefon ili tvoj račun

Detalji: [S120_tests.md](tests/S120_tests.md)

| # | test | status |
| --- | --- | --- |
| T-S120-1 | ⭐ **Filtar preživi View Details na telefonu** (E2E to pokriva na desktopu) | ✅ **26.08. uživo** — drill → View Details → natrag: čip `Sašin tekući RF ×` ostao, lista i dalje filtrirana|
| T-S120-2 | `N/A` se pojavljuje **jednom**, ne `N/A/N/A` | ✅ **26.08. uživo** — `N/A  KEKS PAY`, jedan `N/A`|
| T-S120-3 | „Import as mine" prijavi **kolizije** (prije: `0 New / 0 Modify` nad praznim skupom) | ⬜ |
| T-S120-4 | Uvoz u areu s istim imenom kategorije — **prije batcha 2024** | ⬜ |

**Automatizirano u S120, ne traži ništa:** `E16-1`, `E17-1`, `T-S119-6`, `T-S100-1`.
Svaki je provjeren **i u drugom smjeru** (namjerno pokvaren kod ⇒ test padne).

### Arhivirano u S120

`S107m` i `S107u` (audit ih je sam prijavio) + `S102b` (9/9 ✅) i `S104` (3/3 ✅), koje audit
nije vidio jer ih ovaj file nikad nije spominjao. Otišli u `Claude-temp_R/test-sessions/archive/`.
⏸ `S99`, `S101`, `S105` — **nadiđeni po analizi, čekaju izričitu potvrdu** (v. tablicu siročadi).

### Ostalo otvoreno — po tome TKO ga može zatvoriti

Ovo je jedini popis koji treba gledati kad se pita „što još".

| traka | koliko | što |
| --- | --- | --- |
| **Telefon, nakon deploya** | 8 | `T-S119-1…5`, `T-S119-7`, `T-S118-6`, `T-S108-12` — svi na istom ekranu |
| **App na desktopu** (`Financije_all`) | ~22 | `T-S108-1b/-5/-6/-7/-10/-11/-13`, `T-S111-1/-5`, `T-S117-1…4`, `T-S118-1…5`, `T-S107v-2/-3/-7`, `T-S113-2`, `E15-full` |
| **Excel pregled** (Review / Kokina) | ~13 | `T-S107i-5/-6`, `T-S107j-1/-4`, `T-S107n-3/-6`, `T-S107o-3/-4`, `T-S107p-1/-2`, `T-S107-6`, `T-S107d-4/-7` |
| **Može se automatizirati** (nije još) | 6 | `T-S107-3/-4/-5`, `T-S107b-5/-6`, `T-S110-5` |
| **Čeka podatke ili odluku, nije test** | ~8 | `T-S115-3` (tranša 4), `T-S116-14D`, `T-S107x-4`, `T-S107d-5`, `T-S108-9`, `T-S114-5`, `T-S107c-2`, `T-S107f-3` |

⚠ **`T-S107c-2` je namjerno preskočen u S120:** piše u Review workbook, a to se ne dira pred
deploy. Nije „nije stigao" nego „nije se smjelo".

### 58 siročadi — izmjereno, čeka jednu odluku

Ranije je stajalo „jesu li relevantni?" bez podloge. Sada podloga postoji:

| file | stanje u **vlastitom** fileu | prijedlog |
| --- | --- | --- |
| `S102b` (9), `S104` (3) | **svi ✅** | **arhiva odmah** — nema se što odlučivati |
| `S99` (8) | bez oznaka | **arhiva, nadiđeno**: Delete Area i uvoz na PROD su **izvedeni i ponovno izmjereni u S118** |
| `S101` (8) | 4 ✅ / 4 ⬜ | **arhiva, nadiđeno**: izmjereno — `Tip` danas ima **18 opcija** (Kokina taksonomija, S107r); test provjerava popis od 14 koji više ne postoji |
| `S105` (8) | 2 ✅ / 6 ⬜ | **arhiva, nadiđeno**: PROD okolina tog incidenta ne postoji; popravci su na PROD-u 7 tjedana |
| `S100` (7), `S102` (12) | 5 ✅ | **zadržati i upisati u tablice** — Export Profile, `default_map`, Filter sheet su i dalje u upotrebi |

⭐ **`T-S100-1` — ✅ ZATVOREN U S120, automatiziran** (`e2e/tests/S100_same_path_two_areas.spec.ts`).
Nije bio povijest: na PROD-u `Financije_all` i `Financije_old` **obje** imaju `Transakcija`, a
pred nama su batch 2024 i 2023. Razrješavanje je ispravno — redak ide u areu koju imenuje
kolona `Area`.

⚠ **Dvije pouke iz pisanja tog testa, obje šire od njega:**

1. **Prva verzija je bila bacanje novčića.** Uvozila je jedan file, u areu A, i **prošla je i s
   namjerno pokvarenim razrješavanjem** — jer uz ključ bez imena aree jedan od blizanaca ionako
   pobijedi rječnik, i slučajno je to bila A. Test mora uvoziti u **oba** blizanca: razrješavanje
   po samoj putanji tada ne može zadovoljiti obje strane.
2. **Ovlast nije ondje gdje izgleda.** `catByPath` (5 mjesta) se koristi za validaciju i kolizije;
   o tome **gdje redak stvarno završi** odlučuje `getHierarchyLevels`. Lomljenje `catByPath`-a nije
   promijenilo ishod — tek lomljenje `getHierarchyLevels` pošalje redak u krivu areu.

---

**Zadnji update:** S119 (2026-08-25) — uska lista: iznos bez scrolanja, kratica racuna, prelom opisa; ranije: S118 (2026-08-25) — Koka na PROD-u; ranije: S116 (2026-08-23) — kolone Activities liste po Arei, `--iz-koke` izvor, sidro ZABA ispravljeno.
**Prošlo 2026-08-22: T-S113-3.** · 2026-08-21: T-S112-3, -4, -6; T-S113-1. · 2026-08-19: T-S112-1, T-S112-2. · 2026-08-17: T-S110-1, -2, -3, -6, -7. · 2026-08-15: T-S108-1, -2, -3. · 2026-08-16: T-S108-4 korak 3.
**Zatvoreno programski 2026-08-18: T-S107d-6** (RF OCR lanac reproducira ispisano stanje u cent, 196 tx / 18 mj).
**⚠ T-S111-2 se BRIŠE:** krivo RF sidro (`3.453,03`) više ne postoji u bazi, pa test nema što provjeriti.
**✅ T-S114-1 RIJEŠEN 2026-08-23 (S116):** sidro ZABA premješteno na **30.07.** (ručni ispravak retka u Supabase editoru), prije toga netautološki provjereno da app iz sidra 01.07. sam dođe do `13.815,33`. Mehanizam koji je grešku proizveo popravljen je u kodu — v. T-S116-10…13.
**Otvoreno: NE VODI SE OVDJE — vodi se u tablicama ispod (⬜).** Ovaj redak je do S116 bio ručno kuriran popis i **propuštao je 60 testova** koje tablice označavaju ⬜ (izmjereno `data-prep_tools/Tools/audit_tests.py`). Dva popisa koja se moraju slagati, a jedan se održava rukom — isti razred greške koji inače lovimo. Za stanje pokreni:

```
python data-prep_tools/Tools/audit_tests.py
```

Ispisuje po session fileu koliko je testova definirano, koliko ✅ / ⬜, i koje je fileove **spremno arhivirati** (svi ✅). ⚠ Prijavljuje i testove kojih u ovom fileu uopće nema — v. „Siročad" ispod.
**Detalji S119:** [S119_tests.md](tests/S119_tests.md) · **S116:** [S116_tests.md](tests/S116_tests.md) · **S115:** [S115_tests.md](tests/S115_tests.md) · **S114:** [S114_tests.md](tests/S114_tests.md) · **S113:** [S113_tests.md](tests/S113_tests.md) · **S112:** [S112_tests.md](tests/S112_tests.md) · **S111:** [S111_tests.md](tests/S111_tests.md) · **S110:** [S110_tests.md](tests/S110_tests.md) · **S108:** [S108_tests.md](tests/S108_tests.md) · **S107x:** [S107x_tests.md](tests/S107x_tests.md) · **S107w:** [S107w_tests.md](tests/S107w_tests.md) · **S107v:** [S107v_tests.md](tests/S107v_tests.md) · **S107u:** [S107u_tests.md](tests/S107u_tests.md)

---

## ⚠ Siročad — 57 testova koje ovaj file ne spominje

`S99`, `S100`, `S101`, `S102`, `S102b`, `S104` i dio `S105` imaju detaljne testove u
`docs/sessions/tests/`, a **nijedan redak u ovom fileu**. Nastalo pri kuriranju: retci su
maknuti, fajlovi nisu. Posljedica je da se za njih ne zna ni da su otvoreni ni da su
zatvoreni — a arhiviranje ih zato ne može ni dotaknuti.

**Odluka koja se čeka (Sašina):** jesu li ti testovi još relevantni?
- ako jesu → vratiti im retke u tablice
- ako nisu → session fileovi idu u `Claude-temp_R/test-sessions/archive/`, kao i zatvoreni

Do tada stoje kao poznata rupa, ne kao previd.

## Arhivirano u S116

Prvi put da je korak izveden nakon tri preskočene sesije — kriterij „svi testovi ✅" nije se
dao primijeniti dok se popisi nisu izmjerili. Otišlo je 7 fileova (svi ✅, nula otvorenih):
`S107g`, `S107h`, `S107k`, `S107r`, `S107s`, `S107t`, `S107y`.

---

**✅ Prošlo 23.08. (uživo, TEST baza): T-S115-2, T-S116-6, T-S116-13, T-S116-14 A/B/C.**

**T-S116-14 dio B — izmjereno, jezgra cijele sesije.** Na `Sašin tekući RF`: potvrda s ekrana
(`799,12`, bez ijednog zapisa toga dana) ⇒ sidro `22.08. = 799,12`, saldo nepromijenjen. Zatim
event **s današnjim datumom** (`Izvor = Racun`, `Isplata 40,00`) ⇒ pločica **`759,12 €`**,
zaglavlje `od potvrde 22.08.2026. · 1 promjena poslije · zadnji zapis 23.08.2026.`
Pod starim ponašanjem (sidro na danas) ostalo bi `799,12` — bez ijedne poruke.
Bilješka sidra nosi sirovo očitanje (dio C ✓). Testni event i sidro `22.08.` obrisani nakon testa.
Sidro `TEST prazan račun = 1.240,00` (nula eventa u bazi) prikazalo se kao redak pločice,
pa obrisano s ✕ iz „povijest potvrda" — toast `Obrisana potvrda 22.08.2026. = 1.240,00 €`,
pločica se vratila na dva računa, baza na 6 sidara.

⚠ **T-S115-2 prolazi, ali ne znači ono što je zapisano.** Sidro je upisano **skriptom**
(`anchors.py --add`). Kroz UI ne bi išlo: `u banci` i `Potvrdi` renderiraju se **unutar**
`rows.map(...)`, a prazna Area daje **nula redaka** ⇒ pločica pokaže „Nema zapisa koji
zadovoljavaju uvjete pločice" i **nema polja za unos**. Dakle za Kokin PROD prvog dana:
**povijest nije preduvjet, ali jedan event jest.** Plan za PROD to već zaobilazi
(korak 5, „2–3 stvarna retka da se račun pojavi") — zaključak u `CLAUDE.md` je bio širi
nego što stoji. **Otvoreno: ponuditi vrijednosti iz `racun.validation_rules.suggest` kao
prazne retke s poljem za potvrdu** (dropdown, ne slobodan tekst — tipfeler bi inače
stvorio fantomski račun). Sašina odluka, ~30 min.

## S119 — uska lista: iznos prije ⋮ (2026-08-25)

**Uzrok i popravak su izmjereni, ne procijenjeni** (Playwright, prava aplikacija, 393 px):
tablica je bila **709 px u 367 px prostora**, pa je iznos stajao 342 px izvan ekrana; poslije
popravka **367 / 367, bez scrolla**. Snimke: `Claude-temp_R/S119_lista_prije.png` i
`…_poslije.png`.

Neprovjereno uzivo ostaje ono sto TEST racun ne moze prikazati — `Financije_all` je pod
drugim korisnikom, pa kratica racuna i dvostrani iznos nisu vidjeni u pravoj listi, samo
izmjereni u harnessu s istim klasama:

| test | opis | status |
| --- | --- | --- |
| T-S119-1 | ⭐ **Iznos vidljiv bez scrolanja** na Kokinom iPhoneu i na Androidu — lista `Financije_all`, redak s dugackim opisom | ✅ **26.08. uživo na PROD-u (Android)** — iznos uz desni rub, bez pomicanja ustranu|
| T-S119-2 | ⭐ **Kratica racuna** (`ZABA` / `RF`) sitnim sivim slovima u gornjem redu, izmedu datuma i iznosa | ✅ **26.08. uživo** — `RF` / `ZABA` sitno i sivo između datuma i iznosa|
| T-S119-3 | **Dvostrani iznos** (`Anja 73/96`, 25.08.2025.) — obje strane vidljive, slozene u dva reda; nijedna ne nestaje | ✅ **26.08. uživo** — `Anja 73/96` (25.08.2025.): `+450,00 €` i `−0,70 €` složeni jedan ispod drugog, obje strane vidljive|
| T-S119-4 | **Opis se prelama u dva reda** i zavrsava s „…" tek ako ne stane ni u dva; vodoravnog scrolanja nema | ✅ **26.08. uživo** — `neka dostava - rucnici i toster` prelomljeno u dva reda, bez vodoravnog scrolanja|
| T-S119-5 | **Kratki datum**: `25.08. ut` za ovu godinu, `25.08.25. po` za lanjski redak (godina se pojavi sama) | ✅ **26.08. uživo** — `25.08.25. po` (lanjski, s godinom) vs `26.08. sr` (ovogodišnji, bez nje)|
| T-S119-6 | ⭐ **Excel roundtrip za `Map`**: Structure export nosi kolonu `Map`, import je vrati — kratice prezive krug | ✅ **S120 (automatiziran)** — `e2e/tests/S119_list_columns_map.spec.ts`: export nosi `Map` → import ga zadrži → **brisanje ćelije ga ukloni**|
| T-S119-7 | Desktop lista **nepromijenjena** (dug datum, kolone jedna do druge, `Stanje` vidljivo) | ⬜ |

**Detalji:** [S119_tests.md](tests/S119_tests.md)

## S118 — Koka na PROD-u (2026-08-25)

**Sve iz migracije potvrđeno mjerenjem u sesiji** (2.312 eventa, zbrojevi identični TEST-u u
cent, pločica `13.239,31` / `796,43`, stara area obrisana bez ostataka). Otvoreno ostaje samo
ono što se nije dalo izvesti sa Sašinog laptopa ili je provjereno kroz `service_role`, dakle
mimo aplikacije:

| test | opis | status |
| --- | --- | --- |
| T-S118-1 | ⭐ `042`: nov atribut **kroz aplikaciju** zadrži slug s podvlakom (dosad provjereno samo kroz PostgREST, mimo app puta) | ⬜ |
| T-S118-2 | Structure roundtrip na PROD-u ne pomiče ništa (`Attributes updated 0`) | ⬜ |
| T-S118-3 | ⭐ Kokino sidro s **ekrana banke** — put koji na PROD-u nikad nije izveden (računica: jučer = očitano − današnji promet) | ⬜ |
| T-S118-4 | Saša kao **write grantee**: unos + upis i brisanje sidra u njenoj arei | ⬜ |
| T-S118-5 | Shortcutovi ponovno složeni u novoj arei; `set_attribute` i dalje računa `Datum naplate` | ⬜ |
| T-S118-6 | Ona radi **s mobitela** — uska lista, birač datuma, pločica | ⬜ |

**Detalji:** [S118_tests.md](tests/S118_tests.md)

## S117 — unos prepravljen za Koku (2026-08-24)

**Sve iz S116 provjereno istog dana** (`T-S116-1…5`, `-7/-8/-9`, `-10/-11/-12`). Otvoreno
ostaje samo ovo:

| test | opis | status |
| --- | --- | --- |
| T-S117-1 | ⭐ **Slobodna minuta pri unosu unatrag** — jedina grana novog koda koju testiranje nije okinulo (traži zauzetu minutu; uvezeni ZABA retci su na 14:00–14:13) | ⬜ |
| T-S117-2 | Birač datuma u Healthu (`add_header.date`, štoperica **ostaje**) | ⬜ |
| T-S117-3 | Konvencija `~` od kraja do kraja — upiši, nađi filtrom, **uredi isti redak**, popis prazan | ⬜ |
| T-S117-4 | Grantee vidi isto zaglavlje i ista skrivena polja (config je per-Area) | ⬜ |

**Detalji:** [S117_tests.md](tests/S117_tests.md)

**✅ Prošlo 24.08. uživo:** kolone po Arei (`T-S116-1…5`), uvoz kolovoza
(`13.239,31` + `796,43`), put „izvod" kod sidra (`-10/-11/-12`), guard krivog računa (`-9`),
zaglavlje po Arei, `HiddenInAdd`, roundtrip `Structure` bez izmjena (`Attributes updated 0`).

---

## S116 — kolone po Arei · `--iz-koke` · sidro

Puni koraci: [S116_tests.md](tests/S116_tests.md).

| Test      | Što                                                                                                                                         | Status                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| T-S116-1  | ⭐ Financije lista: `Datum \| Iznos \| Tip / Podtip \| Opis \| Stanje`; prazan iznos je `—`, nikad `0,00`; redak s obje strane pokazuje obje | ✅ 24.08. — sva 4 uvjeta `Stanje` kolone pokazana (pojava s filtrom po računu, hod, predznaci, rez na sidru)                                                                                                                                        |
| T-S116-2  | Generička Area **netaknuta** — točno kao prije S116                                                                                         | ✅ 24.08. — Health_Sasa: `DEFAULT_COLUMNS` doslovno, `balance` skriven jer nema `dashboard`                                                                                                                                        |
| T-S116-3  | Uski ekran: dva reda, iznos desno uz rub, `Stanje` skriven                                                                                  | ✅ 24.08.                                                                                                                                        |
| T-S116-4  | ⭐ **Roundtrip** — `ListColumns` sheet: izmjena `Label` preživi export→import; prazan popis vraća zadano                                     | ✅ 24.08. — oba smjera; usput nalaz: `Sep` nije preživio trim (popravljeno)                                                                                                                                        |
| T-S116-5  | Rename sluga `tip` povlači fixup kolona (prazna kolona zbog mrtve reference izgleda isto kao prazna zbog nedostatka podatka)                | ✅ 24.08. — **pao iz prve**: `depends_on` fixup je bio prepisan istim Save-om (popravljeno), kolone su prošle                                                                                                                                        |
| T-S116-6  | ⭐ Sidro ZABA stoji na **30.07.**, ono s 22.08. obrisano                                                                                     | ✅ 23.08.                                                                                                                                 |
| T-S116-7  | ⭐ Uvoz kolovoza ZABA (14 redaka) → **`13.239,31` @ 13.08.** ⚠ traži i MC naplatu `1.332,52` s `MC_2026-07.pdf`                              | ✅ 24.08. — `13.239,31 €` u cent. 14 Kokinih redaka (4 `Cash` ručno klasificirana kao `Transfer / cash - bankomat`) + MC naplata `1.332,52` @ **11.08.** (dospijeće s `MC_2026-07.pdf`, ne 13.08.). Potvrda iz **dva modela**: njen lanac 59 redaka, naš 15.                                                                                                                                        |
| T-S116-8  | Uvoz kolovoza RF (1 redak) → **`796,43`**                                                                                                   | ✅ 24.08. — `796,43 €`, 1 promjena poslije. Redak `18.08. RF naknada 2,69` ručno klasificiran (`Domaćinstvo / Bankovni troškovi`, 6/6 u povijesti baze — `--klasificiraj` ga nije uzeo jer broji iz Review snimke, ne iz baze)                                                                                                                                        |
| T-S116-9  | Alat stane kad delta sheet nije za traženi račun (regresija)                                                                                | ✅ 24.08. — ZABA sheet + `--tip-racuna Sasin tekuci` ⇒ poruka i **exit code 1** (ne samo ispis)                                                                                                                                        |
| T-S116-10 | ⭐ **Datum potvrde iz IZVORA, ne iz klika**                                                                                                  | ✅ 24.08. — put „izvod" prošao: prazno polje bez defaulta, gumb ugašen do datuma s papira, guard na budući datum. Usput: gumb je nudio klik koji bi guard odbio (popravljeno) |
| T-S116-11 | Rečenica o posljedici prije klika                                                                                                           | ✅ 24.08. — rečenica za put „izvod" viđena: iznos, datum, „prije toga već uključeno", posljedica promašaja |
| T-S116-12 | ⭐ Upozorenje kad **novija** potvrda već postoji (ispravak unatrag ne ispravlja ništa)                                                       | ✅ 24.08. — poruka nosi i izlaz („obriši je u povijesti potvrda") |
| T-S116-13 | ⭐ „povijest potvrda" + brisanje iz aplikacije; ▸ označava važeću                                                                            | ✅ 23.08. (⚠ **korak 3 — grantee bez ✕ — NIJE proban**)                                                                                   |
| T-S116-14 | ⭐⭐ **Očitanje s ekrana sidri se na JUČER** ⇒ današnja transakcija ostaje u saldu                                                            | ✅ **A, B, C** 23.08. · ⬜ D (prošli filtar), E (granica)                                                                                  |

**Brojke izmjerene u S116** (sve provjerene, ne procijenjene):

| Što | Vrijednost |
| --- | --- |
| `ZABA_2026-07.pdf` | close **2026-07-30**, POČETNO `2.255,64`, **NOVO `13.815,33`** |
| app iz sidra 01.07. na 30.07. | **`13.815,33`** (38 eventa) — Δ = 0, **netautološka provjera** |
| Kokin file `2026-08-23.xlsx` | 3.735 redaka; **175** nakon 30.07. |
| od toga dira saldo | ZABA **17**, RF **6** · kartice (MC 80 + Visa 72) su potovi |
| stvarno novih za uvoz | ZABA **14** (bez retka 2564), RF **1** |
| njen lanac ZABA 31.07.–13.08. | `13.815,33` → **`13.239,31`** ✓ kontrolni broj tranše 4 |
| njen lanac RF nakon 11.08. | `799,12` → **`796,43`** |
| retci s datumom kao TEKSTOM | **103**, svi iz 2023. (`'11.05.23.'`, `'28.6.23.'`, `'29.2.2024.'`) |

---

## S115 — mjerenje stanja · `845,12` · plan za PROD

Puni koraci: [S115_tests.md](tests/S115_tests.md).

| Test | Što | Status |
| --- | --- | --- |
| T-S115-1 | ⭐ ZABA pločica više nema liniju „planirano" (`845,12` obrisan) | ✅ **S120 (mjereno)** — `845,12` nema u bazi (0 redaka); **nijedan** redak nije `Planiran + Izvor=Racun` ⇒ pločica nema liniju „planirano"|
| T-S115-2 | ⭐ **Sidro prikazuje račun i bez ijednog eventa** | ✅ 23.08. — ali v. ⚠ ispod |
| T-S115-3 | Uvoz kolovoza ne donosi retke iz 2036. (travanj 2026. ostaje **111 eventa**) | ⬜ |
| T-S115-4 | ~~Kolone po Arei~~ — **zamijenjen s T-S116-1…5** (implementirano u S116) | — |

**Brojke izmjerene u S115** (sve provjerene, ne procijenjene):

| Što | Vrijednost |
| --- | --- |
| sidara u TEST bazi | **6** · ZABA najnovije `22.08. = 13.815,33` (⚠ krivi datum) · RF `11.08. = 799,12` |
| zadnji zapis po računu u bazi | ZABA **2026-07-30** · RF **2026-08-11** |
| Kokin file `Financije 2026-08-16.xlsx`, retci nakon 30.07. | „koka EU" **87** · „sasa EU" **68** — u bazi od toga **6** |
| MC naplata `1.332,52` | **nije u bazi** |
| `845,12` | postoji **samo** u `Financije 2026.xlsx`, bez datuma i bez opisa ⇒ obrisan |
| retci iz 2036. | **već u bazi** kao `2026-04-08` (`Prihodi/Koka`, `Informatika/Hosting domene`) |

---

## S112 — delta sheet (Faza 1) · datum-atributi · `planirano` filtar

⚠ **Preduvjet:** `sql/037` pušten **ponovno** nakon 2026-08-19 (split je dobio `Izvor` uvjet).
Puni koraci i očekivane brojke: [S112_tests.md](tests/S112_tests.md).

| ID | Test | Status |
| --- | --- | --- |
| T-S112-1 | ⭐ `Datum naplate` je pravi Excel datum; re-import nediranog exporta = **sve skipped** | ✅ (78 skipped, 0/0) |
| T-S112-2 | ⭐ `planirano` = **−2.089,86 (2)**, ne `−2.521,38 (13)` | ✅ |
| T-S112-3 | ⭐ Delta sheet: 9 redaka, otvarajuće `931,98`, kraj `712,75`, razlika **zelena** na 0,00 | ✅ (2026-08-21) |
| T-S112-4 | ⭐ **Tranša 1** — uvoz 7 novih redaka + ispravak `250,93 → 253,51`; RF na 04.08. = **1.716,55** | ✅ (2026-08-21) |
| T-S112-5 | Redak predloška: prazan se preskače uz upozorenje, **započet pada kao greška** | ⬜ |
| T-S112-6 | Sidro nakon usklađenja — sljedeći prozor kreće od njega (⚠ broj s ekrana banke) | ✅ (2026-08-21, sidro RF 11.08. = 799,12) |

## S113 — tranše 1–2 potvrđene izvodom · `fill_from_izvod.py` · layout izvještaja · podrijetlo sidra

Puni koraci: [S113_tests.md](tests/S113_tests.md).

| Test | Što | Status |
| --- | --- | --- |
| T-S113-1 | ⭐ Izvještaj o uvozu nosi layout uvezenog filea; `row_hash`/`Delete?`/`Result` ostaju vidljivi | ✅ (2026-08-21) |
| T-S113-2 | Sidro iz pločice ima `note` (i kad izvor nije upisan) | ⬜ |
| T-S113-3 | `fill_from_izvod.py` na ZABA izvodu — tranša 3 | ✅ (2026-08-22, ZABA @ 30.07. = **13.815,33**) |

## S114 — tranša 3 (ZABA) · klasifikacija iz povijesti

Puni koraci: [S114_tests.md](tests/S114_tests.md).

| Test | Što | Status |
| --- | --- | --- |
| T-S114-1 | ⭐ Sidro ZABA `30.07.2026. = 13.815,33`; sljedeći prozor kreće **31.07.** | ✅ **S116, potvrđeno mjerenjem S120** — `anchors.py`: `► 2026-07-30 = 13.815,33`, aktivno sidro|
| T-S114-2 | ⭐ Klasifikacija je u bazi: `T-mobile`, šest `0,70` kao **Parking**, `1.244,74` = `Izvrsen` + `Transfer` | ✅ **S120 (mjereno)** — `T-mobile`→`Informatika/Komunikacije_T-mobile`; svih 6× `0,70`→`Parking`,`Prijevoz/Taksi, Zet, Parking`; `1.244,74`→`Izvrsen`,`Transfer/izmedju racuna`|
| T-S114-3 | `--koka` na ZABA: **30 spareno, 8 bez para**; `0 spareno` = tiha regresija | ✅ **S120 (mjereno)** — `Kokini opisi: 30 spareno, 8 bez para`; `2026-07-17 9,51` = `Zoran povrat` (prozor `0/+1` drži)|
| T-S114-4 | Brana taksonomije: krivi podtip pada **prije** otvaranja targeta | ✅ **S120 (mjereno)** — `✗ Par ne postoji u taksonomiji: Informatika / Komunikacije_T-mobil`, izlaz **prije** otvaranja targeta (target je bio nepostojeći file)|
| T-S114-5 | Izvještaj o uvozu **nema** `DropdownData` (nalaz, čeka popravak) | ⬜ |

**Brojke koje se ne smiju izgubiti** (sve mjerene):

| Što | Vrijednost |
| --- | --- |
| delta prozor 60 dana, retci koji miču saldo | RF **9**, ZABA **15** |
| otvarajuće stanje 19.06.2026. | RF **931,98**, ZABA **1.978,09** |
| kontrolne brojke tranši | RF 04.08. **1.716,55** · RF 11.08. **799,12** · **ZABA 30.07. `13.815,33` (ispisano, potvrđeno)** · ZABA 09.08. **14.722,84** (Kokin lanac, još nedohvaćen) |
| tranša 3: izvod / već u bazi / novo | **38 / 7 / 31** · Kokini opisi **30 spareno, 8 bez para** |
| Kokini Visa retci 01–06/2026 koji su već u bazi | **207 od 208** |

---

## S111 — RF lanac zatvoren · `Cash` izvan salda · `038`

⚠ **Preduvjet za sve:** `sql/037` **ponovno** pušten (bez `Cash`) + **`sql/038`**.
Puni koraci i očekivane brojke: [S111_tests.md](tests/S111_tests.md).

| ID | Test | Status |
| --- | --- | --- |
| T-S111-1 | ⭐ Filtar datuma postoji na Overviewu **i ne resetira se** pri povratku na Activities | ⬜ |
| T-S111-2 | ⭐ Ispravak sidra = **novi redak** (dva sidra istog dana, vrijedi najnovije); Δ −5,00 | ❌ **BRIŠE SE** (v. zaglavlje) — krivo RF sidro `3.453,03` više ne postoji, test nema što provjeriti|
| T-S111-3 | ⭐ RF na 06.07.2026. = **461,82 €** (= ispisano na `RF_2026-06.pdf`), 196 promjena | ✅ **S120 (mjereno)** — RPC: `461,82` @ 06.07.2026., sidro 02.01.2025. = `3.458,03`, **196** promjena|
| T-S111-4 | ⭐ `Cash` ne miče saldo, ali zapis „Promjena guma" **postoji** i ide u Excel export | ✅ **S120 (mjereno)** — zapis postoji (`Cash`, 66,00, `auto C5/popravci`); filtar pločice = `izvorplacanja in [Racun]`; jedini `Cash` redak u bazi. ⚠ Korak 3 (redak u Excel exportu) nije izvršen — zapis postoji, pa ga export nosi po definiciji|
| T-S111-5 | ⭐ `038` — `zadnji zapis <datum> · prije N dana`, amber preko 7 dana; bez `038` redak **izostaje** | ⬜ |
| T-S111-6 | Skripte idempotentne, backupi na mjestu, zaštita blizanca blokira | ✅ **S120 (mjereno)** — `PLAN (0 od 9)` / `BLOKIRANO (9)`, `BRISATI → 0 pogodaka` (4+1); backupi nose `event`+`attributes`. ⚠ Zaštita blizanca **nije** izazvana: sve je već primijenjeno, pa nema retka koji bi pogodio|

**Brojke koje se ne smiju izgubiti** (sve mjerene, ne procijenjene):

| Što | Vrijednost |
| --- | --- |
| RF izvodi 03.01.2025 → 06.07.2026 | 196 tx, Σ `−2.996,21` ⇒ `3.458,03 − 2.996,21 = 461,82` (Δ **0,00**) |
| duplikati očišćeni u `fix_rf_duplikati.py` | 9 redaka, neto `−44,23`, **bruto 2.609,78** |
| ostatak u `fix_rf_ostatak.py` | 4 retka (`+20,28`) + 1 suvišan atribut (`−0,26`) |
| gotovina izvan salda (config) | `+66,00` |

---

## S110 — pločica prima `asOf` + provjera lanca salda

**Provjera lanca je ZATVORENA.** App reproducira banku i Kokin Excel do centa na oba kraja
intervala. Puni koraci: [S110_tests.md](tests/S110_tests.md).

| ID | Test | Status |
| --- | --- | --- |
| T-S110-1 | ⭐ Pločica prima `asOf` — podnaslov „na dan …", 2.546,55 na 31.03.2025., `dateFrom` se ignorira | ✅ (2026-08-17) |
| T-S110-2 | ⭐ „Potvrdi na `<datum>`" sidri **unatrag**, ne na danas; sidro `2025-12-31 = 1.184,86` presjeklo odstupanje (Δ `−200,14` → `−4,20`) | ✅ (2026-08-17) |
| T-S110-3 | ⭐ BUG-S110-DATESHIFT regresija — `Event #1` prati zaglavlje kroz 4 promjene datum/vrijeme | ✅ (2026-08-17) |
| T-S110-4 | Sanity guard 1900–2200 — neispravan datum daje **poruku**, ne tihi pad | ✅ **S120 (provjereno u kodu)** — guard 1900–2200 na sesiji **i** svakom eventu, poruka netaknuta (`EditActivityPage.tsx:845–861`). Test je regresijska sonda, ne rutinski korak|
| T-S110-5 | `split` („planirano") poštuje `asOf` ⚠ odgovor je namjerno polovičan (`Status` je stanje, ne povijest) | ⬜ |
| T-S110-6 | `make_saldo_anchors.py` — lanac 31 izvoda, `--report`, tautology guard, idempotencija | ✅ (programski) |
| T-S110-7 | ⭐ Lanac end-to-end: 31.03.2025. = 2.546,55 (3 svjedoka) · 08.07.2026. = 3.403,74 (Kokin broj) | ✅ (programski + UI) |

**Dva „pada" koja NISU pad:**

| Opažanje | Objašnjenje |
| --- | --- |
| Pločica pokazuje krivi broj uz aktivan filtar | Provjeri **godinu** u `To`. Prvi prijavljeni „pad" bio je filtar na `31/03/2026` umjesto `2025` — pločica je pokazala `591,98`, što je točan broj za taj datum |
| Vremena u bazi ne odgovaraju onima u listi | Baza drži **UTC**, app prikazuje **lokalno** (+2h ljeti). DB `07:00` = UI `09:00`. Bitno kad se traži slobodan `session_start` |

**Poznato odstupanje — ne istraživati ponovo:** `−200,14` na ZABA lancu 2025-08 → 2026-04,
četiri neopisana retka bez bankovne protustavke. Puni nalaz i odluka: `SALDO_MODEL_NALAZI.md` §6.3.

---

## S109 — sesija odluka (NEMA `src/` koda, nema novih testova)

Testiranje S108 skrenulo u dizajn: sidro na **danas** pokriva rupu u povijesti, sidro
**unatrag** je provjerava. Plan i obrazloženje: `NEXT_SESSION_PROMPT.md`.

**Tri „pada" koja NISU pad — ne istraživati ponovo:**

| Opažanje | Objašnjenje |
| --- | --- |
| Kolona `Stanje` sve `—` nakon drill downa | Dva neovisna i ispravna razloga: sidro datirano **danas** ⇒ ispod sidra saldo nije definiran (`useRunningBalance` uvjet 4); i svi vidljivi retci su `Izvor = Mastercard`, koji ne miču saldo (uvjet 3) |
| Parking redak (2026-07-07) se ne nalazi u bazi | Nije ni uvezen — batch 2026 rezan na 31.07., a redak je tada bio datiran `2026-08-07`. Treba ga **dodati kroz app**, ⚠ ne novim batchom |
| „planirano −2.521,38 (13)" ne reagira na sidro | Namjerno — `split` je **plain sum, nije usidren** (`BalanceByGroupTile:78`). „Što je još planirano" je pogled naprijed |

**Otvoreno za sljedeću sesiju (bit će testovi kad se napiše):** pločica prima `asOf`;
skripta mjesečnih stanja iz izvoda; provjera lanca (ZABA `3.403,74` na 08.07.2026.);
odluka o `Financije_all > Stanja`.

---

## S108 — Faza 1: RPC salda + Overview tab + pločica sa sidrom

**Preduvjet:** `sql/035`, `sql/036` i `sql/037` puštene na TEST — ✅ sve tri (2026-08-15;
`036` je pušten dvaput, druga verzija ispravlja `FULL JOIN`).

Prihvatni kriterij prošao **prije** pisanja UI-ja: RPC reproducira Python model (već validiran
protiv banke) **u cent** — ZABA `150,80`, RF `−1.978,32`. Naivni zbroj po `Racun`u dao bi
ZABA `−22.943,71`.

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-6 | `verify_rpc_vs_model.py`: B vs C 0,00, A vs B 0,00, sidro 0,00, D1b 634/634 | ✅ (programski) |
| P-7…P-12 | `rpc_area_balance_anchored` end-to-end: sidro zbraja, granica **stvarno** isključiva (1 redak na granici), grupa bez prometa se i dalje prikazuje, poziv bez prava 401, nepoznat slug 400 s imenom | ✅ (programski) |
| T-S108-1 | ⭐ Overview tab postoji samo uz `dashboard` config (OQ-4), redoslijed Overview → Activities → Structure | ✅ (2026-08-15) |
| T-S108-1b | Add Activity + “⚡ Use” rade i iz Overviewa; povratak nakon spremanja ide na Overview; leaf hint uz sivi gumb | ⬜ |
| T-S108-2 | ⭐ Pločica — ZABA 150,80 €, RF −1.978,32 €, „od početka podataka" | ✅ (2026-08-15) |
| T-S108-3 | „planirano" — ZABA −2.521,38 € (13) | ✅ (2026-08-15) |
| T-S108-4 | ⭐ Sidro: Δ čip ✅; **„Potvrdi" ✅ (2026-08-16)** — sidro 3.000 spremljeno, podnaslov prešao na „od potvrde 16.08.2026. · 3.000,00 € · 0 promjena poslije". Koraci **4–5 (transakcija poslije / prije sidra) još neisprobani** | 🟡 3/5 |
| T-S108-5 | Δ ostaje dok se ne slaže; ništa se ne mijenja bez Potvrdi | ⬜ |
| T-S108-6 | ⭐ Drill s pločice → Activities filtriran na račun / na `Status=Planiran` | ⬜ |
| T-S108-7 | ⭐ Izračunata kolona `Stanje` — silazi do salda, nestaje kod miješanih računa i obrnutog sorta | ⬜ |
| T-S108-8 | Rename sluga popravlja `dashboard.widgets[]`; pokvaren slug daje **imenovanu** grešku, ne 0,00 | ⬜ |
| T-S108-9 | Paginacija bez stabilnog sorta — Delete Area / Import Delete? nad >1000 atributa (regresija, nedeterministički) | ⬜ |
| T-S108-10 | „From template" nosi `settings` bez `export_profiles` i bez sidara | ⬜ |
| T-S108-11 | Read grantee vidi pločicu, nema „Potvrdi"; write grantee ima | ⬜ |
| T-S108-12 | Mobitel — polje „u banci" i čip vidljivi i upotrebljivi | ✅ **26.08. uživo na PROD-u (Android)** — polje „u banci" prima unos, čip i brojevi na ekranu, ništa ne ispada|
| T-S108-13 | Help zna za Overview — chipovi na tabu, odgovori o Δ i o sidru | ⬜ |

**Sljedeće nakon prolaza:** Faza 2 (brzi unos — §2.9, dvije sitnice nad postojećim
Shortcut sustavom), pa Faza 3 (Koka proba na mobitelu → odluka o cutoveru).

---

## S107y — `Pitanja za Koku` odgovoreno + popravci + batch 2025 uvezen

Sjedenje s Kokom: svih 14 pitanja odgovoreno. `fix_pitanja_koka.py` (novo) primijenio 3
popravka datuma (red 4996, redovi 2787+2788) i 3 brisanja (redovi 4997, 3609, 2004) na pravi
Review — verifikacija po `source_key`+iznos+datum prije pisanja, `.pre-pitanja-*` backup,
kontrola čista (Isplata delta 21,88 €, Uplata delta 1608,99 €, samo 3 retka promijenjena).
Zatim `make_financije_import.py --from 2025-01-01 --to 2025-12-31` → 1473 redaka → uvezeno u
TEST (Financije_all): **1473 created / 0 updated**. Spot-check OK (07.02.2025 Mirovina+Triglav
prisutni, `Rate?=TRUE` vidljiv, ukupno 2220 = 1473+747 iz S107v batcha).

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-7 | Programske kontrole (`fix_pitanja_koka.py` verifikacija, Σ u cent, samo 3 retka dirnuta, 0 dodanih) | ✅ (programski) |
| T-S107y-1 | ⭐ Import batcha 2025 u TEST app — 1473 new / 0 modify | ✅ (2026-08-13) |
| T-S107y-2 | Spot-check: 07.02.2025 Mirovina+Triglav, `Rate?=TRUE`, ukupno 2220 | ✅ (2026-08-13) |

**Sljedeće:** dogovor o Fazi 1 (`sql/035_area_group_agg.sql`, RPC `balance_by_group`) — sljedeći
session. Batch 2024/2023 se ne priprema unaprijed (vetting je usko grlo, ne generiranje).

---

## S107x — Faza 1a: model salda dokazan + popravci podataka + `Pitanja za Koku`

**Nema promjena u `src/`** — Python data-prep + dokumentacija. Model salda iz
`OVERVIEW_TAB_SPEC.md` §2.10 dokazan nad 4.996 stvarnih redaka **prije** pisanja RPC-a:
pravilo `Izvor ∈ {Racun, Cash}` reproducira bankovni pomak u **17/30 mjeseci u cent**,
naivni zbroj po `Racun`u u **0/30**. Usput otkriveno i popravljeno 69 redaka podataka.

⚠ Mjeri se **pomak** protiv banke, ne razina — Kokin `Stanje` lanac je razbijen sortiranjem
Reviewa po `event_date` (969 puknuća od 2.564), pa bi usporedba razine mjerila artefakt sorta.

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-7 | Programske kontrole (model 17/30, Review netaknut u fazi mjerenja, 49+80 ćelija, Σ u cent, 115 → 69 označenih) | ✅ (programski) |
| T-S107x-1 | ⭐ `Pitanja za Koku` — 14 redaka, dropdown radi, tekst pitanja čitljiv naglas | ✅ (2026-08-13, korišteno uživo s Kokom) |
| T-S107x-2 | `Datum naplate` popravak — redovi 3494 i 3931; nema drugih „nemogućih" osim 4997 | ✅ (2026-08-12) |
| T-S107x-3 | KEKS/trener — 20 redaka u `Zdravlje\|Sport_Sasa`, ona 2 netaknuta | ✅ (2026-08-12) |
| T-S107x-4 | ⏸ Odluka o 8 „prekasnih" redaka (traži sud, nije test) | ⬜ (backlog, i dalje otvoreno) |
| T-S107x-5 | Sjedenje s Kokom — popuni `Odluka`; ⚠ ne pokretati generator ponovo (briše odgovore) | ✅ → S107y |

**Nakon T-S107x-5: batch 2025** ✅ **IZVRŠENO — v. S107y iznad.**

---

## S107w — `Delete?` kolona + izvještaj nakon uvoza kao radni file

Excel roundtrip je znao dodati i izmijeniti zapis, ali **ne obrisati** — rupa koja se osjeti
čim netko slučajno napravi kopiju retka. Sad: kolona **`Delete?`** (dropdown `DELETE`/prazno,
crveni CF, unutar autofiltera, **vidljiva**) + **zaseban delete guard** (vlastiti popis i
vlastita kvačica — „da, promijeni" nikad ne znači i „da, obriši") + **izvještaj koji se sam
skine nakon Applya i JEST radni file**: običan export dirnutih zapisa, pravi `event_id`,
ispravan `row_hash`, `Delete?` već na njemu ⇒ krivu kopiju označiš `DELETE` i uvezeš taj isti file.

Novo: `src/lib/excelImportReport.ts`, `loadEventsByIdsForExport()`. Parent lanac pada **tek kad
ode zadnji zapis sesije** (pravilo iz `AppHome.handleDeleteActivity`, S104). Delete se odvaja
**prije** `row_hash` skipa — otisak ne pokriva zastavicu, pa bi inače nedirani redak s `DELETE`
ispao kao „unchanged" i brisanje bi tiho nestalo.

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-5 | Programske kontrole (typecheck+build, E2E, regresija 11/11, `hasChanges` → `computeRowDiff`) | ✅ (programski) |
| T-S107w-1 | E2E: ⭐ puna petlja — kopija → uvoz → izvještaj → `DELETE` u izvještaju → uvoz → zapis obrisan; Apply disabled do kvačice | ✅ (Playwright pass) |
| T-S107w-2 | E2E: `TRUE` u `Delete?` = greška, uvoz se ne otvori | ✅ (Playwright pass) |
| T-S107w-3 | E2E: ponovni uvoz nediranog izvještaja = no-op (dodatne kolone desno ne lome parsiranje) | ✅ (Playwright pass) |
| T-S107w-4 | **Saša:** Excel izgled — dropdown samo `DELETE`, crveni redak, Excel odbija proizvoljan tekst, nema „repair" | ✅ (2026-08-12) |
| T-S107w-5 | **Saša:** sort po drugoj koloni **ne rasparuje** zastavicu od retka | ✅ (2026-08-12) |
| T-S107w-6 | **Saša:** izmjena + brisanje u istom fileu → **dva** bloka, **dvije** kvačice, Apply traži obje | ✅ (2026-08-12) |
| T-S107w-7 | **Saša:** `Financije_all` — obriši jedan testni redak; ostali zapisi istog dana ostaju (klasa T-BUGG-5) | ✅ (2026-08-12, testni redak kreiran kroz Add Activity) |
| T-S107w-8 | **Saša:** ⭐ Fitness — sesija s 2 zapisa: brisanje prvog **ne ruši** parent lanac, brisanje drugog ga ruši | ✅ (2026-08-12, na novoj scratch `S107w Test` aredi — `sql/034_s107w_test_area.sql`) |
| T-S107w-9 | **Saša:** izvještaj kao radni file — sadrži samo dirnute zapise, `Deleted` sheet, re-import radi | ✅ (2026-08-12, uklj. "copied row" dedup slučaj) |

**Fail ako:** brisanje makne više od označenog · parent lanac padne dok sesija još ima zapise ·
zastavica preživi sort na krivom retku · jedna kvačica otključa oboje · izvještaj se ne skine
ili se ne da ponovo uvesti.

---

## S107v — batch import 2026 + čitljive greške pri brisanju Aree

**Import:** `Financije_all_import_20260804_083908.xlsx`, **747 redaka**, 02.01. → 11.07.2026.
Rez na `--to 2026-07-31` namjerno izostavlja **dva retka s krivim `event_date`** koje je ova sesija
našla (red 4996 parking 1,60 € — `Stanje` lanac ga stavlja u 04.–08.07., ne 07.08.; red 4997
MC 21,88 € — `Datum naplate` 10 mjeseci **prije** kupovine, moguć duplikat reda 4247, **čeka Koku**).

**App kod:** `src/lib/deleteErrors.ts` (novo) — `classifyDeleteError()` pretvara sirovu Postgres
grešku u naslov + objašnjenje + konkretne korake, uz original iza „Technical details". Pokriva FK
violation (tuđi `event_attributes` koje RLS skriva), trigger `P0001`, `42501`, istekli JWT, mrežu.
Uz to: **predprovjera vlasništva** (grantee vidi „You are not the owner", gumbi disabled) i
**`SilentNoOp`** — RLS-blokiran DELETE vraća uspjeh s 0 redaka, što je dosad izgledalo kao da je
brisanje prošlo. `sql/033_delete_area_cascade.sql` (novo) — generički SQL cascade + dijagnostika.

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-8 | Programske kontrole (4 tihe rupe, guard, 0 duplih `session_start`, klasifikator na 6 oblika grešaka, typecheck+build) | ✅ (programski) |
| T-S107v-1 | **Saša:** ⭐ batch import 2026 — **747 new**; dan s 13 transakcija daje **13 redaka**; spot-check 3 retka + jedna rata | ✅ (747 eventa uvezeno u TEST, dokazano exportom 11.08.) |
| T-S107v-2 | **Saša:** brisanje `Financije_2` — čitljiva poruka umjesto sirovog `23503`, original iza „Technical details" | ⬜ |
| T-S107v-3 | **Saša:** grantee → „You are not the owner" + sva tri gumba disabled | ⬜ |
| T-S107v-4 | **Saša:** `sql/033_delete_area_cascade.sql` — SECTION 2a roster (tko ima zapise + `role`) i 2b **jesu li policyji iz `020_orphan_rls.sql` na TEST-u** (određuje je li UI fix moguć) | ⬜ |
| T-S107v-5 | **Saša:** Delete modal na `Financije_2` — sivi panel s **Owner:** i **popisom po korisniku** s brojem zapisa | ✅ (Owner: sladosa, 774 sve njegovo — **i to je oborilo prvu dijagnozu**) |
| T-S107v-6 | **Saša:** ⭐ **pravi uzrok** — obriši `Financije_2`: mora **proći do kraja** | ✅ (obrisane i `Financije_2` i `Financije`) |
| T-S107v-7 | **Saša (PROD, kad se opet dogodi):** View nakon Finish — ako ne otvori, ekran sad kaže **„Couldn't load this activity"** + tekst greške + **Try again**. **Pošalji tu poruku** — ona je dijagnoza koju dosad nismo imali. Ako piše „Activity not found", uzrok je drukčiji (zapisa stvarno nema) | ✅ **2026-08-26 uživo na PROD-u** — ekran se pojavio (`57014`), `Try again` učitao aktivnost|
| Regresija | E2, E3, E4 (3), E5 (5), E6 (3), E14 (2), S104_delete_bug, S107_row_hash (2) — **20/20 PASS** prije mergea na main | ✅ (jedan flake T-S107-2 u prvom prolazu, ne reproducira se u 2 ponovna pokretanja) |

### ⚠ PRAVI UZROK (nađen T-S107v-5): PostgREST `max-rows = 1000`

Roster je pokazao da su **sva 774 eventa Sašina** — dakle RLS/tuđi podaci **nisu** bili uzrok.
Izmjereno na TEST bazi: `event_attributes` → `Content-Range: 0-999/24729`, **vraćeno 1000**.
Svaki `select` tiho staje na 1000 redaka, **bez greške**. `Financije_2` ima ~10.000
`event_attributes` ⇒ kaskada obriše prvih 1000, pa `DELETE` na eventima padne preko ostatka.

**Fix:** `src/lib/supabasePaging.ts` (novo) — `fetchAllPaged` / `fetchAllPagedIn`; napreduje za
**stvarno vraćeni** broj redaka, pa radi i ako je cap drukčiji od 1000. Primijenjeno na sva tri
neograničena SELECT-a u kaskadi (`events`, `event_attachments`, `event_attributes`) i na roster.
Verificirano na živoj TEST bazi: **24.729 redaka u 26 poziva** (prije 1000 u 1).

`excelDataLoader.ts` je za tu granicu **već** znao (`.limit()` + `.range()`) ⇒ Excel export i
backup nisu bili pogođeni. `useActivities` koristi `.range()`. Pogođena je bila samo kaskada.

### View nakon Finish ne otvara (PROD, Fitness/Strength) — dijagnostika, ne fix

Saša: nakon Finish View često ne otvori, Edit otvori, i nakon Edit→Save View radi.
**Eliminirano dokazima:** format `session_start` (Edit i View traže evente **identičnim** upitom);
`user_id` (PROD podaci: 0 NULL, jedan jedini `user_id`, `session_start` uredno zaokružen na minutu);
`categoryCache` truncation (PROD ima **30** kategorija, daleko ispod 1000); Excel/backup truncation.

**Nađeno umjesto toga:** `_fetchActivityData` je **svaku** grešku hvatao i vraćao `null`, a
ViewDetailsPage je `null` prikazivao kao **„Activity not found"** — isti mrtvi ekran za „zapisa
nema" i za „upit je pukao", bez teksta greške i **bez Retry**. Zato bug nikad nije bio dijagnostičan.
**Fix:** greška se propagira (`takeLastFetchError`), View razlikuje ta dva slučaja i nudi
**„Try again"**. Uzrok se hvata sljedeći put kad se dogodi — v. T-S107v-7.

⚠ **Zamka:** kad se red 4996 riješi, **ne** generirati ga novim batchom — dobio bi `09:00` na dan
koji je već uvezen. Dodati kroz app ili export → uredi → import.

---

## S107u — bugfix: nova Area gubi `comment_template` pri Structure importu

**Nađeno pri T-S107t testiranju** (`Financije_all` Area panel imao praznu „Auto-comment
template" iako je u fileu `{racun}/{tip}/{podtip}`). `dbAreas` je snapshot **prije** importa pa
za tek stvorenu Areu §8 (`comment_template`) i §9 (`Automations`) oboje rade
`{ ...existingArea?.settings }` nad `undefined` ⇒ §9 piše preko §8. Pogađa samo Aree stvorene
**u istom** importu koje imaju i CommentTemplate i Automations redak. Fix: `findOrCreateArea`
gura novu Areu u `dbAreas`. (`structureImport.ts`)

**Drugi dio S107u — `disable_save_plus` u roundtripu:** nova kolona **`DisableSavePlus`** (kol. T,
grouped+collapsed, DV `TRUE/FALSE`) na **Area** retku `Structure` sheeta. §8 sad piše
`comment_template` i `disable_save_plus` **jednim** upisom. Odsutnost kolone = postavka se ne dira;
prazna ćelija = `FALSE`. Roundtrip `AreaSettings` sad pokriva 3 od 4 ključa — ostaje `export_profiles`.

**Koraci T-S107u-3:**
1. Na `Financije_all` uključi `Disable "Save+"` u Area panelu → Save
2. Structure tab → Export → u `Structure` sheetu kolona **T `DisableSavePlus`** = `TRUE` na Area
   retku (kolona je collapsed — otvori grupu ili idi na ćeliju `T8`); Category/Attribute retci prazni
3. Uvezi taj file natrag → `Disable "Save+"` **ostaje uključen**, „Attributes updated 0"
4. U fileu promijeni `TRUE` → `FALSE`, uvezi → kvačica se **isključi** (dokaz da radi u oba smjera)
5. Uvezi **stari** file bez te kolone (`Financije_all_structure_20260801_172202.xlsx`) → postavka
   **ostaje nepromijenjena** (odsutnost ne briše)

**Fail ako:** kolone nema u exportu · uvoz ne mijenja kvačicu · stari file bez kolone je resetira ·
`comment_template` se izgubi pri bilo kojem od ovih uvoza (regresija na §8 spajanju)

| ID | Test | Status |
| --- | --- | --- |
| T-S107u-1 | **Saša:** obriši `Financije_all` → Structure import → Area panel ima `{racun}/{tip}/{podtip}` u „Auto-comment template", a Automations i dalje javlja **2** | ✅ (template + Preview `[racun]/[tip]/[podtip]` vidljivi u Area panelu) |
| T-S107u-3 | **Saša:** `disable_save_plus` roundtrip — vidi korake ispod | ✅ (oba smjera: TRUE→FALSE potvrđen kroz bazu + export + „Save +" u Add Activity; FALSE→TRUE kroz panel + nestali „Save +"; stari file bez kolone **ne resetira** postavku) |
| T-S107u-4 | **Saša:** panel više ne prikazuje staru vrijednost nakon importa (bez reloada) | ✅ (kvačica se ažurirala bez reloada) |
| T-S107u-5 | **Saša:** uvoz koji mijenja SAMO postavke javlja **„Settings updated: 1"** umjesto „Nothing to import" | ✅ (Settings updated 1, Automation rules 2, ostalo 0) |
| T-S107u-2 | (backlog, ne blokira) `groupAttributes` uzima `Default` s prvog retka grupe ⇒ atributski `default_value` ovisi o redoslijedu redaka; export piše `*` prvi, generator zadnji → `Status.default_value` `Izvrsen`↔`null` klackanje. Fix: ignorirati `Default` na retku koji ima `DependsOn` (pripada u `default_map`) | ✅ **POPRAVLJENO S117** (v. `CLAUDE.md` → Open bugs) — export više ne piše `defaultVal` za `depends_on` atribut|

---

## S107t — `Rata br` · čišćenje lažnih rata · import generator · `rata` u Automations roundtripu

**App kod (prvi put nakon S107f):** `Automations` sheet proširen na **`rata`** akciju
(export+import) — zadnja rupa roundtripa uz `export_profiles`. **Rata tok prebačen na model B
i novi model datuma:** sve rate jedne kupovine dijele `event_date` = dan kupnje, razlikuje ih
`Datum naplate` + pomak `session_start`-a za 1 min; `Rata br` = 1..N. **D1 iznimka za rate
ukinuta, D1a (`Datum kupovine`) povučen** — atribut izbačen iz strukture.

**Python:** `make_financije_import.py` (novo) — Review → `Activities Events` xlsx, sve 4 tihe
rupe ugrađene + guard imena/tipova atributa protiv strukture. `fix_lazne_rate.py` (novo) —
**32** HLK/APN retka gdje je `mjesec/godina` pročitan kao `rata n/N` (ne 19 kako je isprva
procijenjeno; `Broj rata = 24` je isti obrazac).

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-9 | Programske kontrole (paritet `validation_rules`, diff protiv backupa, simulacija oba parsera, typecheck+build) | ✅ (programski) |
| T-S107t-1 | **Saša:** Structure import — 15 atributa (⚠ ne 16), **Automation rules 2** | ✅ (1 area / 1 kat. / 15 attr / 2 rules / 0 skipped) |
| T-S107t-2 | **Saša:** `Rata br` se pojavljuje/nestaje zajedno s `Broj rata` | ✅ (Not set → No → Yes; oba se pojave/nestanu zajedno; `Datum naplate` auto 11.09. za Mastercard) |
| T-S107t-3 | **Saša:** ⭐ **rata tok** (novi kod) — rate na istom danu, `Datum naplate` 11./3., `Rata br` 1..N, bez zapisa s punim iznosom | ✅ (300/3: modal 3×100 · 3 reda na današnjem danu 19:11/12/13 · 13 = 10+3 ⇒ nema zapisa od 300 · rata 3: `Isplata` 100, `Rata br` 3, naplata 11.11.2026, `Status` Planiran, komentar `…/Hrana i ostalo · rata 3/3 · 100 od 300`) |
| T-S107t-4 | **Saša:** Activities import 10 zapisa — 28.02.2023. daje **3 reda**, `Rate? = Yes` na Anjinoj rati | ✅ (Anja redak: `Rate?`=Yes, `Broj rata` 96, `Rata br` 43, Uplata 450, `Prihodi`/`Povrat Anja`, naplata 28.02.2023, `Stanje` 1744,76, „3 empty" = točno Isplata/Izvod opis/Valuta) |
| T-S107t-5 | **Saša:** export roundtrip — `rata` redak u Automations sheetu, re-import bez promjena | ✅ (export: oba retka s punim `rata` kolonama · Activities re-import **0 new / 0 modify / 10 unchanged (skipped)** ⇒ `row_hash` skip radi · Structure re-import: 1 attr updated = `Status.default_value`, v. T-S107u-2, i „Automation rules 2" = brojač pročitanih, ne zapisanih) |
| T-S107t-6 | **Saša:** obrisan `rata` redak pri uvozu **ne briše** konfiguraciju | ✅ (import: „Automation rules 1" + 0 updated + „Nothing to import"; modal nakon toga i dalje radi — 400/2 → 2×200, naplate 11.09./11.10.) |
| T-S107t-7 | **Saša:** Review — 32 očišćena retka, `Rate?=DA` 661 → 629 | ✅ (32 redaka, svih 32 `Rate?`/`Broj rata` prazni — filter nudi samo „(Blanks)"; `Rate?=DA` **629** od 4996, prije fixa 661 i svih 32 bilo DA; `Tip`/`Podtip` 0 promjena vs backup) |

**Sljedeće:** popravci iz testova → batch import po godinama → `Financije_all` na PROD pod
Kokinim računom (D6). **Ostaje neizvršeno:** 15 nemarkiranih rata; `Saldo kontrola` 7 razlika
(pitanja za Koku); `export_profiles` roundtrip rupa.

---

## S107s — odluke o formatu importa + generator strukture `Financije_all` (Python; NEMA app koda)

Sve otvorene odluke oko app-import Excela donesene (`session_start`, `comment` vs atribut,
`Valuta`, `Sort`, email u kol. G). **`make_financije_all_structure.py` (novo)** generira
Structure Excel za novu areu iz PROD exporta + `Taksonomija` sheeta: 15 atributa,
Tip/Podtip regenerirani (18/65), `Napomena` → **`Izvod opis`**, novi `Datum naplate`/
`Datum kupovine`, Unit EUR, `Valuta` bez defaulta, `Automations` set_attribute pravilo.

**Četiri tihe rupe u importu nađene čitanjem koda** (sve u `NEXT_SESSION_PROMPT.md` DIO 2):
`session_start` mora biti **tekst** (inače svi redovi → 09:00 bez upozorenja) · krivo ime
atributa se gubi **bez greške** · `Rate?` je boolean pa bi `'DA'` postao **FALSE** · email u
kol. G mora biti račun koji **izvodi** import (inače se svi redovi preskoče kao „tuđi").

| ID | Test | Status |
| --- | --- | --- |
| P-1…P-7 | Programske kontrole (dry run, simulacija `buildValidationRules`, `\|` u taksonomiji, `DateMap`, CommentTemplate, Automations zaglavlje, SORT_ORDER pokrivenost) | ✅ (programski) |
| T-S107s-1 | **Saša:** pregled generiranog structure filea | ✅ (Sort OK; nalaz „stara taksonomija" bio je pogled u BASE `events_export_preview`, ne u generirani file) |
| T-S107s-2 | **Saša:** Structure import u TEST | ✅ (16 atributa / 1 pravilo) — **nadomješten T-S107t-1** jer se struktura promijenila |
| T-S107s-3 | **Saša:** Add Activity — lanac `Racun→Izvor→Status`, `Tip→Podtip`, EUR, `Datum naplate` auto | ✅ (potvrđeno na ekranu) |

**Sljedeće:** `make_financije_import.py` (10 zapisa u TEST) → spot-check → export roundtrip
→ batch po godinama. **Izmjereno ali neizvršeno:** 15 nemarkiranih rata; `Datum kupovine`
na ratama (199 grupa, 105 s ratom 1, anker aritmetički); `automations.rata` prijenos.

---

## S107r — migracija na Kokinu taksonomiju `Taksonomija (2)` (Python data-prep; NEMA app koda)

Koka složila vlastitu taksonomiju (18 Tipova; novi `Kuća`/`Prihodi`/`Prijevoz`/`Advokati`,
ukinuti `Namirnice`/`Mirovina`/`Povrat`/`Ostali prihodi`/`Ostavine`). **2061 od 3426
klasificiranih redaka (58 %)** nosilo je par kojeg više nema — bez migracije bi ih
`apply_rules.py` tiho resetirao na N/A.

Novo: `migrate_taksonomija.py` (remapira **4** mjesta istom tablicom), `Preimenovanja`
uvjetne kolone (`Smjer uvjet`/`Iznos min`/`Iznos max`/`Napomena uvjet`) + `--only-renames`,
`Tools/backup_to_external.bat`. `Pravila` 70 → **71**, `Tip_AI` 911 remapirano, `Neklasificirano` 10.
**`Pouzdanost` distribucija identična — `VISOKA` 1014 → 1014**, Σ novca delta 0,00.

| ID          | Test                                                                                      | Status         |
| ----------- | ----------------------------------------------------------------------------------------- | -------------- |
| T-S107r-A…F | Regresija `--dry`, pokrivenost 2061/2061, lanac na kopiji, integritet, rekonsilijacija brojki, sync | ✅ (programski) |
| T-S107r-1   | **Saša:** spot-check 2061 retka — `Tip_O` stari par + `Pouzdanost` raspored nepromijenjen (⚠ kriterij ispravljen: `PRAVILO` na 661 retku je legitimno, od prije migracije) | ✅ (2061 + `VISOKA` 646) |
| T-S107r-2   | **Saša:** 4 uvjetna slučaja — `Prihodi\|Povrat Anja` **45**, `Transfer\|Anja` **27**, `Kuća\|Holding (smeće)` 91, `Investicije\|Štednja` 1 | ✅              |
| T-S107r-7   | **⚠ NALAZ → IZVRŠENO:** 4 rate Anjine posudbe (397, 3727, 3612, 3613) pale u `Transfer\|Anja` zbog anomalije u izvoru (`Smjer=Isplata` uz `Uplata`=450; rata plaćena 400+50). `fix_anja_rate.py` (novo, guard po `source_key`+Napomena+iznos). `Prihodi\|Povrat Anja` 41→**45**, svi `X/96` na jednom mjestu | ✅ (Saša: vizualna potvrda 4 retka, filter `Pravilo run` = `2026-07-30 12:08`) |
| T-S107r-3   | **Saša:** `Taksonomija`/`_v1`/`Preimenovanja` (33 reda) + dropdowni rade na svim redcima   | ✅              |
| T-S107r-4   | **Saša:** `Pravila` 71 red; 2× Anja u pravom redoslijedu; `grobn` iznad `NAKNADA`          | ✅              |
| T-S107r-5   | **Saša:** `Tip_AI` filtriran na stare vrijednosti = 0 redaka                               | ✅              |
| T-S107r-6   | **Saša:** `backup_to_external.bat` dvoklikom — `[OK] Backup zavrsen`, 0 FAILED. `*EXTRA File` linije su **namjerne**: 12 starih `.pre-*` backupa koje `/E /XO` bez `/MIR` prijavi ali **ne briše**. Provjereno: lokalno 179 / na D: 191 fajlova, **0 lokalnih fajlova nije backupirano** | ✅              |

**✅ S107r ZATVOREN — svih 6 Sašinih + svih 6 programskih testova prošlo, 0 otvorenih stavki.**

**Sljedeće:** layout faza 1 (`sheet_layout.py`, header red 3 / freeze / collapsed help);
`srednja` (205) i `niska` (1023) traka nad NOVOM taksonomijom; AI re-run + **nov eval**
(stari baseline 81,5 % je mjeren na staroj taksonomiji).

---

## S107p — harvest `visoka` trake (Python data-prep; NEMA app koda)

`apply_ai.py --harvest`: 347 redaka preneseno `Tip_AI`/`Podtip_AI` → `Tip`/`Podtip` (Saša prošao
`visoka` + dio `srednja`/`niska`). 3 retka preskočena (861/887/3166 — imali ručni `Tip`, `OK`
ostaje trajno kao poznat ne-bug slučaj). Preostalo po traci: visoka 2, srednja 205, niska 1023.

| ID          | Test                                                                                     | Status         |
| ----------- | ---------------------------------------------------------------------------------------- | -------------- |
| T-S107p-A…D | Dry vs pravi harvest identični brojevi, report konzistentan, remaining-po-traci izračun   | ✅ (programski) |
| T-S107p-1   | **Saša:** vizualni pregled 347 novoklasificiranih redaka (`Labela iz` = `AI:* 2026-07-28`) | ⬜              |
| T-S107p-2   | **Saša:** 3 preskočena retka i dalje imaju ručni `Tip`, `AI odluka` ostaje `OK` (namjerno)  | ⬜              |

**Sljedeće:** `srednja` traka (205), pa `niska` (1023). V. `NEXT_SESSION_PROMPT.md`.

---

## S107o — kolona `AI odluka` + 2 odobrena popravka IZVRŠENA (Python data-prep; NEMA app koda)

Mehanizam za bilježenje odluke o AI prijedlogu nije postojao — T-S107n-1 je bio neizvediv
kako je napisan. Sad: kolona **`AI odluka`** (`OK`/`NE`/`?`) + `apply_ai.py --harvest`.
Review **5004 → 4996** redaka (−636,36 € dvostrukog troška), `Pravila` 69 → **70**.

| ID          | Test                                                                                     | Status         |
| ----------- | ---------------------------------------------------------------------------------------- | -------------- |
| T-S107o-A…E | Kolona na kopiji, harvest ciklus s rubnim slučajevima, eval guard, dedup, pravilo         | ✅ (programski) |
| T-S107o-1   | **Saša: GLAVNI POSAO** — `visoka` traka (261 redaka / **31 par**), upiši `OK` po grupi     | ✅ (S107p — prošao i dio srednja/niska) |
| T-S107o-2   | **Saša:** kontrola nakon `--harvest` — `OK` očišćen, `Labela iz` = `AI:visoka …`          | ✅ (S107p harvest, brojke se poklapaju; T-S107p-1 čeka vizualnu potvrdu) |
| T-S107o-3   | **Saša:** 8 Kokinih redaka dobilo `Izvod opis`; izvodnih parnjaka nema                     | ⬜              |
| T-S107o-4   | **Saša:** `freeze_panes` `F4855` → `F2` — odgovara li ti tako                              | ⬜              |

**Odobreno a NIJE izvršeno:** `reconcile_izvoda.py` matcher po `Datum naplate`+iznos (jedino
preostalo od tri S107n stavke — ne dira Review, može bilo kad).

---

## S107n — AI `--run` IZVRŠEN (1593 prijedloga) + duplikati rata (Python data-prep; NEMA app koda)

`ai_classify.py --run` napisan i pokrenut. **1593 retka** ima `Tip_AI`/`Podtip_AI`/`Pouzdanost_AI`/
`AI run`; `Tip`/`Podtip` netaknuti. **visoka 261 · srednja 239 · niska 1093** · NEPOZNATO 196 · $1,17.
⚠ `visoka` 16 % (eval je davao 57 %) — N/A hrpa je teži ostatak, bulk-accept traka je tanka.
**NALAZ: 8 duplikata rata, 636,36 €** (odobreno, nije izvršeno). Detalji: ENRICH_PLAN §2l.

| ID          | Test                                                                                                                           | Status         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| T-S107n-A…I | Umetanje kolona na kopiji, dry/limit modovi, recovery nakon pada kredita, eval regresija, kontrola upisa, skeniranje duplikata | ✅ (programski) |
| T-S107n-1   | **Saša: GLAVNI POSAO** — pregled AI prijedloga, sort po `Pouzdanost_AI`, kreni od `visoka`                                     | → T-S107o-1 (mehanizam sad postoji) |
| T-S107n-2   | **Saša:** kontrola — svaki redak s `AI run` mora imati `Tip` = N/A/prazan                                                      | ✅ (Claude programski, 0 kršenja) |
| T-S107n-3   | **Saša:** 196 `NEPOZNATO` — je li stvarno neodredivo iz teksta                                                                 | ⬜              |
| T-S107n-4   | **Saša:** Agram — ožujak=C5 / listopad=Lacetti? (blokira popravak pravila #43)                                                 | ◐ (par 4505 potvrdio ožujak=C5; ostatak čeka Sašu) |
| T-S107n-5   | **Saša:** 8 duplikata rata — potvrdi da Kokin redak ostaje                                                                     | ✅ (potvrdio 2026-07-28, izvršeno) |
| T-S107n-6   | **Saša:** red 4759 BIBERON / "Amsteradam"                                                                                      | ⬜              |
| T-S107n-7   | **Saša:** freeze + collapse grupe prežive AI run                                                                               | → T-S107o-4 (freeze namjerno promijenjen na F2) |

**Sve tri odobrene stavke:** ~~fix 8 duplikata~~ ✅ S107o · ~~pravilo `voce i povrce`~~ ✅ S107o ·
`reconcile_izvoda.py` matcher po `Datum naplate`+iznos — **još otvoreno**.

---

## S107m — AI klasifikacija: eval + 223 ispravke labela (Python data-prep; NEMA app koda)

Eval naslijepo na već klasificiranim redcima. **v1 62,5 % → v2 80,3 % → v3 80,8 % / Tip 91,9 %**
(ručne labele, zamrznut uzorak 600). `visoka` pouzdanost = 95 % točno na 47 % redaka.
Nevaljanih parova **171 → 0**. Potrošeno na API ~$4,4. Puni kontekst: `NEXT_SESSION_PROMPT.md`.

| ID          | Test                                                                     | Status |
| ----------- | ------------------------------------------------------------------------ | ------ |
| T-S107m-A…J | Eval v1/v2/v3, razlaganje neslaganja, kontrola upisa, store, guardovi     | ✅ (programski) |
| T-S107m-1   | **Saša:** pregled 223 ispravljena retka (filter `Pravilo run`=2026-07-26) | ✅ (Saša 2026-07-27) |
| T-S107m-2   | **Saša:** Konzum/Radnička — 30 redaka, RATA retci ostaju `Namirnice`      | ✅ (Saša 2026-07-27) |
| T-S107m-3   | **Saša:** BIBERON — svih 55 `Projekti \| Sasa_Informatika`               | ✅ (Saša nabrojao 54; razlika objašnjena — red 4759 ima "biberon" samo u `Izvod opis`, `Napomena`="Amsteradam" → T-S107n-6) |
| T-S107m-4   | **Saša:** HAK raspored C5/Lacetti                                        | ✅ (OK) — **ali otkrio `Voćarna` red 4512 pod `AGRAM` pravilom → lančano do nalaza duplikata rata, v. S107n** |
| T-S107m-5   | **Saša:** `Investicije \| Dionice` vidljiv u dropdownu                   | ✅ (Saša 2026-07-27) |
| T-S107m-6   | **Saša:** freeze + collapse grupa prežive script run                     | ➡ **zamijenjen s T-S107n-7** — vodi se ondje|

**Riješeno u S107n:** `--run` mode napisan i izvršen (1593 prijedloga).
**Još otvoreno:** `source_key` fix i `sql/0NN_staging_financije.sql` nisu napravljeni.
**Detalji testova:** [S107k_tests.md](tests/S107k_tests.md) (novi) + [S107j_tests.md](tests/S107j_tests.md) + [S107i_tests.md](tests/S107i_tests.md) + [S107h_tests.md](tests/S107h_tests.md) + [S107g_tests.md](tests/S107g_tests.md) + [S107f_tests.md](tests/S107f_tests.md)
**Upute za izvode (i za Koku):** [UPUTE_izvodi.md](../../Claude-temp_R/UPUTE_izvodi.md) — kako skinuti/spremiti/obraditi bankovne izvode

---

## S107k — v3 Verdikt tok + date_accuracy + kartice_datum_naplate (Python, data-prep; NEMA app koda)

Svi pravi runovi IZVRŠENI ove sesije (v. S107k_tests.md). Review: 5004 redaka; **Datum naplate
100% popunjen**; Saldo kontrola 10→7; Nematchano_v3 **0 za odluku**; N/A 2026 = 178.

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107k-A | date_accuracy: 360 event_date → bankovni datum; dry=real; re-sort bez gubitka                                  | ✅ (programski)      |
| T-S107k-B | Harvest E2E ciklus (test kopija): prefill → harvest → v3 44→0; idempotentan                                    | ✅ (programski)      |
| T-S107k-C | "Used kandidat" zaštita: DUP ne sinka red matchan drugom tx; `Review (matchan)` info-only                      | ✅ (programski; bug uhvaćen i fiksan prije pravog runa) |
| T-S107k-D | kartice_datum_naplate spot-check: stm 2024-09→2024-10-08, 2026-06→2026-07-06; 0 naplata<kupovina; P3           | ✅ (programski)      |
| T-S107k-E | Saldo kontrola 10→7 bez novih razlika (2025-02, 2025-07 Astrum, 2025-08 riješene)                              | ✅ (programski)      |
| T-S107k-F | Claude tipfeler (sasa EU:549, 2024→2025) — DUP sync + pravilo #15 → Projekti                                   | ✅ (Saša otkrio)     |
| T-S107k-1 | **Saša:** vizualni pregled — filter `Pravilo run`=2026-07-23 (30 klasifikacija) + `Izvor reda`=Konsolidacija   | ✅ (Saša 2026-07-26) |
| T-S107k-2 | **Saša:** Datum naplate kontrola — Visa ~4.–8. u M+1; MC = 11. u M+1                                           | ✅ (Saša 2026-07-26) |
| T-S107k-3 | **Saša:** Saldo kontrola 7 preostalih — velike 3 = pitanja za Koku (2026-01 +359, 2024-09 +149, 2×±49)         | ⏸ BLOKIRANO — čeka Koku (nije test nego pitanja za nju) |

---

## S107l/m — N/A petlja 2026 (Python, data-prep; NEMA app koda)

S107l (2026-07-25, Sonnet): 3 kruga `suggest_candidates` → 42 nova pravila → **N/A 2026 178 → 85**.
Stanje u fileu 2026-07-26: Review 5004 redaka, **69 pravila** + 17 Preimenovanja, **N/A 2026 = 76**,
N/A ukupno 2424 (1606 s tekstom). PENDING_TESTS nije bio ažuriran u S107l — nadoknađeno ovdje.

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107l-1 | 3 kruga pravila (15+15+12) — svaki `--dry` prije pravog runa, backup lanac `.pre-*` kompletan                 | ✅ (programski)      |
| T-S107l-2 | Pravilo-review prije harvesta ulovio 4 problema (PAYPAL/KEKS PAY/GLS isključeni, NATURAL→Medical_Koka, NAKNADA vs `grobn` priority-order) | ✅ (programski)      |
| T-S107l-3 | Priority-order pattern: specifičnije pravilo (`grobn`) umetnuto IZNAD preširokog (`NAKNADA`) — prvi match pobjeđuje | ✅ (programski)      |
| T-S107m-1 | **Saša:** red 2115 `LJEKARNA OREBIC` Medical_Sasa → Medical_Koka (ručna izmjena u Excelu)                     | ✅ (Saša 2026-07-26) |

**Otvoreno za Koku (ne testovi — pitanja):** 700 € bankomat 26.11.2025 (2 PRESKOČENA v3 reda);
Saldo kontrola 7 razlika (2026-01 +359,43; 2024-09 +149; 2×±49 multisport; 3 sitna);
odluka o pre-2024 no-text N/A masi (~818 redaka, nema izvoda).

---

## S107j — ZABA parser fix + izvodi konsolidirani u Review + N/A rule petlja (Python, data-prep; NEMA app koda)

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107j-A | `parse_zaba_racun` fix: saldo-lanac Σupl/Σisp = bankov Zbroj prometa 40/40 u cent; lanac neprekinut 2023-26   | ✅ (programski verificirano) |
| T-S107j-B | `consolidate_review.py`: +113 (31 MASTERCARD→Transfer, 82 N/A); Nematchano_v3 57 + Saldo kontrola 21/31        | ✅ (programski verificirano) |
| T-S107j-C | `suggest_candidates.py`: Neklasificirano 2026 top 20, Tip/Podtip dropdowni; `backfill_napomena` 1870          | ✅ (programski verificirano) |
| T-S107j-1 | **Saša:** N/A klasifikacija petlja — Neklasificirano popuni → `--harvest` → `apply_rules` → sljedeći krug kraći | ⬜ (glavni put do PROD) |
| T-S107j-2 | **Saša:** `Nematchano_v3` pregled — dismiss dup, dodaj genuine missing                                        | ✅ (S107k Verdikt pass — 0 za odluku) |
| T-S107j-3 | **Saša:** `Saldo kontrola` — razlike → pitanja za Koku                                                        | → T-S107k-3 (sad 7)  |
| T-S107j-4 | **Saša:** Napomena backfill kontrola — 1870 popunjeno, Kokine ne-prazne netaknute (P3)                        | ⬜                   |

**Backlog (S107j):** ~~date-accuracy pass~~ ✅ S107k; per-month reconcile view za velike saldo razlike;
~~PBZ Visa Transfer stragglers~~ — provjeriti je li ostalo N/A "PBZCARD" redova nakon S107k pravila.

---

## S107i — PBZ Visa merge u Review + reconcile/Problem dijagnoza (Python, data-prep; NEMA app koda)

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107i-1 | `merge_pbzvisa.py`: 1538 PBZ tx → dedup 187 (tag-agnostički) → 1351 novih redaka; PREVIEW verificiran         | ✅ (0 sort padova, DV J/K prošireno, 3503 postojećih source_key netaknuto, 1351 nov jedinstven) |
| T-S107i-2 | Pravi merge run: Review 3504→4855, `Sašin RF\|Visa` 220→1571, backup napravljen                               | ✅ (verificirano skriptom) |
| T-S107i-3 | `apply_rules.py` na mergeanom: 257 klasificirano + 246 Napomena (konzum 230, bauhaus 16, parking 10)         | ✅ (dry=real brojevi, backup) |
| T-S107i-4 | `reconcile_izvoda.py`: Coverage PBZVISA 1538/1539 (bilo 1/1539); Nematchano_v2 257 + Problem dijagnoza        | ✅ (sheetovi u Izvodi_transakcije.xlsx, backup) |
| T-S107i-5 | **Saša Excel pregled:** `pbzvisa` novi retci (filter Izvor reda=`PBZ Visa:*`), RATA/lump ispravni, dropdowni  | ⬜ (Saša — vizualni pregled Reviewa) |
| T-S107i-6 | **Saša Excel pregled:** `Izvodi_transakcije.xlsx` → `Nematchano_v2` Problem kolona (39 Smjer? crveni, 51 nedostaje) | ⬜ (Saša — gdje su problemi) |

**⚠ NALAZ za backlog (ne test):** ZABA parser (`parse_zaba_racun`) krivo određuje Smjer za dio priljeva
(mirovina/Priljev iz inozemstva/uplate → Isplata) + saldo-lanac ne zatvara → account merge + bank
kolone (UplataB/IsplataB/SaldoB) + SaldoB reconcile BLOKIRANI dok se parser ne popravi. `merge_missing_account.py`
napisan i spreman, ali NE pokretati dok Smjer nije pouzdan (dry-run uhvatio greške, ništa upisano).

---

## S107h — drugi krug Pravila (Osiguranje/Allianz/Generali/Triglav, Audible/Apple po iznosu)

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107h-1 | Code review novih Pravila redova prije runa: `*osiguranje*`/`*porez*` zvjezdica-bug, Apple Podtip missing     | ✅ (nalazi potvrđeni, doveli do fixeva) |
| T-S107h-2 | Komentar → Alternativa dopisivanje (novi mehanizam u `apply_rules.py`)                                        | ✅ (compile + dry run čist) |
| T-S107h-3 | Osiguranje/Allianz/Generali/Triglav redizajn — sve u postojeće kategorije, Taksonomija red obrisan            | ✅ (Koka odluke primijenjene) |
| T-S107h-4 | Iznos min/max uvjet (novi feature) — Audible_Koka/Sasa split + Apple→iCloud otkriće                           | ✅ (compile + 0 kršenja praga) |
| T-S107h-5 | `update_pravila_s107h.py` — Pravila sheet regeneriran (AMAZON maknut, Apple/Audible split)                    | ✅ (verificirano dumpom) |
| T-S107h-6 | Pravi `apply_rules.py` run #2: 294 redova, +46 Napomena, 0 warninga                                            | ✅ (programski provjereno; Sašin vizualni Excel pregled pending) |

---

## S107g — prvi pravi apply_rules run + Pravilo/Preimenovanja prioritet

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107g-1 | Pravi `apply_rules.py` run: 196 preimenovano, 0 reset, 217 pravilo (7 pravila)                                | ✅ (programski provjereno; Sašin vizualni Excel pregled još pending) |
| T-S107g-2 | `Pravilo run` kolona kreirana i timestampana (413 = 196+217)                                                  | ✅ (programski provjereno) |
| T-S107g-3 | Pravilo nadvladava Preimenovanja (sintetički test)                                                            | ✅ (sintetički test)   |
| T-S107g-4 | `fix_sportski_rekviziti_split.py`: 23 multisport→Sport_Sasa, 3 Kreatin→Namirnice, 3 Decathlon netaknuto       | ✅ (verificirano)    |
| T-S107g-5 | `fix_tcom_tmobile_swap.py`: 2 retka (2281, 2282) zamijenjena po Izvod opisu                                    | ✅ (verificirano)    |
| T-S107g-6 | Nevenka Pavić uplata (red 2436) → Ostali prihodi                                                               | ✅ (verificirano)    |

---

## S107f — Datum naplate backfill + Preimenovanja + UI fix skrivenih atributa

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107f-1 | Kontrola backfilla: Racun/Cash `Datum naplate` = event_date (1631); Visa prazan; MC netaknut                  | ✅ (Saša potvrdio "OK") |
| T-S107f-2 | **GLAVNI POSAO:** Preimenovanja sheet popuna (4 prazna para + pregled prijedloga) → apply_rules --dry → run   | ✅ (izvršeno S107g, v. gore)     |
| T-S107f-3 | UI fix (test-branch): shortcut Strength — Strength_type vidljiv, Activity expand pokazuje poruku, engleski    | ⬜ (netestirano ove sesije — PROD/mobitel)                   |

---

## S107d — inventory izvoda + MC/PBZ parseri (Python, data-prep; NEMA app koda)

| ID        | Test                                                                                                        | Status                        |
| --------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------- |
| T-S107d-1 | `inventory_izvoda.py` idempotentnost: ponovni `--dry` = isti brojevi, ništa se ne premješta                 | ✅ **S120 (mjereno)** — 118 fajlova, **0 duplikata**, ništa se ne premješta. ⚠ Brojke u testu su zastarjele (MC 31/1139, PBZVISA 32/1587, ZABA 32/738 — pribilo je izvoda). ⚠ `RF_2026-07.pdf` preskočen: `rapidocr_onnxruntime` nije instaliran|
| T-S107d-2 | `Izvodi_transakcije.xlsx`: 3182 tx, Manifest 117 redova, MC_2024-02 suma = 1.642,83                          | ✅ (verificirano skriptom)     |
| T-S107d-3 | **Pravi enrich run** (Review zatvoren!): `--dry` ≈1429 match, pa bez `--dry` → Izvod kolone + Nematchano    | ✅ (2026-07-13; 1429 upisano, ručne kolone verificirane identične backupu, D1 auto-popravljen) |
| T-S107d-4 | Lanac: `apply_rules.py` pravilo pogađa red kojem je merchant SAMO u `Izvod opis`                            | ⬜ (zamjenjuje T-S107c-4)      |
| T-S107d-5 | Nematchano spot-check (PBZ Visa ~1538 tx) — podloga za odluku importati/ignorirati                          | ⬜ (odluka Saša/Koka)          |
| T-S107d-6 | RF OCR spot-check: 3 nasumična reda iz Review s `Izvod file`=RF_* usporediti s PDF-om                       | ✅ **zatvoreno programski 2026-08-18** (v. zaglavlje) — redak je do S120 ostao ⬜|
| T-S107d-7 | Pregled 9 `[OCR?]` redova (filter po `[OCR?]` u Izvod opis / Transakcije sheetu) — ispraviti ručno ako treba | ⬜                             |

---

## S107c — klasifikacijski alati (Python, data-prep; NEMA app koda)

| ID        | Test                                                                                                     | Status                           |
| --------- | -------------------------------------------------------------------------------------------------------- | -------------------------------- |
| T-S107c-1 | `sync_taxonomy.py` na pravom review fileu: dropdowni prate editirani Taksonomija sheet                   | ✅ (Saša potvrdio "ok radi tool") |
| T-S107c-2 | `apply_rules.py`: 1. run kreira Pravila sheet; upiši pravilo; `--dry` pokaže pogodke; run označi PRAVILO | ⬜                                |
| T-S107c-3 | `enrich_from_izvoda.py --dry`: ZABA_2024-01 → ~15/18 match report; bez `--dry` puni Izvod kolone         | ~ superseded → T-S107d-3         |
| T-S107c-4 | Lanac: pravilo koje matcha SAMO tekst iz `Izvod opis` kolone → red dobije Tip/Podtip                     | ~ superseded → T-S107d-4         |

---

## S107b — set_attribute automatika (Faza 2b) + Automations Excel roundtrip

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107b-1 | E2E: Add Activity — Datum naplate live prefill po Izvoru (next:11 / same); ručni unos se ne gazi              | ✅ (Playwright pass) |
| T-S107b-2 | E2E: Structure export sadrži Automations sheet; edit DateMap u Excelu + import mijenja area.settings          | ✅ (Playwright pass) |
| T-S107b-3 | Manualno: Add Activity UX — odabir Izvora puni Datum naplate, promjena Izvora ažurira, ručni edit "zaključa"  | ✅ **S120 (pokriveno automatom)** — `T-S107b-1` provjerava sva tri koraka (Mastercard→11., Racun→isti dan, ručni unos preživi promjenu Izvora); prošao 26.08.|
| T-S107b-4 | Manualno: Structure export → otvori Automations sheet u Excelu (header, help blok, postojeća pravila)         | ✅ **S120 (pokriveno automatom)** — `T-S107b-2` provjerava postojanje `Automations` sheeta i redak pravila s `Mastercard=next:11`; prošao 26.08. ⚠ Sivi help blok nije pokriven|
| T-S107b-5 | Manualno: dodaj NOVO pravilo u Automations sheet → import → pravilo radi u Add Activity                       | ⬜                   |
| T-S107b-6 | Manualno: neispravan DateMap / nepostojeći slug u sheetu → import preskače uz "Automation rules skipped"      | ⬜                   |
| E5-4/5-r  | Regresija: E5 spec fix (Add Child → "+ Add Leaf" label + menu-scroll retry helper) — selector fix, ne app bug | ✅ (Playwright pass) |
| Regresija | E2, E5 (svih 5), E6 (3), T-S104-2, T-S107-1/2 — sve PASS nakon S107b promjena                                 | ✅                   |

---

## S107 — row_hash skip + update-guard (Excel roundtrip zaštita, D7)

| ID        | Test                                                                                                          | Status              |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| T-S107-1  | E2E: re-import nediranog exporta = potpuni no-op (svi redovi skipped, 0 DB poziva)                            | ✅ (Playwright pass) |
| T-S107-2  | E2E: izmjena 1 reda → update-guard lista staro→novo, Apply zaključan do checkboxa                             | ✅ (Playwright pass) |
| T-S107-3  | Manualno: export → promijeni atribut (ne comment) u Excelu → guard pokazuje promjenu polja                    | ⬜                   |
| T-S107-4  | Manualno: guard warning za stare zapise (>30 dana) — promijeni povijesni red                                  | ⬜                   |
| T-S107-5  | Manualno: stari export (bez row_hash kolone) i dalje radi normalno (bez skipa, guard aktivan)                 | ⬜                   |
| T-S107-6  | Review Excel (`Financije_review_*.xlsx`): Tip dropdown radi, Podtip se mijenja po Tipu, krivi Podtip pocrveni | ⬜                   |
| T-S104-3r | Regresija: import progress total sad BEZ untouched reda (spec ažuriran)                                       | ✅ (Playwright pass) |
| E6-r      | Regresija: export s novom row_hash kolonom, download OK                                                       | ✅ (Playwright pass) |

---

## S106 — E7/E8/E9 test harness race condition fix

| ID       | Test                                                                           | Status                                                 |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| E8-1     | Grantee write setup (supabaseUpsert): concurrent data_shares INSERT idempotent | ✅                                                      |
| E8-2     | Grantee write: navigate to Add Activity (Area dropdown select)                 | ⚠️ (timeout: Area select disabled — RLS/loading issue) |
| E9-1     | Grantee read setup + sees shared Fitness area in dropdown                      | ✅                                                      |
| E9-2     | Grantee read: Add Activity button disabled                                     | ✅                                                      |
| E9-3     | Grantee read: no Edit Mode button on Structure tab                             | ✅                                                      |
| E10-1    | Before revoke — grantee sees Fitness area                                      | ✅                                                      |
| E10-2    | Owner revokes access via Share modal                                           | ✅                                                      |
| E10-3    | After revoke — grantee no longer sees Fitness area                             | ✅                                                      |
| E15-full | Revoke with events: dialog + Take your data banner                             | ⬜ (pending smoke test)                                 |
| E7-2/3   | Share Management: invite existing user → "Access granted" toast appears        | ⚠️ (Toast missing — UX polish backlog)                 |

---

## S105 — preostali manualni (starije, još nepotvrđeno)

| ID       | Test                                                                                                                                     | Status |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-S105-6 | S105c retest: Edit otvara sve atribute i u 1. pokušaju; ako upit padne → error ekran s retry (ne prazan form)                            | ⬜      |
| T-S105-7 | Suggest depends_on radi opet: Edit/Add Strength → exercise_name dropdown aktivan (wormup → ergometar...); Financije → Broj rata dropdown | ⬜      |
| T-S105-8 | Rename kategorije (Structure Edit → Save) NE mijenja slugove atributa; depends_on i dalje radi nakon rename                              | ⬜      |

---
