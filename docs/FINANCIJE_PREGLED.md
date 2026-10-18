# Financije — pregled (ulazna točka)

**Napisano:** 2026-10-18 · **Za:** Sašu i Claudea · **Čemu služi:** da se s jednog mjesta vidi što smo
napravili, gdje stoji otvoreni posao i što je od svega toga upotrebljivo za druge Aree.

> ⚠ **Ovaj dokument NE vodi popis otvorenog posla.** Jedini popis je
> [`FINANCIJE_PROCES.md`](FINANCIJE_PROCES.md) §4.
> Drugi popis bi se s njim razišao za par sesija (isti razred kao kurirani popis u PENDING-u, ukinut S116).
> Ovdje se na njega samo upućuje.

---

## 1. Gdje je što

| pitanje | dokument |
| --- | --- |
| Kako Koka i Saša vode Financije, što je otvoreno (T1–T37) | [`FINANCIJE_PROCES.md`](FINANCIJE_PROCES.md) |
| Saldo, sidra, pločice, RPC, gdje živi konfiguracija | [`OVERVIEW_TAB_SPEC.md`](OVERVIEW_TAB_SPEC.md) |
| „Kamo ide novac" — razrez, bucketi | [`RAZREZ_SPEC.md`](RAZREZ_SPEC.md) |
| Traka „Čeka potvrdu", košare | [`DOSPJELO_SPEC.md`](DOSPJELO_SPEC.md) |
| Održavanje Tip/Podtip opcija (K-plan) | [`KLASIFIKACIJA_ODRZAVANJE_SPEC.md`](KLASIFIKACIJA_ODRZAVANJE_SPEC.md) |
| Automatika na uvozu — kad je graditi | [`FAZA3_IMPORT_AUTOMATIKA.md`](FAZA3_IMPORT_AUTOMATIKA.md) |
| Pravila Python alata, izvodi, rječnik `Izvod opis`, 1:N, Visa | [`data-prep_tools/CLAUDE.md`](../data-prep_tools/CLAUDE.md) |
| Nalazi po sesijama iz pipelinea (dugo, povijest) | [`ENRICH_PLAN.md`](../data-prep_tools/Financije/ENRICH_PLAN.md) |
| Dokaz modela salda (4.996 redaka) | [`SALDO_MODEL_NALAZI.md`](../data-prep_tools/Financije/SALDO_MODEL_NALAZI.md) |
| Cutover plan (gitignoriran, samo lokalno + `D:`) | `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` §13 |
| Delta prozor — sidro kao oznaka (izgrađeno S142–S143) | [`_archive/DELTA_WINDOW_SPEC.md`](_archive/DELTA_WINDOW_SPEC.md) |
| Stanje migracije po tranšama (S116–S137) | [`_archive/FINANCIJE_STATUS.md`](_archive/FINANCIJE_STATUS.md) |
| Trajna pravila (saldo miče `Izvor`, sidro izvana, …) | korijenski `CLAUDE.md`, § Financije i § Overview |
| Kronologija po sesijama | [`sessions/DONE_HISTORY.md`](sessions/DONE_HISTORY.md) |

---

## 2. Što smo napravili

**Cilj je bio:** Kokina Excelica (`Financije 2026.xlsm`) i bankovni izvodi → Area `Financije_all`,
s kojom Koka vodi saldo na mobitelu, a Saša analizira na što se troši.

| kada | što |
| --- | --- |
| srpanj 2026 (S107) | Pipeline: Kokina Excelica + izvodi (ZABA, RF, MC, PBZ Visa — samo PDF) → Review workbook; Kokina taksonomija 18 Tipova / 65 parova; generator strukture `Financije_all` |
| S108 | Overview tab: pločica salda po računu, sidro, drill u Activities |
| S110–S111 | Oba lanca salda zatvorena: app reproducira **ispisana** bankovna stanja u cent; `Cash` izbačen iz salda |
| S113–S117 | Kokina delta u tranšama, svaka s kontrolnim brojem iz njenog lanca |
| **S118, 25.08.** | **Koka na PROD-u** — vlasnica Aree, Saša write grantee; 2.312 eventa Excel roundtripom iz TEST-a |
| S121–S131 | Kokin Excel roundtrip (`fix_as_owner`), delta sheet, sekcija košare, `Datum naplate` po kartici |
| S127–S128 | Povijest 2023.–2024. uvezena (2.738 redaka); provjera prometom (`promet_check`), ne saldom |
| S134–S136 | Backup i restore baze, shema u gitu, RLS očišćen (107 → 76 politika) |
| S138 | Visa `cutoff:3:5` |
| S142–S143 | Delta prozor mjeren sidrima, kolona `Potvrda`, kontrolne točke, update-guard |
| S147 | `Status` kartičnog retka = „je li račun već teretio" |
| S151 | Koka napustila Excelicu — radi na mobitelu, kroz Add/Edit |
| S155–S157 | Žig izvoda, upozorenje na potvrđenom retku, traka „Čeka potvrdu" (MC) |
| S158, S161 | Audit procesa; prvi mjesečni krug alatima (MC, ZABA, Visa u cent) |
| S163–S169 | „Kamo ide novac" + klasifikacija povijesti s Kokom (T33–T36) |
| S170–S172 | Visa u traci, pločica Košare, filtar za mobitel; deploy 17.10. |

**Stanje 17.10.2026.:** 5.424 eventa, 51.071 atribut, 25 sidara (TEST = PROD). Rujanski krug
zatvoren u cent. `Financije_old` (Sašina, 2023.–2025.) i dalje postoji na PROD-u — v. zamku
„upit bez filtra po Arei" u `CLAUDE.md`.

**Odluke iz migracije** (puni tekst u `_archive/FINANCIJE_STATUS.md`): Kokini kartični retci iz
razdoblja koje izvodi pokrivaju su preskočeni (D-1); „Koka sada, izvod potvrda" (D-2); granica
između pipelinea i ručnog unosa je **datum**, ne vrsta retka.

---

## 3. Što čeka

→ **[`FINANCIJE_PROCES.md`](FINANCIJE_PROCES.md) §4**
(jedini popis). Redoslijed i razlozi su u `CLAUDE.md` § Strategic Position.

Za orijentaciju, bez ponavljanja popisa: kratkoročno je to **mjesečni krug u studenom** (prvi put
MC i Visa u traci), dugoročno **manje trenja** (Kokin uvoz Excela T1, Sašine tri predaje T4) i
**klasifikacija povijesti** (ljudski posao).

**Kriterij „Financije su dovoljno gotove"** (prihvaćeno 18.10.): mjesečni krug prođe bez ručnog
slaganja uvoznog filea i bez razvojne sesije. Od tada se Financije održavaju, a nove sesije idu
na sljedeće domene (`trening.xlsm`).

---

## 4. Što je prenosivo na druge Aree

Aplikacija je namjerno agnostična prema domeni: nova Area traži **nula linija koda, samo
konfiguraciju**. Financije su bile prvi teški korisnik — ovo je što su ostavile iza sebe.

### 4.1 Generičko — radi za svaku Areu

**Aplikacija**
- **Structure Excel roundtrip:** kategorije, atributi, izbornici, `depends_on` (+ `default_map`),
  `is_required`, `hidden_in_add`, `automations` (`set_attribute`, `rata`), `list_columns`,
  `add_header`, `comment_template`, `default_period`, `disable_save_plus`.
  ⚠ **Ne nosi** `dashboard` (pločice), `groupings` (bucketi razreza) ni `export_profiles` —
  to je F5 (BACKLOG, „Roundtrip completeness"), preduvjet za samoposlužan template.
- **Activities Excel roundtrip:** `row_hash` (preskače nedirnuto), update-guard, `Delete?`,
  izvještaj o uvozu kao radni file, `fix_as_owner` za tuđe retke, kolizija `session_start` kao
  zaštita od dvostrukog uvoza.
- **Overview pločice po ulogama** (`group`/`plus`/`minus`/`filter`/`bucket`): stanje uz potvrđeno
  očitanje (sidro), razrez s bucketima i krugom, drill u Activities. Agregacija u Postgresu.
- **Kolone liste po Arei** (`pair`, `map`, `sep`, uske dvije linije), izračunata kolona stanja.
- **Unos:** shortcutovi po Arei, zaglavlje s biračem datuma, „samo vlasnik dodaje opcije",
  provjera obaveznih polja, rata modal (N budućih eventa iz jednog unosa).
- **Filtar:** izbornici i za `depends_on` atribute, broj i datum s operatorima, sažetak na mobitelu.
- **„From template":** kopira strukturu i cijeli `settings` (osim `export_profiles`); sidra nikad.

**Python i postupak**
- Generator uvoza (`data-prep_tools/Tools/excel_import_template.py`), Dirty Excel workflow
  (`data-prep_tools/DATA_PIPELINE_PLAN.md`), review workbook + pitanja za vlasnika podataka.
- `backup_db.py` / `restore_db.py`, `dump_schema.py`, `rls_probe.py`; `prod_to_test.py`
  (danas vezan uz `Financije_all`, lako se poopći).
- **Lekcije koje vrijede za svaki uvoz** (sve u `CLAUDE.md` § Excel i § Delta sheet):
  `session_start` kao tekst `HH:MM`, kolona `Area` i e-mail autora u kol. G obavezni, boolean kao
  pravi bool, pojasevi minuta za povijesne batcheve (`09:00+n`), taksonomiju zaključati **prije**
  uvoza, provjera prije pečata (sidro na neprovjeren mjesec čini provjeru nemogućom).

### 4.2 Specifično za Financije — ne prenosi se

- Čitači bankovnih PDF-ova (ZABA, RF, MC, PBZ Visa), razvrstač izvoda, rječnik `Izvod opis → Tip`.
- Košare i traka „Čeka potvrdu" (kartice, skupna naplata), pravila `Datum naplate`.
- Značenje `Status` (`Planiran` = račun još nije teretio), `Izvor` kao ključ salda.
- Sidro kao **bankovno** stanje. ⚠ Sam mehanizam je općenit („potvrđeno očitanje izvana +
  promjene poslije"), ali rječnik (`balance_anchors`, `amount`) i tekst pločice su još bankovni
  (OVERVIEW_TAB_SPEC §2.18 — generički rječnik nije izveden).

### 4.3 Financije za novog korisnika (template)

Odluka 18.10. (Saša): Financije kao template, **prvo na hrvatskom** (npr. Kokina prijateljica).
Preduvjet je F5, jer prilagodba tuđe Aree (računi, dani naplate kartica, tekst skupne naplate)
inače znači SQL nad Areom stranca. Što se čisti i kako se template slaže (template korisnik se ne
može prijaviti) — [`TEMPLATE_SYSTEM_SPEC.md`](TEMPLATE_SYSTEM_SPEC.md), prepisuje se kad posao krene.
