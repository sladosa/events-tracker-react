# NEXT SESSION PROMPT — nakon S114 (tranša 3 zatvorena; sljedeća sesija počinje razgovorom)

**Pisan protiv commita `8d36000`** (+ commitovi zatvaranja sesije koji slijede odmah iza).
Ako `git log --oneline -1` pokazuje nešto puno novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` nosi S108–S114. `main` = PROD, nije diran ni danas.

> ⚠ **Saša je izričito zatražio da sljedeća sesija POČNE razgovorom**, ne kodom:
> *„sljedeći session bi trebali porazgovarati još jednom o tome što smo ovdje naučili i što još
> eventualno poboljšava proces Koki."* Prijedlozi za taj razgovor su u DIO 1 §3 i DIO 2 §4 —
> ali ih iznesi **kao materijal za odluku**, ne kao plan koji je već donesen.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## 1. Što je danas napravljeno

**ZABA račun je zatvoren protiv broja koji je banka ispisala.**

Uvezena je tranša 3: 31 novi redak sa srpanjskog izvoda. Kontrolni stupac je na 30.07. dao
**`13.815,33 €`** — točno onako kako piše `NOVO STANJE` na `ZABA_2026-07.pdf`. Nije naša brojka
usporedena s našom brojkom, nego naša s bankinom.

Usput je potvrđena i planirana Mastercard naplata od `1.244,74` — izvod je pokazuje u cent, pa
je iz `Planiran` prešla u `Izvrsen`.

**I — svih 28 redaka je klasificirano, bez ijednog pogađanja.** `Tip` i `Podtip` nisu izmišljeni
nego **prebrojani**: alat je pogledao kako je isti tvoj/Kokin tekst klasificiran u 4.992 retka
povijesti. `Parking` 118 od 118 puta, `T-com` 40 od 41, MC naplata 31 od 31.

## 2. Tri stvari koje su danas ispale, a lako su mogle proći tiho

**Šest redaka po `0,70` nisu bankovni troškovi — to je parking.** Koka vodi *jedan* redak
`Parking 1,40`, a banka svaki takav naplaćuje kao *dva* naloga po `0,70`. Da ih je klasificirao
stroj po tekstu izvoda, sva tri para bi završila u `Domaćinstvo / Bankovni troškovi` — razred u
kojem takav tekst inače i završava, 12 puta u povijesti. Bilo bi uredno i krivo.

**Alat je tvrdio da je pokušao spojiti Kokine opise, a nije.** Pisalo je `0 spareno, 0 bez para`,
što zvuči kao „tražio sam i nisam našao". Zapravo funkcija koja to radi nikad nije bila pozvana
za ZABA-u. Popravljeno — sada spoji **30 od 38** redaka, pa umjesto
`Kreditni transfer nacionalni u eurima on-line bankarstvom` u popisu piše `T-com`, `T-mobile`,
`Povrat poreza`, `Anja 84/96`.

**`845,12` je razriješen — negativno.** Taj planirani redak od 11.07. koji te mučio od prošle
sesije **nije na izvodu i nema ga nigdje u Kokinoj Excelici.** Ni banka ni ona ga ne poznaju.
Ostaje `Planiran` (ne kvari nijednu brojku) i ide na popis pitanja za nju.

## 3. Za razgovor na početku sljedeće sesije

Ovo su kandidati, poredani po tome koliko **Koki** skidaju s ruku. Odluka je tvoja.

| # | Što | Zašto sad |
| --- | --- | --- |
| **A** | **Izvještaj o uvozu nema dropdowne** za `Tip`/`Podtip` | On je mišljen kao mjesto gdje se dorađuje uvezeno. Danas bi ondje tipkala slobodan tekst bez ijedne provjere. Mali popravak, direktno njen. |
| **B** | **Faza 3 — automatika na Import putu** („popuni ako je prazno") | Jedna rupa drži tri featurea: `Datum naplate` na uvozu, pravila `Tip/Podtip`, širenje rata. Najveći komad koda koji je ostao. |
| **C** | **Tip/Podtip shortcutovi po trgovcu** | Nula koda — `activity_presets` već postoji. Pokriva ono što ona tipka svaki dan. |
| **D** | **Brzi unos** (prefilana polja se ne skupljaju, ravan shortcut popis) | Male izmjene, ali ih osjeti pri svakom unosu. |
| **E** | **Klasifikacija iz povijesti kao stalan alat**, ne jednokratna skripta | Danas je to `klasificiraj_transu.py` s ručno upisanom tablicom. Isti postupak (prebroji povijest → predloži → čovjek potvrdi) mogao bi raditi nad bilo kojom tranšom. |

⚠ Prije nego se bilo što od ovoga gradi, vrijedi ono što je već dogovoreno u S112:
**Saša odglumi Koku 3 dana stvarnog unosa i izmjeri frikciju.** To pretvara „bi li bila
zadovoljna" u brojku, i vjerojatno prerasporedi gornju tablicu.

## 4. Što još čeka tebe

- **Sidro ZABA na 30.07. = `13.815,33`** — ako ga nisi postavio, to je prvi klik.
  ⚠ Broj mora doći **s izvoda**, nikad iz pločice.
- **Pitanja za Koku:** `845,12` (nepoznat i banci i njoj) · onih 5 spornih lipanjskih redaka
  (Σ `373,11`) · 11 kartičnih stavki bez para iz S113 · dva njena retka datirana **2036**.
- **Nena `7.000` + `5.000`** su danas upisani kao `Prihodi / Koka` po tvojoj odluci. Ako je to
  zapravo prebacivanje između računa, reci — mijenja se u jednom uvozu.

---

# DIO 2 — Tehnički (za Claudea)

## 1. Prvo pročitaj

`docs/sessions/DONE_HISTORY.md` **S114** · CLAUDE.md sekcije „Delta sheet" i „Python alati"
(obje su danas dobile nove zamke) · `docs/sessions/tests/S114_tests.md`.

## 2. Novo u S114

| Što | Gdje |
| --- | --- |
| `koka.find()` i u `zaba_rows()`; prozor sparivanja je parametar (`prije`/`poslije`) | `fill_from_izvod.py` |
| `klasificiraj_transu.py` — Tip/Podtip iz izbrojane povijesti, parovi provjereni protiv `DropdownData` | `data-prep_tools/Financije/` |

Nema promjena u `src/`. `npm run typecheck` prolazi.

## 3. Stanje podataka

- **ZABA:** lanac zatvoren protiv ispisanog `NOVO STANJE` `13.815,33` @ 30.07.2026.
  ⚠ **Postoji li sidro na taj datum — NEVERIFICIRANO** (T-S114-1).
- **RF:** sidro 11.08.2026. = `799,12`.
- Kontrolna brojka `14.722,84 @ 09.08.` iz plana tranši **nije dohvaćena i neće biti ovim putem** —
  izvod staje na 30.07., a za nju treba ~15 Kokinih redaka od 02.08. do 13.08.
  (`Parking`, `Cash`, `Mirovina 1.261`, `HAK ×2`, `Netdomena`, `Ćorluka 156,99`).
  To je čisti D-2 slučaj („Koka sada, izvod potvrda") i **nema vanjske potvrde dok ne stigne
  kolovoški izvod** — pa se tako i mora označiti kad se uveze.
- **Tranša 4 (MC iz `MC_2026-07`)** je jedina preostala iz originalne tablice. Ona rješava i
  onih 5 spornih lipanjskih redaka: ostane li `13.239,31` bili su duplikati, postane li
  `12.866,20` bili su stvarni.

## 4. Materijal za razgovor (ne plan)

Dvije stvari koje su se danas pokazale kao **obrazac**, ne kao pojedinačni nalaz — vrijedi ih
iznijeti jer mijenjaju kako se gradi Faza 3:

1. **Ključ `(iznos, datum)` ne vidi kad se dva izvora razilaze u *broju redaka*.**
   S111 je našao razilaženje u **iznosu** (skoro-duplikati), S114 u **broju redaka**
   (njen `Parking 1,40` = dva bankina `0,70`). Svaka buduća automatika koja sparuje njene retke
   s izvodom mora računati na oboje — i mora **prijaviti nesparene**, jer su upravo oni skupina
   u kojoj greška izgleda najurednije.

2. **Povijest je bolji klasifikator od teksta izvoda, i mjerljivo je koliko.**
   Prebrojavanje nad Reviewom dalo je 24 od 27 redaka jednoznačno (118/118, 41/41, 31/31...),
   a tri koja nije moglo — dalo je **čovjeku**, s brojkama uz svaku opciju. To je predložak za
   „Tip/Podtip automatiku" iz backloga: ne pravilo po tekstu, nego **prijedlog s dokazom**.
   ⚠ I: brana protiv `DropdownData` mora ostati bez obzira na to tko predlaže — podtip mimo
   `validation_rules` uveze se kao običan tekst i ne javi grešku.

## 5. Otvoreno / neverificirano

- **T-S114-1…5** ⬜ (novi). T-S114-1 je jedini koji nešto blokira.
- **T-S113-2** (bilješka sidra iz UI-ja) ⬜ · **T-S112-5** ⬜ · **T-S111-1, -3, -4, -5, -6** ⬜.
- **BUG-S114-REPORTDD** — izvještaj o uvozu nema `DropdownData` list.
- **Kozmetika iz S113 stoji:** delta sheet nad praznim prozorom pokazuje `#N/A` u Max/Min/Summ.
- **`sql/037` i `038` nisu na PROD-u** — Overview je i dalje TEST-only.
- **`transa3.xlsx` je namjerno ostavljen** u `data-prep_data/Financije/` — preduvjet je za
  T-S114-3. Ostali izlazi tranši 1–2 arhivirani su u `_arhiva/izlazi/`.
