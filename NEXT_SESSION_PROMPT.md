# Sljedeća sesija — handoff

**Pisano protiv commita:** `S124: openpyxl je pripovjednu recenicu spremio kao FORMULU`
(grana `test-branch`). Ako `git log` pokazuje novije commitove, čitaj ovo kao **povijest**,
a ne kao stanje — CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Što je gotovo

**Pitanje `Datum naplate` je zatvoreno, i to papirom.** `MC_2026-06.pdf` je cijelo vrijeme
bio u `izvodi/Analizirani_izvodi/` — prošla sesija je zaključila da ga treba, ne provjerivši
podmapu. S njim se košara 11.07. razlaže potpuno: **48 redaka = 1.244,74 u cent**, 2
duplikata, 23 s krivim datumom naplate.

**Cijela Mastercard povijest 2026. zatvara se u cent — svih sedam izvoda.** To je najjača
brojka koju sustav dosad ima: ne „zbroj ispadne blizu" nego *svaki redak papira je objašnjen*.

**Nov alat `uskladi_izvod.py`** radi to mjesečno i dijeli nalaz po tome **tko odlučuje** —
što je mehanički naš posao, a što je stvarno pitanje za Koku. Od 73 „pitanja" koliko ih je
imao stari file, ostalo ih je **sedam**.

## Što te čeka — po redu

**1. Pogledaj `data-prep_data/Financije/uskladjenje_MC_2026.xlsx`.**
List `Pregled` prvo: sedam izvoda, sedam zelenih „DA, u cent". Ispod piše što file predlaže
i — jednako važno — što **namjerno ne dira** (3 pomaka datuma, 2 odgođena brisanja).

**2. Ako ti tekst za Koku zvuči kako treba, ide njoj.** Ona uvozi list `Events`
(Activities → Import → Apply). To je **korak 3** plana i prvi put da ona sama nešto mijenja
u bazi. Očekivano: 29 Modify, 0 New, 2 obrisana.
⚠ Backup prije toga. ⚠ Ako preview pokaže **New** umjesto Modify — neka ne primijeni.

**3. Sedam pitanja za nju** su na listu `Pitanja`. Šest od sedam nema **nikakav** opis, pa
je pravo pitanje vjerojatno „odakle retci bez opisa", ne samo „je li ovo bilo".

**4. `043` prije nego Koka preuzme unos** — ali gated na `BUG-S123-EDITMARK`.
⚠ Provjereno: `043` je **samo na TEST-u**. I ne rješava tvoj problem — daje prava
**vlasnici nad grantee-jevim** retkom, a tebi treba obrnuto. **Kad ona preuzme unos, ti joj
retke ne možeš ispraviti kroz app**, ostaju ti skripte.

**5. Merge na main tek nakon toga.** `test-branch` je **13 commitova ispred**; u tome je i
njen alat (delta sheet `BUG-S123-DELTAACCT`, sekcija „planirano", zadani export profil).
Ona to danas nema.

## Što ostaje otvoreno prema njoj

- Onih 7 redaka
- Prazan `comment` na skupnoj MC naplati 11.07. (ostalih 18 nosi strojni tekst izvoda)
- Rečenica koju joj još nitko nije rekao: **kad počne upisivati u app, u Excelicu više ne.**

## O „odricanju od Excelice" — dvije odluke, ne jedna

**(a) Prestati voditi oboje** je blizu: treba povjerenje, mjesečna rutina uz izvod, `043`
i S122–S124 kod na PROD-u.
**(b) Umiroviti file** je daleko, i blokada nije radni tok nego **arhiv**: njen file ima
**2.765 redaka od 2023.**, a `Financije_all` ima 2.323 eventa i kreće **2025-01-01**. Njene
2023. i 2024. u toj Arei ne postoje. Realno: prestaje upisivati, file ostaje kao arhiv dok
batch 2024/2023 ne uđu.

---

# DIO 2 — tehnički (za Claudea)

## Grane i migracije

- `test-branch` **13 commitova ispred `main`** (S122–S124). `main` je na S117 kodu.
- **`043` je samo na TEST-u** — izmjereno: `events.edited_by` na PROD-u vraća 400.
  PROD ima 035–042.
- Ništa se ne pusti na PROD bez izričitog traženja (Netlify troši kredite).

## Nov alat: `data-prep_tools/Financije/uskladi_izvod.py`

```
python uskladi_izvod.py --izvod <MC_*.pdf> [--izvod ...] --dry
python uskladi_izvod.py --izvod ... --file <out.xlsx>     # review workbook
```

Zasad **samo MC** izvodi. Visa/ZABA imaju drugi format — parser staje s porukom.
Guard: parsirani zbroj se uspoređuje s ispisanim `UKUPNO (EUR)` i alat **stane** ako se ne
poklopi (parser koji pročita 47 od 48 redaka daje uvjerljiv i nepotpun nalaz).

Sve zamke sparivanja su u docstringu i u CLAUDE.md („`Izvod opis` JE oznaka…", „Pravilo 1:N").
**Ne mijenjaj sparivanje bez ponovnog mjerenja nad svih 7 izvoda** — svaki od pet uvjeta je
tamo jer je bez njega proizveden konkretan krivi ispravak.

## Stanje podataka (PROD, izmjereno S124)

| | |
| --- | --- |
| MC 2026, svih 7 izvoda | zatvara se u cent |
| za ispravak | 25 (u review fileu) |
| dopuna (rata na bankine LUFTHAN retke) | 2 |
| brisanje (`LH 1/3`) | 2 |
| odgođeno brisanje (`LH 2/3`) | 2 — čeka tranšu 4 |
| za uvoz (tranša 4, `MC_2026-07`) | 26 / 599,56 |
| pitanja za Koku | 7 |

## Neverificirano

- **T-S124-1…8** (v. `docs/sessions/tests/S124_tests.md`). Najvažniji je **T-S124-3**
  (Koka uvozi) i **T-S124-8** (`Status` prešao samo uz `Izvod opis`).
- Review file **nije prošao kroz stvarni uvoz** — `event_id`-evi su PROD-ovi pa se ne da
  probati na TEST-u. Zaštita je preview prije Apply.
- Sve iz S123 što je ondje bilo neverificirano i dalje je.

## Sljedeći koraci (nastavak plana iz S124)

3. Koka uvozi review file ⇒ prvi krug povjerenja
4. `BUG-S123-EDITMARK` izmjeriti (`page.on('response')` — sadrži li payload `edited_by`;
   **ne** mijenjati locator) → `043` na PROD → **tek onda** merge na main
   ⚠ redoslijed: **migracija prije koda**, inače vlasnica dobije gumb Edit koji RLS
   zaustavi, a blokiran write vrati 200 s nula redaka
5. Tranša 4 (26 redaka) — **s brisanjem `LH 2/3` u istom potezu**
6. Batch 2024, pa 2023 ⇒ tek to otvara umirovljenje Excelice

## Ideje koje su se pojavile, nisu izvedene

- **Isti alat za Visa i ZABA.** MC parser je 40 redaka; logika sparivanja je zajednička.
  ZABA je zanimljiviji jer ondje retci **diraju saldo**, pa greška ima veću cijenu.
- **Rupa u značenju „write access":** grantee s pravom pisanja ne može ispraviti tuđi redak
  u arei u koju smije pisati. Imenovano, nije riješeno.
