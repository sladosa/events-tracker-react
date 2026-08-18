# S107s — testovi (2026-07-31)

**Sesija:** odluke o formatu importa + generator strukture `Financije_all`.
**NEMA app koda** — samo novi Python alat (`make_financije_all_structure.py`) i analize.
**Handoff:** `NEXT_SESSION_PROMPT.md`

---

## Programske kontrole (izvršene ove sesije)

| ID | Kontrola | Rezultat |
| --- | --- | --- |
| P-1 | `make_financije_all_structure.py --dry` — 15 atributa, 46 attr-redaka, 18 Tipova / 65 Podtipova | ✅ |
| P-2 | Simulacija `groupAttributes()` + `buildValidationRules()` nad generiranim fileom — ispisan JSON koji bi završio u `validation_rules` | ✅ sve mape točne |
| P-3 | Taksonomija ne sadrži `\|` (separator `TextOptions`) — skripta puca ako sadrži | ✅ 0 pogodaka |
| P-4 | `DateMap` validiran istim pravilom kao `isValidDateRule` (`same` / `next:1..31`) | ✅ 4/4 valjane |
| P-5 | `CommentTemplate` = `{racun}/{tip}/{podtip}` na Area **i** Category retku | ✅ |
| P-6 | Automations zaglavlje u **redu 1** (import to zahtijeva), imena kolona match | ✅ |
| P-7 | `SORT_ORDER` pokriva sve atribute iz BASE-a (skripta puca na višak/manjak) | ✅ |

---

## T-S107s-1 — **Saša:** pregled generiranog structure filea

**File:** `data-prep_data/Financije/Financije_all_structure_20260731_180411.xlsx`

**Koraci:**
1. Otvori sheet `Structure`. Zaglavlje je u **redu 3**, autofilter uključen.
2. Provjeri `Sort` redoslijed (1–15) — odgovara li logici unosa:
   `Racun → Izvor → Smjer → Uplata/Isplata → Tip → Podtip → Izvod opis → Rate?/Broj rata
   → Datum naplate/kupovine → Status → Stanje → Valuta`
3. Filtriraj `AttrName` = `Podtip` → mora biti **19 redaka**: `*` fallback + 18 Tipova.
   Provjeri da se `TextOptions` svakog reda slaže s `Taksonomija` sheetom Reviewa.
4. Filtriraj `AttrName` = `Tip` → **1 redak**, `TextOptions` ima **18** vrijednosti
   uključujući `N/A`.
5. Provjeri `Uplata`/`Isplata`/`Stanje` → kolona `Unit` = `EUR`.
6. Provjeri `Valuta` → kolona `Default` je **prazna** (prije je bila `EUR`).
7. Provjeri `Izvod opis` → `Slug` = `izvod_opis`, `AttrType` = `text`.
8. Provjeri `Datum naplate` / `Datum kupovine` → `AttrType` = `datetime`.
9. Sheet `Automations` → 1 pravilo, `TargetAttr`=`datum_naplate`, `MapAttr`=`izvorplacanja`.

**Prolaz:** sve gore točno.
**Pad:** bilo koje odstupanje → promjena je **jedna linija u `MODS` bloku** skripte + rerun.

---

## T-S107s-2 — **Saša:** Structure import u TEST bazu

**Preduvjet:** T-S107s-1 ✅

**Koraci:**
1. `npm run dev:test` (app protiv `.env.testing`).
2. Login. Ako login ne prođe → kredencijali TEST-a su istekli, javi.
3. Structure tab → Import → odaberi `Financije_all_structure_20260731_180411.xlsx`.
4. Pročitaj result summary u modalu.

**Prolaz:**
- `created.areas` = **1**, `created.categories` = **1**, `created.attributes` = **15**
- `automations.rulesImported` = **1**, `rulesSkipped` = **0**
- `conflicts` prazno
- Nova area `Financije_all` vidljiva u Area dropdownu (bez reloada — `areas-changed` event)

**Pad:**
- `rulesSkipped` = 1 → slug `datum_naplate` ili `izvorplacanja` nije nađen u aree
  (redoslijed obrade: atributi se kreiraju prije §9, pa bi ovo značilo grešku u slugovima)
- `created.attributes` < 15 → neki atribut preskočen, pogledaj browser konzolu
  (`Import: failed to create attr`)

---

## T-S107s-3 — **Saša:** Add Activity izgled na novoj aree

**Preduvjet:** T-S107s-2 ✅

**Koraci:**
1. Add Activity → area `Financije_all` → kategorija `Transakcija`.
2. Provjeri redoslijed polja odozgo — mora pratiti `Sort` iz T-S107s-1.
3. Odaberi `Racun` = `Kokin tekući ZABA` → `Izvor` mora ponuditi **Racun / Mastercard / Cash**
   (ne Visa).
4. Odaberi `Izvor` = `Mastercard` → `Status` se mora sam postaviti na **Planiran**.
5. Odaberi `Smjer` = `Isplata` → pojavljuje se `Isplata` polje, uz njega piše **EUR**.
6. Odaberi `Tip` = `Zabava` → `Podtip` nudi 10 vrijednosti (Kino/Kazalište/Muzeji,
   Audible_Koka, …, Spotify).
7. `Datum naplate` — provjeri popunjava li se sam po `Izvor`u (Mastercard → **11. sljedećeg
   mjeseca**). Ovo testira `set_attribute` automatiku iz Automations sheeta.
8. Ostavi `Event Note` prazan, spremi → otvori zapis → `comment` mora biti
   `Kokin tekući ZABA/Zabava/Spotify` (bez praznog repa na kraju).

**Prolaz:** sve gore.
**Pad na koraku 7:** automatika nije stigla u `area.settings.automations.attribute_rules` —
provjeriti `rulesImported` iz T-S107s-2.

---

## Otvoreno (za sljedeću sesiju)

| Stavka | Status |
| --- | --- |
| `make_financije_import.py` | ⬜ nije napisan |
| Import 10 zapisa u TEST + spot-check | ⬜ |
| Export roundtrip iz TEST-a | ⬜ |
| Redak 1521 („Ašo") — izračunati iznos iz razlike salda | ✅ delta = **0,00** (5640,16 → 5640,16; r1522 se zatvara iz iste brojke) ⇒ nepotpuni duplikat r1503 („Ašo", 20 €, 20.3.). **Ne uvozi se.** Ograda: RF izvodi počinju 2024-09 ⇒ nema bankovne potvrde za 2024-03 |
| 15 nemarkiranih rata (popis dolje) | ⬜ izmjereno, nije izvršeno |
| `Datum kupovine` na ratama | ⬜ izmjereno, nije izvršeno |
| `automations.rata` prijenos na `Financije_all` (ne ide Structure importom!) | ⬜ |

### 15 nemarkiranih rata (`RATA n/m` u `Izvod opis`, `Rate?` prazan)

```
1680 2024-04-28  KONZUM P-3205 RATA 6/6        3502 2025-06-28  KONZUM P-3200 RATA 2/3
1829 2024-05-29  SPAR87017 RATA 4/4            3859 2025-09-28  INTER CARS DOO RATA 6/6
1956 2024-06-28  KONZUM P-3200 RATA 1/6        3860 2025-09-28  BAUHAUS RATA 12/12
2093 2024-07-29  TEKSTILPROMET RATA 3/3        4239 2025-12-29  KEINDL SPORT RATA 1/12
2345 2024-09-28  HARVEY NORMAN RATA 9/10       4454 2026-02-26  KONZUM P-3200 RATA 4/6
3364 2025-05-29  DECATHLON P-876 RATA 3/3      4937 2026-06-28  LUFTHAN…447 RATA 1/3
3500 2025-06-28  INTER CARS DOO RATA 3/6       4939 2026-06-28  LUFTHAN…448 RATA 1/3
3501 2025-06-28  BAUHAUS RATA 9/12
```

⚠ Brojevi redaka su iz snapshota 2026-07-31 — **tražiti po `source_key`**, ne po broju retka.
⚠ Ključ mora biti `RATA n/m`; goli `n/m` hvata **31 lažni pozitiv** (datumi `03/23`, `12/23`).
