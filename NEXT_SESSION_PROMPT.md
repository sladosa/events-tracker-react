# Sljedeća sesija — handoff

**Pisano protiv commita:** `S129: T-S127-9 potvrdjen -- uz ispravak metode testiranja`
(`b080739`). ⚠ **`main` je 05.09.2026. podignut na `b080739`** — dakle sve app
promjene S127+S129 su na PRODU. `test-branch` je ispred za `84f5edc`
(dokumentacija, ne dira aplikaciju). Ako `git log` pokazuje novije, čitaj ovo kao
**povijest** — CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

Dvije odvojene stvari: **podaci** i **kod**.

### Podaci — `Financije_all` na PROD-u

| | |
| --- | --- |
| popravak parkinga + multisporta | ✅ 3 brisanja + 1 pomak datuma |
| podizanje `150,00` (duplikat, krivi mjesec) | ✅ obrisano |
| četiri mjeseca pala na nulu | ✅ 2025-02, 2025-03, 2026-03, 2026-04 |
| `2025-10` pao na nulu | ✅ |
| ZABA 2026-07 i 2026-08 | ✅ **zatvaraju u cent, uvoza nema** |
| app vs ispisano stanje 26.08. | ✅ **12.784,36 = 12.784,36** |

**Ostala su dva mjeseca u cijeloj povijesti od 2024. naovamo:**

| mjesec | Δ | što je |
| --- | ---: | --- |
| 2025-08 | −46,74 | `−45,94` (Zagrebački holding) + `−0,80` |
| 2025-07 | +0,80 | banka ima `−0,80` @ 07.07., baza nema |

### Kod

- **Export više ne laže.** Profil `Kokin_format` je tiho prepisivao tvoj raspon
  datuma, a modal je i dalje pokazivao **tvoj**. Brojka je pisala `5.154` za file
  koji ima `387`. Sada oboje pokazuje ono što stvarno izlazi, plus **prekidač**
  „Koristi filtre iz profila" kojim to isključiš.
- **Raspon datuma se više ne resetira sam.** Odlazak na Structure ili u View
  Details bacao ga je na „All time".
- **Excel Import/Export na mobitelu** preselio iz filtra (koji se zatvara) u red
  s tabovima, uz zeleni `+`.

## ⭐ Prvo što treba napraviti — dvije stvari

### 1. Push na `main` (troši Netlify kredite)

T-S127-9 je **prošao**, dakle brana je pala. Ja to ne mogu pokrenuti.

```powershell
cd c:\0_Sasa\events-tracker-react
git checkout main
git merge test-branch --no-edit
git push origin main
git checkout test-branch
git merge main --no-edit
git push origin test-branch
```

Zadnja tri retka su **sync-back** — bez njih `test-branch` zaostaje.

Nakon Netlify builda provjeri na **PROD URL-u** i s **hard refreshom**
(`Ctrl+Shift+R` — stari keširani bundle je već jednom prevario, S118):
- `27.07.2026. ZOO 15,00` u Editu → `Datum naplate` mora ostati `07.08.2026.`
- export modal ima prekidač i brojka mu se mijenja kad ga klikneš
- `Custom` raspon preživi odlazak na Structure

### 2. Sidro za kolovoz, pa Delta

```powershell
cd c:\0_Sasa\events-tracker-react\data-prep_tools\Financije
$env:ET_TARGET="prod"
..\Tools\venv\Scripts\python.exe make_saldo_anchors.py --anchor 2026-08-26
```

Upisuje `12.784,36 @ 26.08.2026.` — broj **čita iz PDF-a**, ne s tvoje tipkovnice.

Zatim u aplikaciji: filter na `Kokin tekući ZABA` → Export → **Delta sheet**.

**Zašto tim redom:** bez sidra delta prozor kreće od **31.07.** i nosi 48 već
usklađenih kolovoških redaka; sa sidrom kreće od **27.08.** i nosi 2.

⚠ `$env:ET_TARGET="prod"` ostaje postavljen do kraja tog terminala.
⚠ Nakon sidra nijedan budući delta sheet ne može doseći prije 27.08. Sigurno je
jer kolovoz zatvara u cent, ali je nepovratno.

## Što još čeka, po redu

1. **`MC_2026-08.pdf`** — stigao 02.09., netaknut. Kartični izvod **ne dira
   saldo**; daje potvrdu po retku, točan `Datum naplate` i retke kojih baza nema.
   Prvi korak je samo čitanje: `uskladi_izvod.py --izvod ...MC_2026-08.pdf --dry`.
2. **Zadnja dva mjeseca** (2025-07, 2025-08). ⚠ `uskladi_izvod.py` prima **samo
   MC** izvode — za ZABA-u se ide izravno na podatke, kao kod podizanja od 150.
3. **Odluka koja visi od S127:** `Status` se u Editu mijenja **pravilom, a ne
   dokazom**. 2.300 redaka nosi potvrdu s izvoda, a promjena `Izvora` ih
   raz-potvrdi. Preporuka je i dalje **potvrda pobjeđuje pravilo**.
4. **Faza 3** — automatika na Import putu. Jedna rupa drži tri featurea.
5. **Ti odglumiš Koku 3 dana** stvarnog unosa pa mjerimo frikciju.

## Parkirano (tvoja odluka, ne zaboravljeno)

**Oznake iz presedana** — 71 redak nosi u `Opis`u sirovi tekst izvoda umjesto
oznake tipa `Parking`. Alat `oznaci_iz_presedana.py` predlaže oznaku iz brojane
povijesti za **45** njih; ostalih 26 se ne pogađa. Dry run je čist, **ništa nije
upisano** — parkirao si jer ti prijedlozi nisu bili očiti.

Ako se vratiš na to: pusti `oznaci_iz_presedana.py` bez argumenata i pročitaj
sekciju **MIJENJAM** (po retku: stari `Opis` → `Izvod opis` → novi `Opis`).

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

- `main` = `b080739` — **podignut 05.09.2026.**, Netlify deployao. Nosi sve app
  promjene S127 (`attributeRules.ts`, `AddActivityPage.tsx`, `EditActivityPage.tsx`,
  `ruleManagedAttrs.test.mjs`) i S129 (`ExcelExportModal.tsx`, `DateRangeFilter.tsx`,
  `AppHome.tsx`).
- `test-branch` = `84f5edc`, ispred `main`a za **jedan commit** — samo
  dokumentacija (CLAUDE.md, session fileovi, ENRICH_PLAN). Ne traži deploy.
- ⚠ **Auto-mode klasifikator blokira i push na `main` i upise na PROD.** Oba
  pokreće Saša. Ne pokušavati zaobići — dry run + backup + naredba njemu.

## Novi/promijenjeni alati (S129)

| file | što |
| --- | --- |
| `fix_podizanje_150.py` | jednokratno, **primijenjeno** |
| `oznaci_iz_presedana.py` | ⏸ dry run čist, **`--apply` NIJE pušten** |
| `presedani.py` | `_PREFIX` popravljen — v. niže |

## Izmjereno u ovoj sesiji (ne ponavljati)

- **`izvodi/Analizirani_izvodi/` je mapa koju alati čitaju, ne arhiva.**
  `make_saldo_anchors.py:65`, `pregled_stanja.py:61`. `ZABA_2026-07/-08` su bili
  u korijenu ⇒ `promet_check` je prestajao na 2026-06.
- **`rpc_area_balance_anchored` bez `p_plus_slug`/`p_minus_slug` vraća nule** i
  `balance = anchor_amount`, uz uredan `n`. Ispravan poziv:
  `make_saldo_anchors.app_balance()`.
- **`uskladi_izvod.py` prima samo MC izvode** — S128 handoff ga je krivo
  preporučio za ZABA mjesece.
- **Visa dan naplate:** 5. → 719, 4. → 400, 6. → 176, 7. → 137, 12. → 63,
  8. → 62, 11. → 50, **3. → 11**, 13. → 1 (od 1.619 redaka).
- **PROD sidra:** ZABA aktivno `2026-07-30 = 13.815,33`; RF `2026-08-11 = 799,12`.
  Rupa u sidrima 2025-01-01 → 2026-07-30 je **namjerna** (sidro tek kad mjesec
  zatvori).
- **`Kokin_format` profil:** `{"periodKey": "last-3-months", "sortOrder": "asc"}`,
  23 kolone, bez `attrFilterRaw`.
- **71 redak nosi sirovi tekst izvoda u `Opis`u**, od toga 39 parking.

## Ispravljena tvrdnja iz CLAUDE.md-a

`kljuc_izvoda` **nije** skidao uvod kad ga nema. Nova zamka je zapisana u
CLAUDE.md („Rječnik `Izvod opis` → `Tip`/`Podtip`"). Ako naiđeš na sličnu tvrdnju
oblika „X i Y se poklapaju jer alat Z to ionako radi" — **ispiši oba i usporedi**,
ovdje je razlika bila u dva retka ispisa a stajala je devet sesija.

## Otvoreno / neverificirano

- **T-S129-A7…A10, T-S129-6/-7/-8, T-S129-B3 (parkirano), T-S129-B4** —
  v. `docs/sessions/tests/S129_tests.md`.
- Stariji ⬜ testovi: T-S128-4/-5, T-S127-2/-3/-5/-7/-10, plus raniji.
- `audit_tests.py`: **0 sesija za arhivu**; 40 testova koje PENDING ne spominje i
  99 ⬜ koje „Otvoreno:" ne navodi — poznata neusklađenost, nije dirana danas.
