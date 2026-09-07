# Sljedeća sesija — handoff

**Pisano protiv commita:** `S130: popis MC izvoda se nalazi sam + brisanje 1:N trazi
RAZLICITE retke` (`0318314`). `main` = `b080739`, **nedirano ovom sesijom**.
Ako `git log` pokazuje novije, čitaj ovo kao **povijest** — CLAUDE.md je autoritet.

⚠ **PROD podaci su nedirani.** Sve u S130 je bio dry run. Nijedan `--apply` nije pušten.

---

# DIO 1 — netehnički (za Sašu)

## ⭐ Kako napraviti upis podataka

Plan je: Koka gleda svoje bankovne aplikacije, ti upisuješ dok joj je sjećanje svježe.
Aplikacija se koristi **samo za izvoz (Delta) i uvoz** — radi se u Excelu.

### Prije nego sjednete

**1. Pokreni aplikaciju na PROD podacima.**

```powershell
cd c:\0_Sasa\events-tracker-react
git pull                # test-branch, 0318314
npm run dev:prod
```

⚠ **`npm run dev` (bez `:prod`) je TEST baza.** Razlika se ne vidi na prvi pogled —
obje baze imaju Areu sličnog imena. TEST se prepoznaje po areama `S100 A 8a37c3`,
`S121 ctx w0`, `Alpha`; PROD po `Financije_all`, `Financije_old`, `Kupiti`.

**2. Logiraj se kao Koka**, ne kao ti. Tako su retci njeni, pa ih njen idući roundtrip
vidi kao svoje (nema `fix_as_owner`), a i profil `Kokin_format` može spremiti samo
vlasnica.
⚠ Pri prebacivanju računa u istom pregledniku može iskočiti *„Resume Previous
Session?"* s nacrtom s tvog računa — klikni **Discard**.

**3. Upiši sidro za kolovoz** (bez njega delta prozor kreće od 31.07. i nosi 48 već
usklađenih redaka umjesto par):

```powershell
cd data-prep_tools\Financije
$env:ET_TARGET="prod"
..\Tools\venv\Scripts\python.exe make_saldo_anchors.py --anchor 2026-08-26
```

Upisuje `12.784,36 @ 26.08.2026.`, broj čita iz PDF-a. Provjereno unaprijed: kolovoz
zatvara **u cent**, a app na taj dan daje točno taj broj.
⚠ Nepovratno u smislu prozora — nakon toga nijedna buduća Delta ne doseže prije 27.08.

**4. NE puštaj `--apply` za `MC_2026-08` prije Delte.** Objašnjenje niže („Nalaz koji
je okrenuo preporuku"). Stariji izvodi smiju.

### Sam upis

1. Filter → račun (`Kokin tekući ZABA`) → **Export → Delta sheet**.
   ⚠ Postavi **broj praznih redaka** prema tome koliko transakcija očekujete — redak
   koji ne stane pada izvan raspona kontrolnog stupca, a brojka ostane uvjerljiva i
   nepotpuna.
2. U Excelu upisujte u **prazne retke** ispod povijesti. Dobivate:
   - `Tip` — dropdown, 18 vrijednosti
   - `Podtip` — dropdown vezan na **vlastiti** `Tip` retka ✅ *(ovo je popravljeno u S130)*
   - `Datum naplate` — provjera datuma
   - `Comment` — **slobodan tekst**, bez prijedloga (parkirano, v. DIO 2)
3. Kontrolni stupac desno pokazuje stanje po retku. ⚠ **Ne broji `Planiran`** — prvo u
   sheetu potvrdi što je banka naplatila, pa tek onda čitaj brojku.
4. Uvoz natrag kroz aplikaciju (Excel Import).
   ⚠ **Hard refresh (Ctrl+Shift+R) prije uvoza** — stari keširani bundle je već jednom
   tiho osakatio uvoz (S118).

### Što provjeriti prvi put (i javiti)

- **T-S130-1:** u praznom retku odaberi `Tip = Domacinstvo`, pa otvori `Podtip`.
  Mora nuditi **Domacinstvo** podtipove. Ako nudi neke druge — popravak nije stigao.
  ⚠ Biraj `Tip` **različit** od onoga na zadnjem povijesnom retku, inače test ne mjeri
  ništa.

## Nalaz koji je okrenuo preporuku

Na tvoje pitanje *„zar nije dobro imati ispravke u PROD-u prije Delte?"* — odgovor je
**podijeljen**, i utvrdilo se mjerenjem:

| što | prije Delte? |
| --- | --- |
| **21 ispravak + 2 brisanja** sa starijih izvoda (2024./2025.) | **da**, slobodno |
| **46 ispravaka** iz `MC_2026-08` | **ne** |

Košara koju Delta prikazuje **jest točno tih 46 redaka** (svi dospijevaju `11.09.`,
svi `Mastercard`, svi `Planiran`, Σ `1.048,72`). Stupac `Provjeri` pali kad je
`Status <> Planiran` **a** dospijeće u budućnosti. Dakle:

- **bez** `--apply` → stupac **prazan** za svih 46
- **s** `--apply` → **svih 46** dobiva *„dospijeva tek 11.09.2026."*

46 narančastih upozorenja na retcima na kojima ništa nije u redu.

⚠ Ispod toga je **odluka koju treba donijeti, ali ne danas**: što `Status` znači za
kartični redak u **otvorenoj** košari. Tvoja dva pravila se ovdje razilaze — „kartični
redak je `Izvrsen`, kupovina se dogodila" (izmjereno Visa 855/855) protiv delta toka
gdje je `Status` prekidač potvrde.

## Što još čeka

1. **Stariji izvodi** — 21 ispravak (13 redaka dobiva `Izvod opis`, 5 ispravlja
   `Datum naplate`) + 2 brisanja. Sve `Mastercard`, sve prije sidra ⇒ ne diraju saldo.
   Naredba je u DIO 2.
2. **`MC_2026-08` (46)** — kad ZABA rujanski izvod pokaže skupnu naplatu `1.068,70`.
3. **Dva nova retka, `19,98`** — `PAYPAL *AC WALKFT 9,99` (10.08.) i `APPLE.COM/BILL
   9,99` (17.08.). `--apply` ih **ne uvozi** (radi samo ispravke/dopune/brisanja), a
   kartični redak ne smije u prazne retke Delte ⇒ traže zaseban uvoz.
4. **Pet mjeseci koji se razilaze:** `2024-03 +10,00`, `2024-07 −17,28`,
   `2024-10 −236,04`, `2025-07 +0,80`, `2025-08 −46,74`.
5. **T-S129-B5** — provjera S127/S129 na PROD URL-u uz hard refresh. Nije odrađeno.
6. **Faza 3** — automatika na Import putu. Jedna rupa drži tri featurea.

## Parkirano (tvoja odluka, ne zaboravljeno)

- **Prijedlog `comment`a iz povijesti** — izmjereno, ne radi se. Brojke su u CLAUDE.md
  backlogu da se ne ponavljaju. Ukratko: ključ `Podtip` sam, zadnjih 12 mjeseci,
  **top-5 = 93,4 %**; iznos ne doda ništa; top-1 je 57,6 % ⇒ ponuda, nikad upis.
- **Oznake iz presedana** — 71 redak nosi sirovi tekst izvoda u `Opis`u,
  `oznaci_iz_presedana.py` predlaže oznaku za 45. Dry run čist, `--apply` nije pušten.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

- `test-branch` = `0318314`. Nosi S130: `excelExport.ts`, `deltaSheet.ts`,
  `deltaBlankRowDropdowns.test.mjs`, `primijeni_uskladu.py`, docs.
- `main` = `b080739`, **nedirano**. Deploy **nije potreban** za rad — `npm run dev:prod`
  daje popravljeni kod nad PROD podacima. Deploy treba tek kad Koka radi sama.
- ⚠ Auto-mode blokira i push na `main` i upise na PROD. Oba pokreće Saša.

## Naredbe koje čekaju Sašu

```powershell
cd c:\0_Sasa\events-tracker-react\data-prep_tools\Financije
$env:ET_TARGET="prod"

# 1. sidro za kolovoz
..\Tools\venv\Scripts\python.exe make_saldo_anchors.py --anchor 2026-08-26

# 2. stariji izvodi (21 ispravak + 2 brisanja) -- BEZ MC_2026-08
#    Popis se sada nalazi sam, pa treba nabrojati sve OSIM kolovoza,
#    ili pustiti zadano pa prihvatiti i 46 kolovoskih (v. nalaz gore).

# 3. kolovoz -- TEK nakon Delte / rujanskog ZABA izvoda
..\Tools\venv\Scripts\python.exe primijeni_uskladu.py --izvod ..\..\data-prep_data\Financije\izvodi\MC_2026-08.pdf --apply
```

⚠ **Otvoreno u alatu:** `primijeni_uskladu.py` nema način da *isključi* jedan izvod iz
zadanog prolaza. Za korak 2 treba ili 31× `--izvod`, ili nova zastavica
(`--osim MC_2026-08.pdf`). To je posao od par minuta i **nije napravljen**.

## Promjene u S130

| file | što |
| --- | --- |
| `src/lib/excelExport.ts` | novi param `dvBlankRows`; `dvEnd` \u2192 validacija pokriva prazne retke predloška |
| `src/lib/deltaSheet.ts` | maknuto kopiranje `dataValidation` s povijesnog retka; prosljeđuje `opts.blankRows` |
| `src/lib/__tests__/deltaBlankRowDropdowns.test.mjs` | **nov**, 8 provjera, protuprovjera pada 4/8 |
| `data-prep_tools/Financije/primijeni_uskladu.py` | `--izvod` / `--s124`; popis izvoda se nalazi sam (glob); brisanje 1:N traži različite retke |

## Izmjereno u ovoj sesiji (ne ponavljati)

- **`npm run dev` = TEST** (`.env.local` → `xtnbhmoj…`), **`dev:prod` = PROD**
  (`.env.prod.local` → `zdojdazos…`). Utvrđeno čitanjem sadržaja obje baze.
  ⚠ Ista zamka je ugrizla i u ovoj sesiji: saldo bez `ET_TARGET=prod` dao je
  `13.239,31` umjesto `12.784,36`.
- **PROD `attribute_definitions`:** 6 `depends_on` atributa (`Izvor`←`Racun`,
  `Uplata`/`Isplata`/`Rate?`/`Stanje`←`Smjer`, `Podtip`←`Tip` s 19 tipova / 66 podtipova,
  `Broj rata`/`Rata br`←`Rate?`, `Status`←`Izvor`). Lomilo je samo `Podtip`.
- **Postojeća INDIRECT DV formula je 424 znaka** i radi u Excelu — dokumentirani limit
  od 255 ovdje ne grize. Dva roditelja bi bila **829**, neprovjereno.
- **`Kokin_format` profil:** `comment` je **vidljiv** (width 30, outlineLevel 0), kao i
  `Tip` i `Podtip`.
- **Košara `MC_2026-08`:** 46 redaka / `1.048,72`, svi `Planiran`, svi dospijevaju
  `2026-09-11`, svi `Mastercard`.
- **`izvodi/` korijen sadrži samo `MC_2026-08.pdf`**; `Analizirani_izvodi/` ima 33 ZABA,
  32 MC, 32 PBZVISA (+1 `PBZVIZA`, nekonzistentno ime), 23 RF.

## Otvoreno / neverificirano

- **T-S130-1, -2, -6, -7, -8, -9, -10** — v. `docs/sessions/tests/S130_tests.md`.
- Stariji ⬜: T-S129-A7/-A8/-A9, T-S129-6/-7/-8, T-S129-B5, T-S128-4/-5.
- `audit_tests.py`: **0 sesija za arhivu**; 40 testova koje PENDING ne spominje i 102 ⬜
  koje „Otvoreno:" ne navodi — poznata neusklađenost, nije dirana.
- ⚠ `src/lib/__tests__/structureExcel.test.mjs` pada s `SyntaxError` — **zatečeno**,
  file je okrnjen, zadnji put diran u S17 (`75ef760`).
