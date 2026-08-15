# NEXT SESSION PROMPT — nakon S107z (destilacija + Faza 1 SQL)

**Pisan protiv commita `66ffc0b`** (S107z, 2026-08-15). Ako `git log --oneline -1` pokazuje
nešto novije, čitaj ovo kao povijest — `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` = `main` = `7239c8d` na kodu (nema `src/` diffa od PROD deploya
2026-08-12). S107z je dodao dokumentaciju + SQL; **`src/` još nije diran za Fazu 1.**

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Što je gotovo

**CLAUDE.md destiliran** (1648 → 549 redaka). Povijest po sesijama je sad samo u
`DONE_HISTORY.md`; u CLAUDE.md je ostalo ono što mijenja buduće odluke. Zamke iz starih
sesija su podignute u „Critical rules" / „Zamke" da ih se ne mora tražiti po povijesti.

**Odluke o analitici i saldu zapisane** u `docs/OVERVIEW_TAB_SPEC.md` (+231 redak). Najvažnija:
**saldo se računa od sidra, ne od početka povijesti.** Ti otvoriš bankovnu aplikaciju, prepišeš
stanje i datum — a app zbraja samo ono što se dogodilo **poslije** tog datuma. Posljedica koja
mijenja plan: **2024. i 2023. više nisu na kritičnom putu.** Saldo je točan i bez njih; one idu
u bazu zbog analize i AI sloja, ne zbog salda.

**Faza 1 — SQL napisan, čeka tvoju ruku.** Dvije skripte su gotove ali **ne mogu se pokrenuti
iz koda** — Claude nema način izvršiti DDL kroz Supabase. Ti ih moraš zalijepiti u Supabase SQL
Editor.

## Što trebaš napraviti ti

**1. Pokreni SQL na TEST bazi, ovim redom:**

1. `sql/035_area_group_agg.sql`
2. `sql/036_balance_anchors.sql`

Obje su idempotentne (ponovno pokretanje ne škodi). Ako nešto pukne — zalijepi grešku u chat.

**2. Onda se pokreće prihvatni test** (`verify_rpc_vs_model.py`) koji uspoređuje tri strane:
Excel Review, bazu, i novu SQL funkciju. Tek ako se sve tri poklope u cent, piše se ijedan
red UI koda.

## Što je izlet u podatke usput našao

⚠ **45 eventa u TEST bazi nema nijedan atribut** — samo komentar. Svi u svibnju 2025.
(2025-05-08 do 2025-05-31). Taj mjesec ima 130 eventa, a samo 85 ih je dobilo atribute.
Izgleda kao **djelomično pali import batch**, ne kao greška u SQL-u.

Ne pomiču saldo (nemaju iznos), ali su 45 transakcija koje su izgubile podatke. Odluka koju
treba donijeti: obrisati ih i ponovo uvesti svibanj 2025, ili ostaviti. **Nije još provjereno
mojom rukom — to je nalaz paralelne sesije.**

**D1b potvrđen u podacima:** na svih 634 izvršenih redaka `Datum naplate == event_date`, bez
iznimke. Znači da je ispravno da sidro uspoređuje po `event_date`.

## Ostalo za Koku (nepromijenjeno)

- **Red 2115** (LJEKARNA OREBIC) — ručna izmjena Medical_Sasa → Medical_Koka, nisi još stigao
- N/A klasifikacija za 2024/2023 — radit ćemo je usput s vettingom prije svakog batcha
- Kokina delta (od 2026-07-08, ~147 tx/mj) — jedini dio koji **raste**, zato prvi u redu

---

# DIO 2 — Tehnički dio (za Claudea)

## Neverificirano stanje u letu (paralelna sesija, necommitano)

Tri fajla su u working treeju kao **untracked**, napisala ih je paralelna sesija, **nisu
pokrenuta ni protiv čega**:

| file | što je | status |
| --- | --- | --- |
| `sql/035_area_group_agg.sql` | `app_can_read_area`, `app_slug_count`, `app_assert_slugs`, `area_agg_rows`, `rpc_area_group_agg` | **nije pokrenut na TEST** |
| `sql/036_balance_anchors.sql` | `balance_anchors` tablica + 3 policyja, `app_can_write_area`, `rpc_area_balance_anchored` | **nije pokrenut na TEST** |
| `data-prep_tools/Financije/verify_rpc_vs_model.py` | prihvatni test Review vs. baza vs. RPC | **nije pokrenut** |

**Ne commitati dok prihvatni test ne prođe.** Redoslijed: Saša pokrene 035 pa 036 u Supabase
SQL Editoru (TEST) → `Financije\run.bat verify_rpc_vs_model.py` → tek onda `src/`.

## Odstupanja od `OVERVIEW_TAB_SPEC.md` §2.4 (namjerna, dokumentirana u zaglavljima fajlova)

- **`p_filters jsonb` (lista) umjesto `p_filter_slug`/`p_filter_val` (jedan par).** Dokazano
  pravilo salda su **dva uvjeta odjednom** — `izvorplacanja IN (Racun, Cash)` **i**
  `status NOT IN (Planiran)`. Jedan par to ne može izraziti. Operatori: `in` / `not_in`, pri
  čemu `not_in` prati semantiku Python modela (event bez ikakve vrijednosti **prolazi**).
- **`p_from` uz `p_as_of`.** §2.17 definira saldo kao `sidro + Σ(promjene STROGO nakon
  datuma potvrde)` — ekskluzivna donja granica je dio modela, ne pogodnost.
- **Drugi RPC `rpc_area_balance_anchored` u 036.** Jedan `p_from` ne može izraziti **sidro po
  računu**; join na sidro ide unutar SQL-a. Grupa sa sidrom ali bez pomaka i dalje se prikazuje
  (`anchored: false`) — pločica smije reći „od početka podataka" umjesto tiho lagati.
- **Nepoznat slug baca grešku**, ne vraća 0 — preimenovan slug mora biti glasan (rizik S105d).

Tri pravila iz §2.4 su držana: vlastita provjera pristupa (`service_role` / owner / template
user / `data_shares` — zrcali `areas_select`), leaf-only **i** `chain_key IS NULL` kao dva
nezavisna P2 guarda, `value_number` po `attribute_definition_id` bez ijednog `ILIKE`.

## Nalaz o podacima (paralelna sesija, neprovjeren)

**45 eventa bez ijednog `event_attributes` retka**, svi 2025-05-08 .. 2025-05-31. Svibanj 2025
ima 130 eventa, 85 s atributima. Prihvatni test to prijavljuje **odvojeno** od RPC verdikta —
to je rupa u uvozu, ne bug u SQL-u, i **ne smije se popravljati u SQL-u**.

Ako se potvrdi: kandidat je re-import svibnja 2025, ali ⚠ uvezeni redak se ne da vratiti novim
batchom — `session_start` bi se sudario. Put je brisanje kroz `Delete?` kolonu pa novi import.

## Batch generiranje — obrazac za 2024/2023

```
python make_financije_import.py --from 2024-01-01 --to 2024-12-31 --dry   # prvo pogledaj report
python make_financije_import.py --from 2024-01-01 --to 2024-12-31         # pravi file
```

⚠ **Prije generiranja:** provjeri ima li za taj period otvorenih pitanja slične vrste kao
`Pitanja za Koku` (neobjašnjeni saldo, sumnjivi duplikati, krivi datumi) — `verify_saldo_model.py`
je alat za to (v. `SALDO_MODEL_NALAZI.md` za obrazac izvještaja). Cilj: ne uvoziti podatke koje
ćeš poslije morati ručno ispravljati kroz app.

**Odluka (S107y):** batch 2024/2023 se **ne priprema unaprijed** — svaki period prvo prolazi
vetting s Kokom, tek onda generiranje. Ispravke moraju ići **prije** generiranja; uvezeni
redak se poslije teško popravlja.

## Otvoreno

- **T-S107v-7 (PROD):** kad se View opet ne otvori nakon Finish — poslati poruku s ekrana
- `sql/033_delete_area_cascade.sql` SECTION 2b — jesu li policyji iz `020_orphan_rls.sql` na TEST-u
- `export_profiles` — jedina preostala rupa u `AreaSettings` roundtripu
- **„From template" ne kopira `areas.settings`** (`StructureAddAreaPanel.tsx:275`) — nađeno 2026-08-15
- `T-S107u-2` — `groupAttributes` uzima `Default` s prvog retka grupe (bezopasno, konvergira)
- **Bulk delete (checkbox) nije ograničen za grantee-a** — stari backlog
- **§2.13 (tri kante planiranog)** — neprovjerljivo do prvog importa s generiranim ratama
