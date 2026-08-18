# S107t — testovi (2026-08-01)

**Tema:** `Rata br` atribut · čišćenje lažnih rata · `make_financije_import.py` ·
`Automations` sheet proširen na `rata` · rata tok prebačen na model B + novi model datuma.

**Preduvjeti za sve app testove:**
- `cd C:\0_Sasa\events-tracker-react` pa `npm run dev:test` (⚠ npm mora biti u direktoriju projekta)
- login `sasasladoljev59@gmail.com`
- **`Financije_all` area obrisana iz TEST baze prije početka** (struktura se mijenjala 3× danas)

**Fajlovi za uvoz:**
| korak | file |
| --- | --- |
| Structure | `data-prep_data/Financije/Financije_all_structure_20260801_172202.xlsx` |
| Activities | `data-prep_data/Financije/Financije_all_import_20260801_172535.xlsx` |

---

## Programske kontrole (izvršene, ne treba ponavljati)

| ID | Kontrola | Rezultat |
| --- | --- | --- |
| P-1 | `Rata br` `validation_rules` identičan `Broj rata` (simulacija `groupAttributes` + `buildValidationRules`) | ✅ paritet True |
| P-2 | `fix_lazne_rate.py` diff protiv backupa — samo 4 stupca, 32 retka | ✅ 0 neočekivanih |
| P-3 | Σ Uplata / Σ Isplata nepromijenjene nakon čišćenja | ✅ u cent |
| P-4 | `Tip`/`Podtip` netaknuti nakon čišćenja | ✅ 0 promjena |
| P-5 | 7 „izgubljenih" redaka pri openpyxl saveu = prazni; zadnja 2 prava retka netaknuta | ✅ |
| P-6 | Simulacija `parseLegend`+`validateLegendHeaders`+`parseDataRows` nad import fileom | ✅ 15 legend, 0 grešaka, 10 redaka |
| P-7 | `session_start` tekst `09:00/09:01/09:02`; `Rate?` pravi bool; `Datum naplate` `2023-02-28T12:00` | ✅ |
| P-8 | Simulacija novog Automations importa nad generiranim sheetom | ✅ 2 pravila, 0 preskočenih |
| P-9 | `npm run typecheck && npm run build` | ✅ čisto |

---

## T-S107t-1 — Structure import (`Financije_all`)

1. Structure tab → Import → `Financije_all_structure_20260801_172202.xlsx`

**Očekivano:**
- Areas created **1**, Categories created **1**, Attributes created **15**, **Automation rules 2**, Rows skipped **0**
- ⚠ **15, ne 16** — `Datum kupovine` je izbačen (D1a povučen)
- `Rata br` postoji, Sort 11, između `Broj rata` i `Datum naplate`

**Fail ako:** atributa ≠ 15 · Automation rules ≠ 2 · ima `Datum kupovine`

---

## T-S107t-2 — Add Activity: `Rata br` vidljivost

1. Add Activity → `Financije_all > Transakcija`
2. `Smjer = Isplata` → pojavi se `Rate?`
3. Označi `Rate?`

**Očekivano:**
- `Broj rata` **i** `Rata br` pojave se zajedno (isti `depends_on rate = TRUE`)
- Odznačavanjem `Rate?` oba nestanu
- `Rata br` ima opis „Redni broj OVE uplate unutar plana (1..Broj rata)…"

**Fail ako:** `Rata br` je vidljiv i bez `Rate?` · ne pojavi se uopće

---

## T-S107t-3 — ⭐ Rata tok (NOVI KOD — najvažniji test)

1. Add Activity → `Racun = Kokin tekući ZABA`, `Izvor = Mastercard`, `Smjer = Isplata`
2. `Isplata = 132.66`, `Tip`/`Podtip` bilo što, `Rate? ✓`, `Broj rata = 6`
3. Event Note: `Ikea test`
4. **Finish**

**Očekivano — modal:**
- Naslov „Kreirati rate?", iznos po rati **22.11** (132.66 / 6)
- Napomena „Sve rate ostaju na danu kupnje — razlikuje ih datum naplate."
- **6 redaka** oblika `rata 1/6 · naplata 11.09.2026. · 22.11` (dan **11**, jer Mastercard)
- svaki sljedeći redak = mjesec kasnije

**Očekivano — nakon „Kreiraj 6 rata":**
- toast „Kreirano 6 rata"
- u listi **6 odvojenih redaka**, svi na **današnjem datumu** (dan kupnje), **ne** razbacani po mjesecima
- otvori bilo koji → `Isplata` 22.11 · `Rata br` = redni broj · `Datum naplate` = 11. odgovarajućeg mjeseca · `Status = Planiran`
- komentar `Ikea test · rata i/6 · 22.11 od 132.66`
- **nema** sedmog zapisa sa 132.66

**Fail ako:** modala nema (⇒ rata config nije stigla importom) · rate su na različitim `event_date` · svih 6 se prikazuje kao **jedan** redak u listi (⇒ `session_start` pomak ne radi) · `Rata br` prazan · `Datum naplate` isti na svima · ostao zapis od 132.66

**Kontrolna varijanta:** isto s `Izvor = Visa` → dan naplate mora biti **3.**, ne 11.

---

## T-S107t-4 — Activities import (10 zapisa)

1. Activities tab → Import → `Financije_all_import_20260801_172535.xlsx`

**Očekivano:**
- 10 CREATE, 0 grešaka, 0 preskočenih kao „tuđi"
- **28.02.2023. ima TRI reda** (09:00 / 09:01 / 09:02) — ne jedan
- Anja rata: `Rate? = Yes` (⚠ **ne** prazno/No — to je bila rupa #3), `Broj rata` 96, `Rata br` 43
- kartični zapisi imaju `Datum naplate` različit od datuma aktivnosti; Racun/Cash isti
- zapis „Status Planiran" ima `Status = Planiran`

**Fail ako:** svi redovi na 09:00 (⇒ `session_start` čitan kao datum) · `Rate?` = No na Anjinoj rati · neki atribut prazan na svima (⇒ ime se ne poklapa s bazom, tiho preskočeno)

---

## T-S107t-5 — Export roundtrip

1. Activities tab → Export (`Financije_all`)
2. Otvori .xlsx

**Očekivano:**
- 10 (+6 iz T-S107t-3) redaka s popunjenim `event_id`
- `session_start` kao tekst `09:00`, ne datum
- `Datum naplate` u istom obliku kao pri uvozu
- `Structure` sheet → `Automations` sheet ima **oba** pravila, uključujući `rata` redak s
  `TriggerAttr=rate`, `CountAttr=brojrata`, `IndexAttr=rata_br`
3. Uvezi isti file natrag bez izmjena → **sve „skipped/untouched", 0 UPDATE-ova**

**Fail ako:** `rata` redak nedostaje u exportu (⇒ roundtrip rupa nije zatvorena) · re-import prijavljuje promjene bez ijedne izmjene

---

## T-S107t-6 — Automations: odsutnost ne briše

1. U izvezenom Structure fileu **obriši `rata` redak** iz `Automations` sheeta (ostavi `set_attribute`)
2. Uvezi natrag

**Očekivano:** rata konfiguracija **ostaje** u bazi (modal i dalje radi) — namjerno, da stariji
export bez tih kolona ne može pobrisati konfiguraciju.

**Fail ako:** rata modal prestane raditi nakon takvog uvoza

---

## T-S107t-7 — Review: čišćenje lažnih rata (Excel, ne app)

Otvori `Financije_review_20260710_1448.xlsx`, sheet `Review`:

1. Filtriraj `Pravilo run` = `2026-08-01 14:55` → **32 retka**, svi HLK/APN
2. Na njima `Rate?` i `Broj rata` **prazni**, `Alternativa / nap.` sadrži `S107t fix: nije rata…`
3. Filtriraj `Rate? = DA` → **629** (bilo 661)
4. `Tip`/`Podtip` na tih 32 nepromijenjeni (Zdravlje/Lječnička komora_Koka, Porezi/porez-prirez-dohodak)

**Fail ako:** brojevi ne odgovaraju · neki pravi rata plan (Broj rata 2/3/4/5/6/10/12/48/60/96) izgubio oznaku

---

## Napomene

- Backup Reviewa prije čišćenja: `*.pre-lazne-rate-20260801_145535.xlsx`
- `Financije_all` se smije brisati i ponovo uvoziti koliko god puta — petlja je namjerno jeftina
- Ako T-S107t-3 padne na „nema modala": provjeri je li Structure import prijavio **Automation rules 2**
