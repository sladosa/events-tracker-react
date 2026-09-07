# S130 — testovi

Sesija: 2026-09-07. Dvije teme: **dropdowni na praznim retcima delta sheeta**
(popravljeno) i **priprema PROD podataka za Kokin upis** (dry run, `--apply` čeka Sašu).

Stanje grana: `test-branch` = `0318314`, `main` = `b080739` (nedirano).

---

## A. Kod — dropdowni na praznim retcima delta sheeta

### T-S130-1 ⭐ `Podtip` na praznom retku nudi podtipove VLASTITOG `Tipa`

**Zašto:** do S130 se validacija praznih redaka **kopirala** sa zadnjeg povijesnog
retka, a `Podtip` je `depends_on` i formula mu nosi **apsolutnu** adresu roditelja
(`INDIRECT("Dep_tip_"&SUBSTITUTE(N18,…))`). Svih pet praznih redaka gledalo je `N18`.

**Preduvjeti:** aplikacija s `test-brancha` (`npm run dev:prod`), Area `Financije_all`.

1. Filter → `Kokin tekući ZABA`, Export → **Delta sheet**, preuzmi file.
2. Otvori u Excelu, nađi prvi **prazan** redak predloška (ima `Area`, `Category_Path`,
   email i vrijeme, ali nema datum ni iznos).
3. U tom retku u koloni **`Tip`** odaberi `Domacinstvo`.
4. Klikni ćeliju **`Podtip`** u **istom** retku i otvori dropdown.

**Očekivano:** nudi podtipove **Domacinstva** (`Rezije`, `Hrana`, `Parking`, …).
**Pad:** nudi podtipove nekog drugog `Tipa` — onog koji stoji na **zadnjem povijesnom
retku** iznad praznih. To je točno stari kvar.

5. Ponovi u **drugom** praznom retku s **drugim** `Tipom` (npr. `Prihodi`).

**Očekivano:** lista se mijenja po retku, ne po fileu.

⚠ **Metoda:** `Tip` u koraku 3 mora biti **različit** od onoga na zadnjem povijesnom
retku — inače bi i pokvaren kod ponudio točnu listu i test bi prošao nad kvarom
(razred „test koji nikad ne pada", S120/S129).

### T-S130-2 Prazan glavni blok i dalje ima dropdowne

**Zašto:** uz `mainCount = 0` (račun usklađen do sidra, prozor prazan) retka s kojeg
bi se kopiralo **nema**, pa je predložak ostajao bez ijednog dropdowna.

1. Postavi sidro tako da delta prozor ne uhvati nijedan redak (ili filtriraj na račun
   bez prometa poslije sidra).
2. Export → Delta sheet.

**Očekivano:** prazni retci imaju `Tip`, `Podtip` i provjeru datuma na `Datum naplate`.
**Pad:** ćelije bez dropdowna.

### T-S130-3 ✅ Automatski test (`deltaBlankRowDropdowns.test.mjs`)

```
node src/lib/__tests__/deltaBlankRowDropdowns.test.mjs
```

**Rezultat:** `8 passed, 0 failed`.
**Protuprovjera:** uz namjerno vraćeno staro ponašanje pada **4/8** — dakle test
stvarno nešto čuva. Padaju točno: „Podtip vezan na vlastiti Tip" (0/5), „nijedan
prazan redak ne gleda Tip zadnjeg povijesnog" (zamrznutih 5/5), i oba slučaja praznog
glavnog bloka.

### T-S130-4 ✅ Ostali lib testovi nisu regresirali

`deltaSheetLayout` 36/36 · `deltaAccount` 11/11 · `importForeignRows` 26/26 ·
`ruleManagedAttrs` 22/22 · `npm run typecheck` + `npm run build` čisti.

⚠ `structureExcel.test.mjs` pada s `SyntaxError` — **zatečeno**, file je okrnjen,
zadnji put diran u S17 (`75ef760`). Nije od ove sesije.

---

## B. Podaci — `MC_2026-08.pdf` i stariji izvodi (PROD)

### T-S130-5 ✅ `MC_2026-08.pdf` — dry run zatvara u cent

```
uskladi_izvod.py --izvod ...izvodi/MC_2026-08.pdf --env prod --dry
```

**Rezultat:** izvod 48 redaka / `1.068,70`; spareno **46** (`1.048,72`), za uvoz **2**
(`19,98`), duplikata **0**, pitanja za Koku **0**. Kontrola `1.068,70` == izvod.

Zatvara i T-S129-A10.

### T-S130-6 ⬜ `--apply` za kolovoz — 46 ispravaka

```
primijeni_uskladu.py --izvod ...izvodi/MC_2026-08.pdf --apply
```

**Očekivano:** `ispravci 46 · dopune 0 · brisanja 0 · prijenos 0`, backup napisan,
nijedan upis ne vrati 0 redaka.
⚠ **Vidi T-S130-9 prije nego ovo pustiš** — mijenja što Delta pokazuje.

### T-S130-7 ⬜ `--apply` za starije izvode — 21 ispravak + 2 brisanja

Zadani prolaz (bez `--izvod`) hvata **32** izvoda i nalazi `67` ispravaka. Od toga je
46 kolovoških; ostatak je **21** (13 redaka dobiva `Izvod opis`, 5 ispravlja
`Datum naplate`) i **2 brisanja**.

**Brisanja su provjerena i ispravna:**

| agregat u bazi | komponente s izvoda | svaka ima svoj redak |
| --- | --- | --- |
| `2025-03-20` `3,20` (opis `None`, `Izvod opis` `None`, `Tip = N/A`) | `KEKS PAY 1,60` ×2 | ✅ `81a97f4a`, `be4faa8c`, oba `2025-03-20` |
| `2025-06-03` `3,20` (isto) | `KEKS PAY 1,60` + `KEKS PAY 0,80` + `ZAGREBPARKING 0,80` | ✅ `3bae3179`, `bf276ea3`, `0e17950e`, svi `2025-06-03` |

**Očekivano:** nijedno brisanje ne dira redak koji nosi opis, klasifikaciju ili
`Izvod opis`. Svi su `Izvor = Mastercard` i **prije sidra** ⇒ saldo se ne miče.

### T-S130-8 ⬜ Sidro `2026-08-26 = 12.784,36`

```
make_saldo_anchors.py --anchor 2026-08-26
```

Preuzima T-S129-A7. Provjereno unaprijed: `promet_check` daje `2026-08` **`0,00`**
(prozor 30.07.→26.08., 46 redaka), a app na `26.08.` daje **`12.784,36`** = ispisano
stanje. Aktivno ZABA sidro je i dalje `2026-07-30 = 13.815,33`.

⚠ Nepovratno u smislu prozora: nakon sidra nijedan budući delta sheet ne može doseći
prije `27.08.`

---

## C. Nalaz koji čeka odluku

### T-S130-9 ⭐⬜ `--apply` za kolovoz puni košaru sa 46 upozorenja

**Izmjereno:** košara koju Delta prikazuje **jest točno tih 46 redaka** —
`dospijeće > danas`, svih 46 `2026-09-11`, svih 46 `Izvor = Mastercard`, svih 46
`Status = Planiran`, Σ `1.048,72`.

`Provjeri` stupac glasi `Status <> "Planiran" AND dospijeće > TODAY()`. Dakle:

| stanje | `Provjeri` |
| --- | --- |
| **bez** `--apply` | prazno za svih 46 |
| **s** `--apply` (46 → `Izvrsen`) | **svih 46** pali *„dospijeva tek 11.09.2026. — nije moglo biti naplaćeno"* |

**Test:** izvezi Deltu **prije** primjene i provjeri da je stupac `Provjeri` prazan;
zatim (ako se odluči primijeniti) izvezi ponovo i provjeri koliko redaka nosi napomenu.

⚠ **Pod tim leži odluka o modelu, ne bug:** što `Status` znači za kartični redak u
**otvorenoj** košari. Dva pravila se razilaze — „kartični redak je `Izvrsen`, kupovina
se dogodila" (izmjereno Visa 855/855) protiv delta toka gdje je `Status` prekidač
potvrde („potvrdi promjenom `Status`a"). Slažu se za zatvorene košare, sudaraju samo
za otvorenu. **Nije odlučeno.**

### T-S130-10 ⬜ Kontrola košare pokazuje razliku `19,98`

`--apply` **ne uvozi** — radi samo ispravke, dopune i brisanja. Dva nova retka
(`PAYPAL *AC WALKFT 9,99` @ 10.08., `APPLE.COM/BILL 9,99` @ 17.08.) ostaju vani.

**Očekivano** u sekciji košare delta sheeta:

```
Σ košara            1.048,72
naplaćeno s izvoda  1.068,70   (upisuje se rukom s MC izvoda)
razlika                19,98
```

Razlika je **točno ta dva retka**. Oba su druga naplata istog trgovca istog dana
(WalkFit ima i `34,99`, Apple i `2,99`), dakle nisu duplikati.

⚠ Kartični redak **ne smije** u prazne retke glavnog bloka (S126), pa se ta dva ne
mogu dopisati kroz Deltu — traže zaseban uvoz.

---

## D. Parkirano

### T-S130-11 ⏸ Prijedlog `comment`a iz povijesti — izmjereno, ne radi se

Sašina odluka: za sada ništa. Brojke su u CLAUDE.md backlogu da se ne ponavljaju.
Ukratko: ključ `Podtip` sam, `Izvor = Racun`, zadnjih 12 mj ⇒ **top-5 = 93,4 %**,
najduža lista 14 stavki; **iznos ne doda ništa** a suzi pokrivenost s 335 na 193
retka; top-1 je samo 57,6 % ⇒ **ponuda, nikad upis**.
