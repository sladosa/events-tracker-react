# Sljedeća sesija — handoff

**Pisano protiv commita:** `S126: test sekcije TRAZI redak umjesto da mu racuna
polozaj` (`b4aeecb`, i `test-branch` i **`main`**). Ako `git log` pokazuje novije, čitaj ovo kao
**povijest** — CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Gdje smo

Krenulo je od „Koka je poslala kolovoške izvode", završilo s **računom koji se
slaže s bankom u cent**.

| | |
| --- | --- |
| `Kokin tekući ZABA` | ✅ **12.784,36 €** = ispisano stanje s `ZABA_2026-08.pdf` |
| uvoz | 75 novih / 16 izmjena / 1 nepromijenjen — točno kako je preview najavio |
| `Izvod opis` (oznaka „potvrđeno izvodom") | 46 / 46 na kolovoškim ZABA retcima |
| MC košara 11.09. | 46 redaka / 1.048,72 |
| `T-S125-5` (Excel put za tuđi redak) | ✅ **prvi put potvrđen uživo** |

**Kokina Excelica je prestala biti izvor istine za kolovoz** — baza ima 46 redaka
koje ona nema, i svaki nosi potvrdu s izvoda.

## Što čeka tebe

**1. ⭐ Razvrstaj 33 retka s `Tip = N/A`** (od 30.07. nadalje). Osam ZABA retka se
**samo imenuje** u `Izvod opis`: E.ON ×2, HRT, TELEMACH ×2, NP vodovod, KTD Bilan,
NUV. Ostatak je MC. Kad ih jednom razvrstaš, idući mjesec ih rječnik pogađa sam —
svaka tvoja odluka postaje presedan.

**2. Tek POSLIJE toga upiši sidro** `12.784,36` @ **26.08.2026.**, izvor *ispisano
stanje s izvoda*, `ZABA_2026-08.pdf`.
⚠ Ne prije. Delta prozor kreće `max(dan nakon sidra, danas − N)`, pa bi sidro
**zaključalo kolovoz** i onih 33 retka ne bi se moglo dohvatiti delta sheetom.
⚠ Odgoda je sigurna samo jer razvrstavanje ne dira iznose. Promijeni li se ijedan
**iznos ili datum** u kolovozu prije nego sidro sjedne, to prođe bez ijedne kontrole.

**3. Dva MC retka po `9,99`** (`PAYPAL *AC WALKFT` 10.08., `APPLE.COM/BILL` 17.08.)
nisu uvezena — isti iznos već postoji u bazi 13 odnosno 20 dana ranije.
**Prvo ispravak datuma u bazi, pa uvoz**; obrnuto udvostručuje tiho (razred S115).
Dok se ne razriješe, kontrola košare pokazuje `razlika = 19,98` — točno oni.

**4. ✅ Deploy na `main` je NAPRAVLJEN** (03.09., `b4aeecb`). Koka od sada vidi
S125 i S126: ✎ na desktopu, sekciju košare i stupac `Provjeri`, „Ispravi kao
vlasnik Aree" u uvozu, novi raspored delta sheeta, i izvoz koji **padne s porukom**
umjesto da tiho izađe kraći.
⚠ **Hard refresh je dio postupka**, ne higijena (S118): stari keširani bundle tiho
osakati uvoz. Na mobitelu — zatvori i ponovno otvori aplikaciju.
⚠ Saldo `12.784,36` je bio točan **i prije** deploya — podatak je podatak. Deploy
je donio featuree, ne brojku.

**5. Osam novih testova čeka pogled** — `T-S126-1…8`. Mjerenja su prošla, ali ih
nitko nije potvrdio u aplikaciji.

**6. Rečenica koju Koki još nitko nije rekao** (stoji od S124): *kad počne upisivati
u app, u Excelicu više ne.* Sad je hitnija nego prije — vratila se Excelici.

## Što se pokazalo vrijednim, za ubuduće

**Jedan skraćen ispis stajao je osamnaest sesija.** Vjerovali smo da ZABA izvadak
nema po čemu spariti retke jer „svaki nalog počinje istim tekstom". Prefiks ima 66
znakova, ispis je rezao na 60. Primatelj je cijelo vrijeme stajao iza njega.

**Tvoja tri prijedloga danas su svi bili točni**, i svaki je otvorio nešto:
žigosanje postojećih redaka (bez njega ne postoji stanje „pitanje"), skraćivanje
opisa (otkrilo da pravilo `Naknada za ` prekomjerno hvata), i selidba kontrole
iznad sekcije (bez nje MC retci ne bi imali kamo).

**Pitanje „može li to prekinuti uvoz" bilo je pravo pitanje.** Odgovor je ne, ali
tek nakon što se pogledalo u parser — i sad to drži test umjesto pretpostavke.

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- `test-branch` i `main` su **na istom commitu** (`b4aeecb`). Netlify je deployao
  S125 + S126 (22 commita, `c156057` … `b4aeecb`) 03.09.
- **PROD ima migracije `043` i `044`.** Nove migracije nisu potrebne za S126.
- Saša radi **lokalno protiv PROD baze** (`.env.prod.local`), pod **Kokinim**
  (owner) računom.
- Radni artefakti sesije: `Claude-temp_R/s126/` (nisu u gitu).

## Što je S126 napravio

```
c90343a  kontrola kosare seli IZNAD sekcije (gapRows +1 -> +4); `Provjeri`
         dobiva stil zaglavlja; testovi 33 -> 36
6e536c5  presedani.py (nov) + fill_from_izvod: --presedan / --zigosi / --mc,
         1:N prepoznavanje, skracivanje `Izvod opis`
5530125  zatvaranje sesije (testovi, povijest, CLAUDE.md, handoff, ENRICH_PLAN)
bddc766  help: kontrola kosare je IZNAD sekcije
b4aeecb  test sekcije TRAZI redak umjesto da mu racuna polozaj
```

⚠ **`importForeignRows` je pao 2/25 prije deploya, i to je bio TEST a ne kod.**
Racunao je polozaj sekcije (`hdr + 1 + 1 + BLANKS + 1`), a S126 je izmedju
praznih redaka i sekcije ubacio tri retka kontrole. Popravljeno tako da sekciju
**trazi po sadrzaju** — 26/26. Pouka: layout je vec na dva mjesta u kodu; treca
kopija u testu jamci da ce se jednom raziici.

## Alat — kako se pokreće

```powershell
cd C:\0_Sasa\events-tracker-react\data-prep_tools\Financije
..\Tools\venv\Scripts\python.exe fill_from_izvod.py "<delta>.xlsx" --zaba "..\..\data-prep_data\Financije\izvodi\ZABA_2026-08.pdf" --od 2026-07-31 --mc "..\..\data-prep_data\Financije\izvodi\MC_2026-08.pdf" --koka "..\..\data-prep_data\Financije\Financije 2026-08-23.xlsx" --presedan prod --zigosi
```

⚠ **Jedna linija.** `^` je cmd.exe, ne PowerShell; `run.bat` traži `.\` i ima
`pause` na kraju. Zaobilazi se pozivom venv pythona izravno.

## Otvoreno / sljedeće

- ✅ **Merge na `main` napravljen** 03.09. (`b4aeecb`), sync-back odrađen.
  Migracije nisu trebale — `043` i `044` su već bile gore.
- **33 retka `N/A`** — v. DIO 1.
- **`presedani.py` je prototip za `docs/RULES_ENGINE_SPEC.md` / Fazu 3.** Rječnik
  danas živi u Python alatu i radi **na izvozu**; spec traži pravila **u bazi uz
  Areu** i evaluaciju **na uvozu**. Brojke za spec sad postoje: tri ključa, pragovi
  ≥ 90 % / ≥ 3 (≥ 2 za oštri), `N/A` ne glasa, sirovi tekst nije oznaka.
  ⚠ Preduvjet za „sumnjiv redak ide u izvještaj o uvozu": `BUG-S114-REPORTDD`
  (izvještaj nema `DropdownData`).
- **`uskladi_izvod.py` pukne na Windows konzoli** pri ispisu `⚠` (cp1252,
  `UnicodeEncodeError` u `report()`). Izvještaj se prekine na pola. Jedan redak
  (`sys.stdout.reconfigure(encoding='utf-8')`), nije napravljen.
- **`Visa nema fiksan dan naplate`** (S124) — i dalje otvoreno, 855 redaka ne pada
  ni u jednu košaru.
- **Preostali gutači grešaka:** dva upita u `loadSharedEmailsByArea`
  (`excelDataLoader.ts:611,620`), namjerno ostavljena.

## Zamke potvrđene ovom sesijom (detalji u CLAUDE.md)

- **Skraćen ispis je hipoteza, ne podatak** — prije nego proglasiš da podatka nema,
  ispiši ga bez rezanja.
- **Sidro tvrdo zaključava početak delta prozora** (`max(dan nakon sidra, danas−N)`)
  — sidro na kraj tek usklađenog mjeseca izbacuje te retke iz svakog budućeg sheeta.
- **Ključ po iznosu mora nositi predznak**; **`N/A` ne glasa protiv klasifikacije**;
  **sirovi tekst izvoda nije oznaka** nego neobrađen ostatak.
- **Pravilo po ključnoj riječi mora se usidriti na položaj** kad je riječ dvoznačna
  (`Naknada za ` na početku = bankina naknada, iza prefiksa = tuđe davanje).
- **Kontrolni stupac ne izuzima `Delete?`** — split 1:N daje uvjerljivo krivu
  kontrolnu brojku baš tijekom pregleda.
