# S128 — testovi

**Kontekst:** uvoz 2023.+2024. na PROD (2.738 redaka), provjera koja ne prolazi
kroz sidro, dva dokazana popravka i pregledni workbook točnosti stanja.

⚠ **Sesija je stala na jednom koraku:** `fix_parking_i_multisport.py --apply`
nije pokrenut — auto-mode klasifikator blokirao je upis na PROD. Dry run je
prošao čisto i sve invarijante stoje. T-S128-1 je taj korak.

---

## T-S128-1 ⭐ Primjena dokazanih popravaka

**Ovo je prvi korak sljedeće sesije — sve ostalo visi o njemu.**

1. ```
   cd c:\0_Sasa\events-tracker-react\data-prep_tools\Financije
   ..\Tools\venv\Scripts\python.exe fix_parking_i_multisport.py
   ```
   (bez `--apply` — dry run, ništa se ne piše)
2. Provjeri ispis: mora pisati `banka 2x0,70   baza 2x0,70 + 1x1,40` za sva tri
   dana i `veljacki prozor 2x49,00   ozujski prozor 0x49,00`.
3. Pokreni s `--apply`.

**Očekivano:** backup u `_arhiva/backup_S128_*.json` (4 eventa, 36 atributa),
3 brisanja po 9 atributa, 1 pomak datuma, na kraju
`provjera: obrisanih redaka ostalo 0`.

**Pad:** `✗ invarijanta ne stoji — netko je ovo vec dirao. STOP.` Tada NE
forsirati — znači da je stanje baze drugačije nego kad je nalaz izmjeren.
Regeneriraj `pregled_stanja.py` i pogledaj list `Sporno`.

⚠ Skripta je namjerno takva: popis ID-eva je izmjeren, ali **ID nije dokaz**.
Bez ponovne provjere bi popravak koji je jednom bio točan ostao „točan" i nakon
što ga netko riješi rukom — pa bi obrisao **bankin** redak umjesto Kokinog.

---

## T-S128-2 ⭐ Δ pada na nulu u četiri mjeseca

Odmah nakon T-S128-1:

```
ET_TARGET=prod ..\Tools\venv\Scripts\python.exe promet_check.py --od=2025-01
```

**Očekivano:** `2025-02`, `2025-03`, `2026-03` i `2026-04` pokazuju `0.00`.
Preostaju samo `2025-07 +0,80`, `2025-08 −46,74`, `2025-10 −150,00`.
Zbroj razlike prema prijašnjem stanju mora biti točno `4,20 + 0,00` (par
49,00 se poništavao, pa na ukupni nakupljeni pomak ne utječe).

**Pad:** ako neki od ta četiri i dalje odstupa — popravak je dirnuo krivi
redak. Backup je u `_arhiva/`.

---

## T-S128-3 Redak je nestao iz aplikacije, ne samo iz brojke

1. U appu (PROD, Financije_all) filtriraj na `05.03.2026.`
2. Pogledaj parking retke tog dana.

**Očekivano:** dva retka po `0,70` (oba s tekstom izvoda `Bmove…`), **nema**
retka od `1,40`.

**Zašto se gleda i ovo:** brojka može biti točna a lista pokvarena — brisanje
eventa bez atributa ostavlja redak koji izgleda netaknuto (S125 razred).

---

## T-S128-4 Pomaknuti redak nosi i `Datum naplate`

1. U appu nađi redak `Anja 49,00`.
2. Provjeri datum aktivnosti i atribut `Datum naplate`.

**Očekivano:** oba na **02.03.2025.** (bilo `24.02.2025.`).

**Pad:** `Datum naplate` ostao na 24.02. ⇒ tvrdi da je banka teretila račun
prije nego je transakcija postojala. Za `Izvor = Racun` je po D1b jednak
`event_date`-u.

⚠ `Stanje` na tom retku **ostaje star** i to je namjerno — snimka je Kokinog
lanca, jedini neovisni svjedok protiv našeg izračuna.

---

## T-S128-5 Pregledni workbook se otvara bez „repair"

1. Otvori `data-prep_data/Financije/pregled_stanja_*.xlsx` u Excelu.

**Očekivano:** otvara se bez ijedne poruke, tri lista (`Pregled`, `Sporno`,
`2023`), autofilter na oba tablična lista, zamrznuto zaglavlje.

**Pad:** Excel nudi „repair" ⇒ neka pripovjedna ćelija je prošla mimo
`tekst()` helpera i openpyxl ju je spremio kao **formulu** (S124 zamka).
Poruka `Removed Records: Formula from /xl/worksheets/…` to potvrđuje.

---

## T-S128-6 ⚠ Prije deploya na `main` — T-S127-9

Nije nov test, ali je **jedina brana** za merge S127 koda.
Koraci su u [S127_tests.md](S127_tests.md#t-s127-9--otvaranje-retka-ne-smije-ništa-promijeniti).

⚠ Lokalni dev server gađa **PROD** bazu ⇒ prije testa zapiši stari
`Datum naplate`. Pad mijenja jedan redak i lako se vrati.
