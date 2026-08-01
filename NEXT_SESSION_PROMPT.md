# NEXT SESSION PROMPT — Financije: testiranje pa batch import

**Zadnja sesija: S107t (2026-08-01, Opus).** Struktura `Financije_all` i generator uvoznog
Excela gotovi; rata tok prepravljen; `automations.rata` sad prolazi Structure roundtripom.
**Ništa od app izmjena nije još testirano u appu** — to je prvo na redu.

**Trajni plan prelaska:** `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` **§13**.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Gdje smo stali

Sve je napravljeno i programski provjereno, ali **ti još nisi ništa isprobao u aplikaciji**.
Sesija je stala na tome.

Prvo obriši `Financije_all` iz TEST baze (struktura se mijenjala tri puta u toku dana), pa
uvezi ispočetka.

| korak | što | file |
| --- | --- | --- |
| 1 | obriši areu `Financije_all` u TEST-u | — |
| 2 | Structure tab → Import | `Financije_all_structure_20260801_172202.xlsx` |
| 3 | Activities tab → Import | `Financije_all_import_20260801_172535.xlsx` |
| 4 | testovi **T-S107t-1 … T-S107t-7** | `Claude-temp_R/test-sessions/S107t_tests.md` |

Pokretanje: `cd C:\0_Sasa\events-tracker-react` pa `npm run dev:test`.
(Zapamti: `npm` mora ići **iz direktorija projekta**, inače javi da nema `package.json`.
Browserslist poruka nakon starta je **upozorenje, ne greška** — app radi.)

## Najvažniji test je T-S107t-3 (rate)

To je jedini dio gdje je pisan **novi app kod**, pa je i najveći kandidat za problem.

Unesi kupovinu: Mastercard, Isplata 132,66, `Rate? ✓`, `Broj rata = 6`, pa Finish.

Treba se pojaviti modal sa 6 rata po 22,11 i datumima naplate 11. u svakom sljedećem mjesecu.
Nakon potvrde **svih 6 mora stajati na današnjem danu** u listi, kao 6 odvojenih redaka.

Ako modala uopće nema → provjeri je li Structure import prijavio **Automation rules: 2**.

## Što je odlučeno u ovoj sesiji

- **`Rata br`** — novo polje uz `Broj rata`. `Broj rata` je ukupno (npr. 6), `Rata br` je koja
  je ovo po redu (npr. 3). Prije je taj broj postojao samo kao tekst u napomeni.
- **`Datum kupovine` je izbačen.** Tvoje pitanje „zašto ga još čuvamo" pokazalo je da nema
  posao: kad `event_date` uvijek znači dan kupnje, `Datum kupovine` bi bio ista stvar dvaput.
  Vraća se u minuti ako ikad zatreba.
- **Rate ostaju na danu kupnje** (tvoj prijedlog). Kupovina je jedna, samo se plaća u više
  navrata — razlikuje ih `Datum naplate`. Za pregled „koliko me čeka kojeg datuma" treba
  export sortiran po `Datum naplate`.
- **Kokina povijest se ne dira** — njene rate ostaju raspoređene po mjesecima naplate, jer
  pravi datum kupnje za većinu ne znamo.
- **32 lažne rate očišćene** u Reviewu (HLK članarina i APN porez — `3/26` je značilo ožujak
  2026., a program je to pročitao kao „rata 3 od 26").

## Što još čeka tebe (ne blokira)

1. 700 € bankomat 26.11.2025. — pitanje za Koku (nije na izvodu)
2. `Saldo kontrola` — 7 razlika, pitanja za Koku (2026-01 +359, 2024-09 +149, 2×±49 multisport)
3. 15 nemarkiranih rata (banka zapisala `RATA n/m`, Koka nije) — izmjereno, neizvršeno

---

# DIO 2 — Tehnički dio (za Claudea)

## Stanje

`test-branch`, sve commitano. `typecheck` + `build` čisti. **Nijedan app test nije odrađen.**

| područje | stanje |
| --- | --- |
| `Financije_all` struktura | `make_financije_all_structure.py` → **15 atributa** (bez `Datum kupovine`), `Automations` 2 pravila (`set_attribute` + `rata`) |
| import generator | `make_financije_import.py` — `--sample N`, `--from/--to`, `--dry`; guard imena+tipova protiv strukture |
| Review | 4996 redaka; `Rate?=DA` **629**; `Rata br` se izvodi iz `n/m` (621 od 629) |
| app kod | `Automations` roundtrip + rata model B — **netestirano** |

## Prvo: T-S107t-1…7 (`Claude-temp_R/test-sessions/S107t_tests.md`)

Ako padne T-S107t-3, redoslijed provjere:
1. je li `settings.automations.rata` uopće u bazi (Structure import → „Automation rules 2")
2. `detectRata` vraća `null` ako je `count <= 1` ili iznos 0 — provjeri da je `AmountAttr`
   `isplata`, a ne `uplata`, za taj smjer
3. slijepljena lista ⇒ `rataSessionStarts` pomak ne stiže do inserta

## Zatim: batch import

`make_financije_import.py --from … --to …`. **Batchevi moraju biti datumski disjunktni** —
`session_start` se dodjeljuje po danu (`09:00 + n`), pa bi preklapanje dana sudarilo vrijeme
s već uvezenim zapisima. Cutoff na granici dana.

Redoslijed: 2026 (najmanji, 750 redaka) kao proba mehanizma → pa unatrag. ~50k
`event_attributes` ne u jednom naletu (S105 IO incident).

## Četiri tihe rupe u `excelImport.ts` (ugrađene u generator, NE otkrivati ponovo)

1. `session_start` mora biti **tekst `"HH:MM"`** — inače svi redovi dobiju 09:00 bez upozorenja
2. krivo ime atributa se **tiho preskoči** (`:836`, nema `else`) → guard u generatoru
3. `Rate?` je `boolean` — `'DA'` bi se spremio kao **FALSE**
4. email u kol. G mora biti račun koji **izvodi** import (`foreignMode='skip'`)

## Odluke koje se ne otvaraju ponovo

- **D1** `event_date` = datum kupnje; `Datum naplate` = zaseban atribut (kad novac ode)
- **D1b** (novo) sve rate jedne kupovine dijele `event_date` = dan kupnje; razlikuje ih
  `Datum naplate` + pomak `session_start`-a za 1 min; `Rata br` = 1..N
- **D1a POVUČEN** — `Datum kupovine` izbačen iz strukture
- **D6** import pod **Kokinim** accountom na PROD-u (kol. G = njen email)
- Nema `staging_financije`; nema trećeg storea između Excela i baze (S107q)

## Preostale rupe / backlog

- **`export_profiles`** ne prolazi Structure roundtripom (ključ `attr:Area||CatPath||AttrName`)
  ⇒ `ExportProfiles` sheet, isti obrazac kao Faza 2b
- `BUG-S103-ANYATTR` — SECURITY DEFINER RPC (4–6 h)
- E2E za rata tok ne postoji — kandidat nakon što T-S107t-3 prođe ručno
- `npx update-browserslist-db@latest` — namjerno odgođeno da ne miješa `package-lock.json`
  u Financije posao
