# Faza 3 — automatika na Import putu: mjerenje i plan

**Mjereno na PROD-u 2026-09-14 (S136).** Dokument postoji da se hipoteza iz backloga
ne gradi nanovo: brojke su ovdje, i **jedna od njih ruši polazište**.

---

## DIO 1 — jednostavno, za Sašu

### Što je Faza 3 trebala biti

U aplikaciji postoje **pravila** koja sama popunjavaju polja: npr. „ako je `Izvor =
Mastercard`, `Datum naplate` je 11. sljedećeg mjeseca". Ta pravila rade kad unosiš
**u aplikaciji**, ali **ne rade kad uvoziš Excel**. Faza 3 je trebala zatvoriti tu
rupu, i u backlogu piše da time „otključava tri featurea".

### Što mjerenje kaže

**Prvi feature je već riješen — samo drugim putem.**

| retci s `Izvor`om u `Financije_all > Transakcija` | 5.192 |
| --- | ---: |
| **prazan `Datum naplate`** | **0** |

Dakle **nijedan** redak nema prazno to polje. Python alati ga već pune pri
generiranju filea. Automatika na uvozu danas **ne bi napravila ništa**.

**Drugi feature (razvrstavanje `Tip`/`Podtip`) ima metu, ali je meta uglavnom stara.**

| | redaka | udio |
| --- | ---: | ---: |
| klasificiran `Tip` | 3.610 | 69,5 % |
| `Tip = N/A` ili prazno | **1.582** | **30,5 %** |

A po godinama: **2023. → 585 · 2024. → 476 · 2025. → 413 · 2026. → 108.**

Dakle 93 % neklasificiranih je **povijest**. Povijest se razvrstava **jednokratno**,
alatima koji već postoje i izmjereni su (`presedani.py`, `apply_rules.py`) — ne
motorom koji radi pri svakom uvozu.

### Što to znači za odluku

**Faza 3 se sada ne isplati graditi.** Ne zato što je loša ideja, nego zato što
podaci na kojima bi radila danas ne postoje:

- `Datum naplate` — 0 redaka bi imalo koristi
- `Tip`/`Podtip` — ~13 redaka mjesečno u tekućoj godini (108 u 2026.)

⚠ **Kad postaje vrijedna:** kad Koka preuzme roundtrip i njeni **novi** retci počnu
dolazili bez tih polja. To je potreba koju pokreće **cutover**, ne današnje stanje.
Do tada bi Faza 3 bila kod koji čeka podatke.

### Što je onda vrjednije

Mjerenjem se pokazalo i ovo: **1.431 redak (27,6 %) nema `Izvod opis`** — oznaku
„banka je ovo potvrdila". To je isti razred posla (dopuna podataka), ima **deset
puta veću metu**, i već mu je otvorena stavka u backlogu (RF retci).

---

## DIO 2 — tehnički, da se sljedeća sesija ne vrti u prazno

### Stanje koda (provjereno, ne pretpostavljeno)

- Stroj za pravila je **gotov i čist**: `src/lib/attributeRules.ts` →
  `computeSetAttributeValue(rule, mapValue, sessionStart)`. Čista funkcija, bez DB-a.
- Pozivatelji: `AddActivityPage.tsx:817` i `EditActivityPage.tsx`.
- **`src/lib/excelImport.ts` nema NIJEDNO pojavljivanje `settings` ni `automations`.**
  Uvoz pravila ne ignorira — nikad ih ne učita. Zahvat je zato malen u kodu, a sav
  posao je u odlukama ispod.
- Ciljno mjesto upisa: `buildAttrData()` (`excelImport.ts:1428`) i pozivatelji oko
  `:1212` / `:1408`.

### ⚠ Pet odluka koje se moraju donijeti PRIJE koda

1. **Okidač.** Jedino sigurno: **samo kad je ciljna ćelija u fileu prazna.** Nikad
   preko onoga što file nosi — inače uvoz prepisuje podatak s izvoda izračunom.
   ⚠ U Editu je okidač *čovjekov potez*, jer bi računanje na otvaranju prepisalo
   stvarne datume (S127). Na uvozu čovjeka nema, pa prazninu mora zamijeniti
   **prazno polje kao jedini uvjet**.
2. **Koji retci.** `row_hash` **preskače nedirnute retke**, pa oni pravilo nikad ne
   vide ⇒ postojeći prazni se ovim **neće** popuniti retroaktivno. To je zaseban
   prolaz, i mora biti rečeno naglas da se ne očekuje.
3. **`row_hash` i roundtrip.** Otisak se računa iz ćelija **filea**. Upiše li uvoz
   vrijednost koju file nema, **sljedeći izvoz se razlikuje od uvezenog** i redak
   ispadne kao promijenjen. Odlučiti prije, ne poslije.
4. **Izvještaj mora reći što je izračunato.** Inače file i baza tiho razilaze, a
   izvještaj je jedino mjesto gdje Koka to vidi.
5. **Baza za datum** je `event_date` retka, ne `sessionStart` — izrijekom.

### ⚠ Pravilo koje se NE SMIJE primijeniti naslijepo

Config nosi `Visa = next:3`, a izmjereno na **855 Visa redaka** (S124) je da Visa
**nema** fiksan dan naplate:

```
5. → 383×   4. → 231×   6. → 109×   7. → 82×   11. → 49×   3. → 11×
```

Primijenjeno na uvozu, to bi proizvelo **uvjerljivo krive** datume na stotinama
redaka — i tiho, jer saldo kartične retke ne broji. `Racun`/`Cash` (isti dan) i
`Mastercard` (11., izmjereno čisto) su u redu; **Visa nije**, dok se ne razriješi
PBZVISA izvodima.

### Kako izmjeriti ponovno (jedna skripta, bez pamćenja)

Brojke gore dobivene su čitanjem PROD-a preko `data-prep_tools/Financije/_db.py`
(`load_env('prod')` + `rest`), bez pisanja:

1. `attribute_definitions` → id-evi slugova `izvorplacanja`, `datum_naplate`, `tip`
   u Arei `Financije_all`
2. `event_attributes?attribute_definition_id=in.(...)` → grupiraj po `event_id`
3. broji retke koji **imaju** `izvorplacanja`, a **nemaju** `datum_naplate` / imaju
   `tip ∈ {'', 'N/A'}`
4. za razdiobu po godinama spoji s `events.event_date`

### Preporuka

**Ne graditi sada.** Ponovno otvoriti kad se dogodi **jedno** od ovoga:

- Koka preuzme roundtrip i njeni novi retci počnu dolaziti bez `Datum naplate`
  (mjerljivo: prva brojka iznad prestane biti 0), **ili**
- udio `Tip = N/A` u **tekućoj** godini prijeđe ~100 redaka mjesečno.

Do tada su vrjedniji: dopuna `Izvod opis` (1.431 redak) i stavke iz „Nakon tranši"
koje diraju **unos**, ne uvoz.
