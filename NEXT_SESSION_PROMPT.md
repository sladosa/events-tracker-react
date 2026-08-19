# NEXT SESSION PROMPT — nakon S112 (delta sheet radi, tranše čekaju)

**Pisan protiv commita `8d7e3ce`** (zadnji prije S112) **+ commit S112 koji slijedi odmah iza.**
Ako `git log --oneline -1` pokazuje nešto novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` nosi S108 + S109 + S110 + S111 + S112. `main` = PROD, nije diran.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Što je S112 napravio

Sesija je počela razgovorom, ne kodom — na tvoj zahtjev. Pitanje nije bilo „kako uvesti ovu
deltu" nego **„kako da Koka rješava deltu, svaki mjesec, bez nas"**. Odgovor je alat, i on sada
postoji.

**Delta sheet** je Excel koji app napravi za **jedan račun**: pokaže zadnjih 60 dana, doda 40
praznih redaka, i uz njih kolonu koja **računa stanje dok tipkaš**. Gore je ćelija „u banci
piše" — upišeš broj s mobitela, i razlika mora biti `0,00` i zelena. **Greška se vidi prije
uvoza**, a ne u izvještaju poslije.

Prije je za RF izlazilo 1.010 redaka. Sada ih je **devet**.

## Što treba od tebe — pet minuta

**T-S112-3:** Overview → klikni saldo `Sašin tekući RF` → Activities → Export → kvačica
**„Delta sheet"** → Download.

- 9 redaka, prvi 20.06.2026.
- zadnji u koloni `Stanje (kontrola)` mora biti **`712,75`**
- upiši `712,75` u „u banci piše" → **razlika 0,00, zeleno**

Ako to prođe, **tranša 1** je samo popunjavanje sedam redaka i jedan ispravak — koraci su u
`docs/sessions/tests/S112_tests.md`.

## Kako sada izgleda plan za Kokinu deltu

Ne ide odjednom nego u **četiri tranše**, svaka provjerava drugi mehanizam i svaka ima brojku
**iz Kokinog lanca** (dakle iz izvora neovisnog o aplikaciji):

| # | Što | Brojka koja mora izaći |
| --- | --- | --- |
| 1 | RF banka: 7 novih redaka + ispravak `250,93 → 253,51` | RF na 04.08. = **1.716,55** |
| 2 | RF Visa iz izvoda (42 stavke + naplata) | RF na 11.08. = **799,12** |
| 3 | ZABA banka: 110 redaka + potvrda naplate | ZABA na 09.08. = **14.722,84** |
| 4 | MC iz izvoda (45 stavki, 12 baza već ima) | ZABA na 13.08. = **13.239,31** |

**Dobra vijest o izvodima:** ona dva nova PDF-a sadrže **točno** zbrojeve koje sam prošli put
predlagao da ih izračunamo sami — `1.332,52` i `1.171,59`, u cent jednako Kokinim grupama.
Ne treba ništa izmišljati.

## Tri stvari koje su bile pokvarene, a nisu se vidjele

1. **Svaki dodirnut redak je pri uvozu prepisivao `Datum naplate`** — jer su baza i Excel isti
   trenutak zapisivali drukčije. Sad je datum pravi datum (`7.1.2025`), s provjerom pri upisu.
2. **Broj „planirano" na pločici je brojio dvaput** — `−2.521,38` umjesto `−2.089,86`.
3. **Razlika `0,00` se bojala crveno** — zbroj u Excelu nije bio baš nula nego `0,0000000000001`.

## Što ostaje otvoreno za tebe

- **Onih 5 redaka od 16–17.06.** (Σ `373,11`): provjerio sam ih protiv lipanjskog ZABA izvoda —
  **nisu na njemu**. Sumnja: kolovoški računi s krivo utipkanim mjesecom. **Pitanje za Koku.**
- **`845,12`** — planirani redak u bazi bez komentara, ne odgovara nijednoj njenoj grupi.
- **`ZABA_2026-07`** izvod, ako ga možeš skinuti — zatvara tranšu 3 bez pogađanja.

---

# DIO 2 — Tehnički (za Claudea)

## Prvo pročitaj

`docs/sessions/tests/S112_tests.md` (kontrolne brojke svih tranši) · CLAUDE.md sekcija
**„Delta sheet (usklađenje s bankom)"** (nova) · `docs/sessions/DONE_HISTORY.md` S112.

## ⚠ Prvo provjeri je li TEST u očekivanom stanju

```
Overview → Kokin tekući ZABA → redak "planirano" mora glasiti  −2.089,86 (2)
```

| Vidiš | Znači |
| --- | --- |
| `−2.089,86 (2)` | `sql/037` je ponovno pušten, sve je na mjestu |
| `−2.521,38 (13)` | `037` nije pušten nakon 2026-08-19 — split nema `Izvor` uvjet |

## Novo u S112

| Što | Gdje |
| --- | --- |
| kanonski oblik datum-atributa (baza ↔ app ↔ Excel) | `src/lib/excelDatetime.ts` (novo) |
| datumska ćelija + Data Validation `date` u exportu | `excelExport.ts` |
| import: datumska ćelija → kanonski oblik; usporedba po kanonskom | `excelImport.ts` |
| **delta sheet** (prozor, kontrolni stupac, „u banci piše") | `src/lib/deltaSheet.ts` (novo) |
| import: redak predloška se preskače i broji | `excelImport.ts` (`templateSkippedOut`) |
| `split` dobio `izvorplacanja in (Racun)` | `sql/037` — ⚠ **pustiti ponovno** |
| drill na „planirano" bira razlikovni uvjet, ne `filters[0]` | `OverviewTab.tsx` |
| delta mod u Export modalu (kvačica + prozor u danima) | `ExcelExportModal.tsx` |

## Što je namjerno NIJE napravljeno

- **`session_start` se NE dodjeljuje automatski u importu.** Kolizija je zaštita od dvostrukog
  uvoza istog filea; auto-dodjela bi je ubila. Vremena piše generator (`14:00+n`).
- **Upozorenje na pred-sidreni redak nije u importu** — traži da import poznaje `dashboard`
  config i sidra. Ide u alat kad zatreba (relevantno za onih 5 spornih lipanjskih redaka).
- **Automatika na Import putu (Faza 3)** — `set_attribute` se i dalje evaluira samo u Add
  Activity. Jedna rupa drži tri featurea: `Datum naplate` na uvozu, pravila `Tip/Podtip`,
  širenje rata. **To je sljedeći veliki komad koda**, nakon tranši.

## Otvoreno / neverificirano

- **T-S112-3…6 svi ⬜.** T-S112-4 je tranša 1.
- **Delta sheet nije nijednom uvezen** — generiranje je provjereno strojno (headless test kroz
  pravi `.xlsx`), ali put natrag u bazu još nije prošao ni jednom.
- **T-S111-1, -3, -4, -5, -6 i dalje ⬜.** `T-S111-2` **otpada** — krivo RF sidro (`3.453,03`)
  više ne postoji u bazi, pa nema što provjeriti.
- **`sql/037` (nova verzija) i `038` nisu na PROD-u** — Overview je zasad TEST-only.
- **Preostali poznati Δ:** `−200,14` na ZABA lancu 2025-08 → 2026-04, Sašina odluka: ne loviti.
- **Backlog dobiva novu stavku:** `Datum naplate` je kriv na 12 MC redaka (11.07. umjesto
  11.08.). Saldo ne dira, ali lomi buduću automatiku „dospjelo → potvrdi". Popravlja se uz tranšu 4.
