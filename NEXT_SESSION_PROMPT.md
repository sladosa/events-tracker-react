# Sljedeća sesija — handoff

**Pisano protiv commita:** `S130: zatvaranje sesije` (`3806f58`) + rad nakon njega.
`main` = `b080739`, **nedirano**. Ako `git log` pokazuje novije, čitaj ovo kao
povijest — CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno na PROD-u

Sesija s Kokom nad `Kokin tekući ZABA` i izvodom `MC_2026-08.pdf`. **Dva uvoza,
oba prošla.**

| | |
| --- | --- |
| 4 klasifikacije (`N/A` → pravi Tip/Podtip) | ✅ Veronika, Konzum, AUDIBLE, SPOTIFY |
| Temu `41,35` @ 03.09. | ✅ novi redak |
| Konzum `1/6` `15,36` @ 31.08. | ✅ novi redak |
| WalkFit `9,99` @ 10.08. | ✅ `Zdravlje / Sport_Koka` |
| Apple `9,99` @ 17.08. | ✅ `Zabava / HBOmax` |
| **KOŠARA 11.09.** | ✅ **48 redaka / `1.068,70` = izvod, u cent** |
| saldo ZABA | ✅ `12.772,86`, netaknut (kartični retci ga ne diraju) |

Poklapa se i **broj redaka**, ne samo zbroj — jača provjera, jer bi se zbroj mogao
slagati i uz krivi sastav.

## ⭐ Prvo idući put: rate

Alat je napisan i **dry run je čist**: `data-prep_tools/Financije/rate_alat.py`.
Ništa nije upisano ni izvezeno.

```powershell
cd c:\0_Sasa\events-tracker-react\data-prep_tools\Financije
$env:ET_TARGET="prod"
..\Tools\venv\Scripts\python.exe rate_alat.py            # dry run
..\Tools\venv\Scripts\python.exe rate_alat.py --file rate  # + rate_A.xlsx, rate_B.xlsx
```

### ⚠ Prolaz A je narastao na **85 redaka** — treba tvoja odluka prije uvoza

Očekivali smo ~43. Ispalo je više jer `Izvod opis` ima **dva oblika**, ne jedan:

```
MC    KONZUM P-0277 RATA 9/12          broj IZA trgovca
Visa  RATA 02/ 03-SUPER KONZUM P-3200  broj ISPRED trgovca
```

Alat hvata oba, pa popravlja i Visa retke. Sve su to legitimni ispravci po pravilu
„autoritet je `Izvod opis`", ali **85 promjena nije ono što sam ti opisao** i ne bih
ih pustio bez da pogledaš popis. Posebno pogledaj retke tipa
`Harvey Norman 2/10 → Rata br=3` — komentar kaže jedno, banka drugo.

**Prijedlog:** prvo pusti `rate_alat.py` bez argumenata i pročitaj prolaz A. Ako ti
je preširok, suzimo ga na MC oblik (`--only`-varijanta se lako doda).

### Prolaz B je uzak i siguran: **5 planova, 17 rata**

`KONZUM P-1270`, `ALLIANZ HR`, `KEINDL`, `KONZUM P-0277`, `MIELE` — sve Mastercard,
dospijeća 11. u mjesecu, `event_date` = dan kupnje, `session_start` iz slobodnog
pojasa `14:00+`.

**Namjerno se NE generira:**

| | zašto |
| --- | --- |
| Visa — 6 planova / 16 rata | dospijeće nije pravilno (5. → 113, 4. → 71, 6. → 29) |
| `HARVEY NORMAN` — 1 rata | sljedeća bi dospjela **11.10.2024.**, dakle nije otvoren plan nego nezabilježena rata iz 2024. |
| 10 usporednih planova | isti trgovac + isti N, razdvaja ih samo iznos (`KONZUM P-3200 N=6` ima pet iznosa) |

## Što još čeka

1. **Rate** — gore.
2. **Sidro.** Aktivno je i dalje `2026-07-30 = 13.815,33`. Pločica pokazuje
   `12.772,86` i slaže se s bankom. ⚠ Prije potvrde provjeri je li **danas** bilo
   ZABA prometa kojeg app nema — ono bi se zapeklo u sidro i poslije brojalo dvaput.
   Buduće današnje transakcije **nisu** problem (sidri se na jučer).
3. **Kokina mirovina nije u bazi** — 07.09. je nije bilo nigdje u Arei. Provjeri je
   li spremljena.
4. **46 kolovoških `Status: Planiran → Izvrsen`** — tek kad ZABA rujanski izvod
   pokaže skupnu naplatu `1.068,70`. Ne prije Delte (v. CLAUDE.md zamka).
5. **21 ispravak + 2 brisanja** sa starijih MC izvoda — spremno, `--apply` čeka.
6. **Pet mjeseci se razilazi:** `2024-03 +10,00`, `2024-07 −17,28`, `2024-10 −236,04`,
   `2025-07 +0,80`, `2025-08 −46,74`.

## Parkirano

- **Prijedlog `comment`a iz povijesti** — izmjereno (`Podtip` sam, 12 mj, top-5 =
  93,4 %), brojke su u CLAUDE.md backlogu. Tvoja odluka: za sada ništa.
- **Oznake iz presedana** — `oznaci_iz_presedana.py`, 45 od 71, `--apply` nije pušten.
- **Poravnanje `event_date`-a na 355 postojećih rata** — zaseban zahvat, ne miješati
  s generiranjem.

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- `test-branch` = `3806f58` + `rate_alat.py` (nov). `main` = `b080739`, nedirano.
- PROD: dva uvoza prošla (v. DIO 1). Ništa drugo nije pisano.

## Nov alat

`data-prep_tools/Financije/rate_alat.py` — prolaz A (higijena oznaka) + prolaz B
(generiranje). Ne piše u bazu; proizvodi xlsx za uvoz kroz aplikaciju.
Dry run: **A = 85 redaka, B = 5 planova / 17 rata.**

## Izmjereno danas (ne ponavljati)

- **`Izvod opis` ima DVA oblika:** `MERCHANT RATA n/N` (MC) i `RATA n/N-MERCHANT`
  (Visa). Zato prolaz A hvata 85, ne 43.
- **Prva rata nosi ostatak zaokruživanja:** od 62 plana s ≥3 rate, 25 ima sve iznose
  jednake, **23 samo prvu drukčiju**, 14 je sudar ključa. ⇒ za nove rate uzmi iznos
  **zadnje**, nikad prve.
- **MC dospijeće 276/276 na 11.**; Visa nema pravila.
- **Pravilo po komentaru je ODBAČENO mjerenjem:** uzorak `n/N` u komentaru hvata 49
  redaka, a stvarne rate su tri (`HLK članarina 7-12/23` je razdoblje, `HLK 03/23`
  mjesec). Zato `RUCNO` popis u alatu, ne heuristika.
- **Nema identifikatora plana u modelu** — plan se rekonstruira iz `Izvod opis`a
  (433 od 636 redaka ga nose).
- **`Izvod opis` je Kokin RUČNI prijepis**, ne oznaka koju je nešto upisalo:
  `created_at` je razmazan po svakom danu kolovoza. Njen prijepis je pouzdan —
  45/46 poklopilo se s PDF-om u znak.
- **Sudar `session_start`a:** po danu kupnje zauzeto 8–18 minuta, pojas `14:00+`
  slobodan na svima.
- Samo **2 retka** u bazi imaju prazan `Status` (oba Mastercard ⇒ saldo netaknut).

## Otvoreno / neverificirano

- **T-S130-1, -2, -6, -7, -8, -9, -10** — `docs/sessions/tests/S130_tests.md`.
- Novo, neupisano u PENDING: prolaz A (85) traži Sašinu odluku o opsegu.
- Stariji ⬜: T-S129-A7/-A8/-A9, T-S129-6/-7/-8, T-S129-B5, T-S128-4/-5.
- ⚠ `src/lib/__tests__/structureExcel.test.mjs` pada s `SyntaxError` — zatečeno, S17.
